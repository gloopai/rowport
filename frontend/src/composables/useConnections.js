import {computed, nextTick, ref} from 'vue'
import {Connect, DisconnectProfile, InspectSSHHostKey, ListDatabases, Status} from '../../wailsjs/go/main/App'
import {cloneProfile} from './connectionProfileUtils'
import {useConnectionProfiles} from './useConnectionProfiles'
import {useConnectionState} from './useConnectionState'

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
  const selectedProfileId = ref('')
  const {
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
  } = useConnectionProfiles({
    addLog,
    askConfirm,
    errorMessage,
    hasRuntime,
    logContext,
    newId,
    selectedProfileId,
    setMessage
  })
  const {
    connectedProfileId,
    status,
    connectionStates,
    databases,
    tableCache,
    activeProfileId,
    activeConnection,
    connectedLabel,
    emptyConnectionState,
    getConnectionState,
    updateConnectionState,
    syncActiveConnectionState,
    tableList,
    tableCount,
    isProfileConnected
  } = useConnectionState({
    currentTab,
    selectedProfileId
  })

  const selectedProfile = computed(() => profiles.value.find((item) => item.id === selectedProfileId.value))

  async function initializeProfiles() {
    initializeProfileStore()
    if (hasRuntime()) {
      status.value = await Status()
    }
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

  async function confirmSshHostKey(connection, profileId) {
    let prompt
    try {
      prompt = await InspectSSHHostKey(connection)
    } catch (error) {
      setMessage(errorMessage(error), 'error', logContext({operation: 'inspectHostKey', profileId}))
      return false
    }
    if (!prompt?.required) return true

    const title = prompt.changed ? 'SSH 主机密钥已变更' : '确认 SSH 主机密钥'
    const reason = prompt.changed
      ? '该主机密钥与此前信任的不一致，可能存在中间人攻击。仅在你确认服务器密钥确实已更换时才继续。'
      : '首次连接此主机。请核对指纹与服务器实际指纹一致后再信任。'
    const body = `${prompt.host}\n指纹 ${prompt.fingerprint}\n\n${reason}`
    const accepted = await askConfirm(title, body, '信任并连接')
    if (!accepted) {
      addLog('warn', 'Reject SSH host key', logContext({profileId, fingerprint: prompt.fingerprint, changed: prompt.changed}))
      return false
    }
    connection.ssh.knownHostKey = prompt.key
    pinHostKey(profileId, prompt.key)
    return true
  }

  async function connectSelected() {
    if (!selectedProfile.value) return
    const startedAt = perfStart()
    const profileId = selectedProfile.value.id
    addLog(
      'info',
      'Connect server',
      logContext({profileId, profile: selectedProfile.value.name, host: selectedProfile.value.host, port: selectedProfile.value.port})
    )
    busy.value = true
    try {
      if (!hasRuntime()) {
        suppressDatabaseWatch.value = true
        setExpanded(true, 'server', selectedProfile.value.id)
        connectedProfileId.value = selectedProfile.value.id
        const previewStatus = {
          connected: true,
          user: selectedProfile.value.user,
          server: `${selectedProfile.value.host}:${selectedProfile.value.port}`,
          viaSsh: selectedProfile.value.ssh.enabled
        }
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
      if (connection.ssh?.enabled) {
        const confirmed = await confirmSshHostKey(connection, profileId)
        if (!confirmed) {
          setMessage('已取消连接：未确认 SSH 主机密钥', 'warn', logContext({profileId}))
          return
        }
      }
      const nextStatus = await Connect(connection)
      if (connection.ssh?.enabled && nextStatus.hostKey) {
        pinHostKey(profileId, nextStatus.hostKey)
      }
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
      setMessage('连接成功', 'success', logContext({profileId, databases: nextDatabases.length, elapsedMs: elapsedSince(startedAt), perf: 'connect'}))
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
    status,
    connectionStates,
    databases,
    tableCache,
    activeProfileId,
    activeConnection,
    connectedLabel,
    emptyConnectionState,
    getConnectionState,
    updateConnectionState,
    syncActiveConnectionState,
    profileDialogOpen,
    draftProfile,
    editingProfileId,
    profileDialogTab,
    testConnectionState,
    selectedProfile,
    initializeProfiles,
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
