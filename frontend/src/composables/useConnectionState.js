import {computed, ref} from 'vue'

export function useConnectionState({
  currentTab,
  selectedProfileId
}) {
  const connectedProfileId = ref('')
  const status = ref({connected: false})
  const connectionStates = ref({})
  const databases = ref([])
  const tableCache = ref({})
  const activeProfileId = computed(() => currentTab.value?.profileId || selectedProfileId.value || connectedProfileId.value)
  const activeConnection = computed(() => getConnectionState(activeProfileId.value))
  const connectedLabel = computed(() => activeConnection.value.status.connected ? `${activeConnection.value.status.user}@${activeConnection.value.status.server}` : '未连接')

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
      syncActiveConnectionState(profileId)
    }
  }

  function syncActiveConnectionState(profileId = activeProfileId.value) {
    const next = getConnectionState(profileId)
    status.value = next.status
    databases.value = next.databases
    tableCache.value = next.tableCache
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

  return {
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
  }
}
