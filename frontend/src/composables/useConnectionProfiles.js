import {ref} from 'vue'
import {ChoosePrivateKeyPath, DeleteCredentials, LoadCredentials, SaveCredentials, TestConnection} from '../../wailsjs/go/main/App'
import {cloneProfile, emptyProfile, loadProfiles, normalizeProfile, persistProfiles} from './connectionProfileUtils'

export function useConnectionProfiles({addLog, askConfirm, errorMessage, hasRuntime, logContext, newId, selectedProfileId, setMessage}) {
  const profiles = ref([])
  const profileDialogOpen = ref(false)
  const draftProfile = ref(emptyProfile(newId))
  const editingProfileId = ref('')
  const profileDialogTab = ref('general')
  const testConnectionState = ref({status: 'idle', message: ''})

  function initializeProfileStore() {
    profiles.value = loadProfiles(newId)
    if (profiles.value.length === 0) {
      profiles.value = [emptyProfile(newId)]
      persistProfiles(profiles.value)
    }
    selectedProfileId.value = profiles.value[0]?.id || ''
  }

  function openNewProfileDialog() {
    addLog('debug', 'Open new server profile dialog', logContext())
    editingProfileId.value = ''
    draftProfile.value = emptyProfile(newId)
    profileDialogTab.value = 'general'
    testConnectionState.value = {status: 'idle', message: ''}
    profileDialogOpen.value = true
  }

  async function openEditProfileDialog(profile) {
    addLog('debug', 'Open server profile dialog', logContext({profile: profile.name}))
    editingProfileId.value = profile.id
    draftProfile.value = cloneProfile(profile)
    profileDialogTab.value = 'general'
    testConnectionState.value = {status: 'idle', message: ''}
    if (hasRuntime()) {
      const credentials = await LoadCredentials(profile.id)
      draftProfile.value.password = credentials.mysqlPassword || ''
      draftProfile.value.ssh.password = credentials.sshPassword || ''
      draftProfile.value.ssh.passphrase = credentials.sshPassphrase || ''
    }
    profileDialogOpen.value = true
  }

  async function testDraftConnection() {
    const connection = normalizeProfile(draftProfile.value, newId)
    connection.name = connection.name.trim() || `${connection.user}@${connection.host}`
    testConnectionState.value = {status: 'testing', message: '正在测试连接...'}
    addLog('info', 'Test server connection', logContext({profile: connection.name, host: connection.host, port: connection.port}))
    if (!hasRuntime()) {
      testConnectionState.value = {status: 'success', message: '浏览器预览模式：桌面客户端内会执行真实测试'}
      return
    }
    try {
      const nextStatus = await TestConnection(connection)
      testConnectionState.value = {status: 'success', message: `连接成功：${nextStatus.user}@${nextStatus.server}${nextStatus.viaSsh ? ' via SSH' : ''}`}
      addLog('success', 'Connection test succeeded', logContext({profile: connection.name, host: connection.host}))
    } catch (error) {
      testConnectionState.value = {status: 'error', message: errorMessage(error)}
      addLog('error', 'Connection test failed', logContext({profile: connection.name, error: errorMessage(error)}))
    }
  }

  async function choosePrivateKeyPath() {
    if (!hasRuntime()) {
      setMessage('当前是浏览器预览，文件选择需要在 Wails 客户端中使用', 'warn')
      return
    }
    addLog('debug', 'Choose SSH private key path', logContext())
    const path = await ChoosePrivateKeyPath()
    if (path) {
      draftProfile.value.ssh.privateKeyPath = path
    }
  }

  async function saveProfile() {
    const nextProfile = normalizeProfile(draftProfile.value, newId)
    nextProfile.name = nextProfile.name.trim() || `${nextProfile.user}@${nextProfile.host}`
    if (editingProfileId.value) {
      profiles.value = profiles.value.map((item) => (item.id === editingProfileId.value ? nextProfile : item))
    } else {
      profiles.value.unshift(nextProfile)
    }
    selectedProfileId.value = nextProfile.id
    persistProfiles(profiles.value)

    if (hasRuntime()) {
      await SaveCredentials(nextProfile.id, {
        mysqlPassword: draftProfile.value.password,
        rememberMysqlPassword: nextProfile.rememberPassword,
        sshPassword: draftProfile.value.ssh.password,
        rememberSshPassword: nextProfile.ssh.rememberPassword,
        sshPassphrase: draftProfile.value.ssh.passphrase,
        rememberSshPassphrase: nextProfile.ssh.rememberPassphrase
      })
    }
    profileDialogOpen.value = false
    setMessage('服务器信息已保存', 'success', {profile: nextProfile.name})
  }

  function pinHostKey(profileId, hostKey) {
    const key = (hostKey || '').trim()
    if (!profileId || !key) return
    const profile = profiles.value.find((item) => item.id === profileId)
    if (!profile || profile.ssh?.knownHostKey === key) return
    const isNew = !profile.ssh?.knownHostKey
    profiles.value = profiles.value.map((item) => (item.id === profileId ? {...item, ssh: {...item.ssh, knownHostKey: key}} : item))
    persistProfiles(profiles.value)
    addLog(isNew ? 'info' : 'warn', isNew ? 'Trust SSH host key (first use)' : 'Update trusted SSH host key', logContext({profileId}))
  }

  async function removeProfile(profile) {
    addLog('warn', 'Request delete server profile', logContext({profile: profile.name}))
    if (!(await askConfirm('删除连接', `确定删除连接 "${profile.name}"？保存的钥匙串密码也会一并删除。`, '删除'))) return
    profiles.value = profiles.value.filter((item) => item.id !== profile.id)
    if (selectedProfileId.value === profile.id) {
      selectedProfileId.value = profiles.value[0]?.id || ''
    }
    persistProfiles(profiles.value)
    if (hasRuntime()) await DeleteCredentials(profile.id)
  }

  return {
    profiles,
    profileDialogOpen,
    draftProfile,
    editingProfileId,
    profileDialogTab,
    testConnectionState,
    initializeProfileStore,
    openNewProfileDialog,
    openEditProfileDialog,
    testDraftConnection,
    choosePrivateKeyPath,
    saveProfile,
    removeProfile,
    pinHostKey
  }
}
