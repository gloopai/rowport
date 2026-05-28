import {computed, nextTick, ref} from 'vue'

export function useWorkspaceTabs({
  activeProfileId,
  addLog,
  loadTableDDL,
  loadTableMetadata,
  loadTablePage,
  logContext,
  metadataKey,
  profileById,
  queryRef,
  refreshTables,
  selectedDatabase,
  selectedObject,
  selectedProfile,
  selectedProfileId,
  selectedTable,
  suppressDatabaseWatch,
  syncActiveConnectionState,
  tableData,
  tableMetadata
}) {
  const openTabs = ref([{id: 'console', kind: 'query', title: 'console'}])
  const activeTabId = ref('console')
  const currentTab = computed(() => openTabs.value.find((tab) => tab.id === activeTabId.value))

  function tabTitle(tab) {
    const profile = profileById(tab.profileId)
    if (tab.kind === 'query') return `console_${profile?.name || selectedProfile()?.name || 'mysql'}`
    if (tab.kind === 'data') return `${tab.table} [${profile?.host || selectedProfile()?.host || 'localhost'}]`
    if (tab.kind === 'structure') return `${tab.table} / ${tab.objectType}`
    return tab.title || 'Tab'
  }

  function openConsoleTab() {
    const profileId = selectedProfileId.value || activeProfileId()
    addLog('debug', 'Open SQL console', logContext({profileId}))
    openOrActivateTab({id: `console:${profileId || 'default'}`, kind: 'query', title: 'console', profileId})
  }

  function openDataTab(profileId, database, table) {
    if (!database || !table) return
    addLog('debug', 'Open table data tab', logContext({profileId, database, table}))
    openOrActivateTab({id: `data:${profileId}:${database}.${table}`, kind: 'data', profileId, database, table})
  }

  function openStructureTab(type, profileId, database, table) {
    if (!database || !table || !type) return
    addLog('debug', 'Open table structure tab', logContext({profileId, database, table, type}))
    openOrActivateTab({id: `structure:${profileId}:${type}:${database}.${table}`, kind: 'structure', objectType: type, profileId, database, table})
  }

  function openOrActivateTab(tab) {
    if (!openTabs.value.some((item) => item.id === tab.id)) {
      openTabs.value = [...openTabs.value, tab]
    }
    activateTab(tab.id)
  }

  async function activateTab(tabId) {
    const tab = openTabs.value.find((item) => item.id === tabId)
    if (!tab) return
    activeTabId.value = tab.id
    if (tab.profileId) {
      selectedProfileId.value = tab.profileId
      syncActiveConnectionState(tab.profileId)
    }
    addLog('debug', 'Activate tab', logContext({tab: tabTitle(tab)}))
    if (tab.database && selectedDatabase.value !== tab.database) {
      suppressDatabaseWatch.value = true
      selectedDatabase.value = tab.database
      await refreshTables(tab.profileId, tab.database)
      await nextTick()
      suppressDatabaseWatch.value = false
    } else if (tab.database) {
      await refreshTables(tab.profileId, tab.database)
    }
    if (tab.table) selectedTable.value = tab.table
    if (tab.kind === 'structure') {
      selectedObject.value = {profileId: tab.profileId, type: tab.objectType, database: tab.database, table: tab.table}
      await loadTableMetadata(tab.profileId, tab.database, tab.table)
      if (tab.objectType === 'ddl') await loadTableDDL(tab.profileId, tab.database, tab.table)
    }
    if (tab.kind === 'data') {
      selectedObject.value = {profileId: tab.profileId, type: 'table', database: tab.database, table: tab.table}
      await loadTableMetadata(tab.profileId, tab.database, tab.table)
      await loadTablePage(tableData.value.page || 1)
    }
  }

  function closeTab(tabId, event) {
    event?.stopPropagation()
    const index = openTabs.value.findIndex((tab) => tab.id === tabId)
    if (index === -1) return
    addLog('debug', 'Close tab', logContext({tab: tabTitle(openTabs.value[index])}))
    const wasActive = activeTabId.value === tabId
    const nextTabs = openTabs.value.filter((tab) => tab.id !== tabId)
    openTabs.value = nextTabs
    if (!wasActive) return
    const nextTab = nextTabs[index] || nextTabs[index - 1]
    if (nextTab) {
      activateTab(nextTab.id)
    } else {
      activeTabId.value = ''
    }
  }

  function insertDdlTemplate(type, database = selectedDatabase.value, tableName = selectedTable.value, profileId = activeProfileId()) {
    if (!database || !tableName) return
    const table = `\`${database}\`.\`${tableName}\``
    const metadata = tableMetadata.value[metadataKey(profileId, database, tableName)]
    const firstColumn = metadata?.columns?.[0]?.name || 'id'
    const templateMap = {
      addColumn: `ALTER TABLE ${table}\nADD COLUMN \`new_column\` varchar(255) NULL COMMENT '';`,
      modifyColumn: `ALTER TABLE ${table}\nMODIFY COLUMN \`${firstColumn}\` varchar(255) NULL;`,
      createIndex: `CREATE INDEX \`idx_${tableName}_new_column\`\nON ${table} (\`new_column\`);`,
      renameTable: `RENAME TABLE ${table}\nTO \`${database}\`.\`${tableName}_new\`;`,
      dropTable: `DROP TABLE ${table};`
    }
    queryRef.value = templateMap[type] || queryRef.value
    openConsoleTab()
    addLog('info', 'Insert DDL template', logContext({type, database, table: tableName}))
  }

  return {
    openTabs,
    activeTabId,
    currentTab,
    tabTitle,
    openConsoleTab,
    openDataTab,
    openStructureTab,
    openOrActivateTab,
    activateTab,
    closeTab,
    insertDdlTemplate
  }
}
