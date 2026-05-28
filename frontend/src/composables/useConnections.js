import {computed, nextTick, ref} from 'vue'
import {
  ChoosePrivateKeyPath,
  Connect,
  DeleteCredentials,
  DisconnectProfile,
  ListDatabases,
  LoadCredentials,
  SaveCredentials,
  Status,
  TestConnection
} from '../../wailsjs/go/main/App'

const STORAGE_KEY = 'mysql-gui.profiles'

export function useConnections({
  currentTab,
  hasRuntime,
  newId,
  addLog,
  logContext,
  setMessage,
  errorMessage,
  askConfirm,
  busy,
  selectedDatabase,
  selectedTable,
  selectedObject,
  selectedRowIndex,
  openTabs,
  activeTabId,
  tableData,
  suppressDatabaseWatch,
  setExpanded,
  loadTableMetadata,
  openDataTab,
  refreshTables,
  demoTableData,
  perfStart,
  elapsedSince
}) {
  const profiles = ref([])
  const selectedProfileId = ref('')
  const connectedProfileId = ref('')
  const status = ref({connected: false})
  const connectionStates = ref({})
  const databases = ref([])
  const tableCache = ref({})

  const profileDialogOpen = ref(false)
  const draftProfile = ref(emptyProfile(newId))
  const editingProfileId = ref('')
  const profileDialogTab = ref('general')
  const testConnectionState = ref({status: 'idle', message: ''})

  const selectedProfile = computed(() => profiles.value.find((item) => item.id === selectedProfileId.value))
  const activeProfileId = computed(() => currentTab.value?.profileId || selectedProfileId.value || connectedProfileId.value)
  const activeConnection = computed(() => getConnectionState(activeProfileId.value))
  const connectedLabel = computed(() => activeConnection.value.status.connected ? `${activeConnection.value.status.user}@${activeConnection.value.status.server}` : '未连接')

  async function initializeProfiles() {
    profiles.value = loadProfiles()
    if (profiles.value.length === 0) {
      profiles.value = [emptyProfile(newId)]
      persistProfiles()
    }
    selectedProfileId.value = profiles.value[0]?.id || ''
    if (hasRuntime()) {
      status.value = await Status()
    }
  }

  function emptyConnectionState() {
    return {status: {connected: false}, databases: [], tableCache: {}}
  }

  function getConnectionState(profileId) {
    return connectionStates.value[profileId] || emptyConnectionState()
  }

  function updateConnectionState(profileId, patch) {
    if (!profileId) return
    connectionStates.value = {
      ...connectionStates.value,
      [profileId]: {
        ...getConnectionState(profileId),
        ...patch
      }
    }
    if (profileId === activeProfileId.value || profileId === selectedProfileId.value) {
      const next = getConnectionState(profileId)
      status.value = next.status
      databases.value = next.databases
      tableCache.value = next.tableCache
    }
  }

  function syncActiveConnectionState(profileId = activeProfileId.value) {
    const next = getConnectionState(profileId)
    status.value = next.status
    databases.value = next.databases
    tableCache.value = next.tableCache
  }

  function profileById(profileId) {
    return profiles.value.find((item) => item.id === profileId)
  }

  function activeProfileName(profileId = activeProfileId.value) {
    return profileById(profileId)?.name || selectedProfile.value?.name || ''
  }

  function selectProfile(profile) {
    selectedProfileId.value = profile.id
    syncActiveConnectionState(profile.id)
    addLog('debug', 'Select server profile', logContext({profile: profile.name, host: profile.host}))
  }

  function tableList(profileId, database) {
    return getConnectionState(profileId).tableCache[database] || []
  }

  function tableCount(profileId, database) {
    return tableList(profileId, database).length
  }

  function isProfileConnected(profile) {
    return getConnectionState(profile.id).status.connected
  }

  function loadProfiles() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      return Array.isArray(parsed) ? parsed.map((profile) => normalizeProfile(profile, newId)) : []
    } catch {
      return []
    }
  }

  function persistProfiles() {
    const safeProfiles = profiles.value.map((profile) => ({
      ...profile,
      password: '',
      ssh: {
        ...profile.ssh,
        password: '',
        privateKey: '',
        passphrase: ''
      }
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeProfiles))
  }

  function cloneProfile(profile) {
    return JSON.parse(JSON.stringify(profile))
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
      profiles.value = profiles.value.map((item) => item.id === editingProfileId.value ? nextProfile : item)
    } else {
      profiles.value.unshift(nextProfile)
    }
    selectedProfileId.value = nextProfile.id
    persistProfiles()

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

  async function removeProfile(profile) {
    addLog('warn', 'Request delete server profile', logContext({profile: profile.name}))
    if (!await askConfirm('删除连接', `确定删除连接 "${profile.name}"？保存的钥匙串密码也会一并删除。`, '删除')) return
    profiles.value = profiles.value.filter((item) => item.id !== profile.id)
    if (selectedProfileId.value === profile.id) {
      selectedProfileId.value = profiles.value[0]?.id || ''
    }
    persistProfiles()
    if (hasRuntime()) await DeleteCredentials(profile.id)
  }

  async function connectSelected() {
    if (!selectedProfile.value) return
    const startedAt = perfStart()
    const profileId = selectedProfile.value.id
    addLog('info', 'Connect server', logContext({profileId, profile: selectedProfile.value.name, host: selectedProfile.value.host, port: selectedProfile.value.port}))
    busy.value = true
    try {
      if (!hasRuntime()) {
        suppressDatabaseWatch.value = true
        setExpanded(true, 'server', selectedProfile.value.id)
        connectedProfileId.value = selectedProfile.value.id
        const previewStatus = {connected: true, user: selectedProfile.value.user, server: `${selectedProfile.value.host}:${selectedProfile.value.port}`, viaSsh: selectedProfile.value.ssh.enabled}
        const previewDatabases = [{name: 'demo'}, {name: 'information_schema'}]
        const previewTableCache = {demo: [{name: 'users', type: 'BASE TABLE', rows: 128, engine: 'InnoDB'}]}
        updateConnectionState(profileId, {status: previewStatus, databases: previewDatabases, tableCache: previewTableCache})
        selectedDatabase.value = 'demo'
        selectedTable.value = 'users'
        tableData.value = demoTableData()
        setExpanded(true, 'database', profileId, 'demo')
        await loadTableMetadata(profileId, 'demo', 'users')
        await nextTick()
        suppressDatabaseWatch.value = false
        openDataTab(profileId, 'demo', 'users')
        setMessage('浏览器预览模式：后端连接在 Wails 客户端内可用', 'warn', logContext({elapsedMs: elapsedSince(startedAt)}))
        return
      }

      const connection = cloneProfile(selectedProfile.value)
      const nextStatus = await Connect(connection)
      setExpanded(true, 'server', selectedProfile.value.id)
      connectedProfileId.value = selectedProfile.value.id
      const nextDatabases = await ListDatabases(profileId)
      updateConnectionState(profileId, {status: nextStatus, databases: nextDatabases, tableCache: {}})
      suppressDatabaseWatch.value = true
      selectedDatabase.value = connection.database || nextDatabases[0]?.name || ''
      if (selectedDatabase.value) {
        await refreshTables(profileId, selectedDatabase.value, true)
        selectedTable.value = tableList(profileId, selectedDatabase.value)[0]?.name || ''
        setExpanded(true, 'database', profileId, selectedDatabase.value)
        if (selectedTable.value) {
          await loadTableMetadata(profileId, selectedDatabase.value, selectedTable.value)
        }
      }
      await nextTick()
      suppressDatabaseWatch.value = false
      if (selectedDatabase.value && selectedTable.value) {
        openDataTab(profileId, selectedDatabase.value, selectedTable.value)
      }
      setMessage('连接成功', 'success', logContext({profileId, databases: nextDatabases.length, elapsedMs: elapsedSince(startedAt)}))
    } catch (error) {
      suppressDatabaseWatch.value = false
      setMessage(errorMessage(error), 'error', logContext({operation: 'connect'}))
    } finally {
      busy.value = false
    }
  }

  async function disconnect() {
    const profileId = selectedProfileId.value || activeProfileId.value
    addLog('info', 'Disconnect server', logContext({profileId}))
    if (hasRuntime()) await DisconnectProfile(profileId)
    updateConnectionState(profileId, emptyConnectionState())
    if (connectedProfileId.value === profileId) connectedProfileId.value = ''
    selectedDatabase.value = ''
    selectedTable.value = ''
    selectedObject.value = {profileId: '', type: 'table', database: '', table: ''}
    selectedRowIndex.value = -1
    openTabs.value = openTabs.value.filter((tab) => tab.profileId !== profileId)
    if (!openTabs.value.length) openTabs.value = [{id: 'console', kind: 'query', title: 'console'}]
    activeTabId.value = openTabs.value[0]?.id || 'console'
    tableData.value = {columns: [], primaryKeys: [], rows: [], total: 0, page: 1, pageSize: 50}
    setMessage('已断开连接', 'success')
  }

  return {
    profiles,
    selectedProfileId,
    connectedProfileId,
    status,
    connectionStates,
    databases,
    tableCache,
    profileDialogOpen,
    draftProfile,
    editingProfileId,
    profileDialogTab,
    testConnectionState,
    selectedProfile,
    activeProfileId,
    activeConnection,
    connectedLabel,
    initializeProfiles,
    emptyConnectionState,
    getConnectionState,
    updateConnectionState,
    syncActiveConnectionState,
    profileById,
    activeProfileName,
    selectProfile,
    tableList,
    tableCount,
    isProfileConnected,
    openNewProfileDialog,
    openEditProfileDialog,
    testDraftConnection,
    choosePrivateKeyPath,
    saveProfile,
    removeProfile,
    connectSelected,
    disconnect
  }
}

function emptyProfile(newId) {
  return {
    id: newId(),
    name: 'Local MySQL',
    host: '127.0.0.1',
    port: '3306',
    user: 'root',
    password: '',
    rememberPassword: false,
    database: '',
    advanced: {
      connectTimeoutSeconds: 8,
      maxOpenConns: 8,
      maxIdleConns: 2
    },
    ssh: {
      enabled: false,
      host: '',
      port: '22',
      user: '',
      password: '',
      rememberPassword: false,
      privateKey: '',
      privateKeyPath: '',
      passphrase: '',
      rememberPassphrase: false
    }
  }
}

function normalizeProfile(profile, newId) {
  const base = emptyProfile(newId)
  const advanced = {...base.advanced, ...(profile.advanced || {})}
  return {
    ...base,
    ...profile,
    password: '',
    advanced: {
      connectTimeoutSeconds: clamp(Number(advanced.connectTimeoutSeconds) || 8, 1, 120),
      maxOpenConns: clamp(Number(advanced.maxOpenConns) || 8, 1, 128),
      maxIdleConns: clamp(Number(advanced.maxIdleConns) || 2, 0, Math.max(1, Number(advanced.maxOpenConns) || 8))
    },
    ssh: {
      ...base.ssh,
      ...(profile.ssh || {}),
      password: '',
      privateKey: '',
      passphrase: ''
    }
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
