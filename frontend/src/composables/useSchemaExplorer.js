import {computed, nextTick, ref} from 'vue'
import {ListColumns, ListIndexes, ListTables, ShowCreateTable} from '../../wailsjs/go/main/App'

export function useSchemaExplorer({
  activeProfileId,
  activeProfileName,
  addLog,
  currentTab,
  demoTableData,
  elapsedSince,
  errorMessage,
  getConnectionState,
  hasRuntime,
  loadTablePage,
  logContext,
  openDataTab,
  openStructureTab,
  perfStart,
  resetGridScroll,
  selectedObjectRef,
  selectedDatabase,
  selectedProfileId,
  selectedRowIndex,
  selectedTable,
  setMessage,
  suppressDatabaseWatch,
  syncActiveConnectionState,
  tableData: _tableData,
  updateConnectionState
}) {
  const selectedObject = selectedObjectRef || ref({profileId: '', type: 'table', database: '', table: ''})
  const expandedTree = ref(new Set())
  const tableMetadata = ref({})
  const tableDDLs = ref({})

  const profileIdValue = () => (typeof activeProfileId === 'function' ? activeProfileId() : activeProfileId.value)
  const selectedMetadata = computed(
    () =>
      tableMetadata.value[metadataKey(selectedObject.value.profileId, selectedObject.value.database, selectedObject.value.table)] || {columns: [], indexes: []}
  )
  const structureTitle = computed(() => {
    if (!selectedObject.value.table) return 'Structure'
    if (selectedObject.value.type === 'columns') return `${selectedObject.value.table} / columns`
    if (selectedObject.value.type === 'keys') return `${selectedObject.value.table} / keys`
    if (selectedObject.value.type === 'indexes') return `${selectedObject.value.table} / indexes`
    if (selectedObject.value.type === 'ddl') return `${selectedObject.value.table} / DDL`
    return `${selectedObject.value.table} / structure`
  })
  const structureColumns = computed(() => {
    if (selectedObject.value.type === 'indexes') return ['index', 'column', 'unique', 'seq', 'type', 'cardinality', 'sub_part', 'nullable']
    if (selectedObject.value.type === 'keys') return ['key', 'column', 'type']
    return ['column', 'type', 'nullable', 'key', 'default', 'extra', 'comment']
  })
  const structureRows = computed(() => {
    if (selectedObject.value.type === 'indexes') {
      return selectedMetadata.value.indexes.map((item) => [
        item.indexName,
        item.columnName,
        item.nonUnique ? 'NO' : 'YES',
        item.seqInIndex,
        item.indexType,
        item.cardinality ?? '',
        item.subPart ?? '',
        item.nullable
      ])
    }
    if (selectedObject.value.type === 'keys') {
      const primaryColumns = selectedMetadata.value.columns.filter((column) => column.key === 'PRI')
      const uniqueIndexes = selectedMetadata.value.indexes.filter((item) => !item.nonUnique && item.indexName !== 'PRIMARY')
      return [
        ...primaryColumns.map((column) => ['PRIMARY', column.name, column.type]),
        ...uniqueIndexes.map((item) => [item.indexName, item.columnName, item.indexType])
      ]
    }
    return selectedMetadata.value.columns.map((column) => [
      column.name,
      column.type,
      column.nullable,
      column.key,
      column.default ?? '',
      column.extra,
      column.comment
    ])
  })
  const selectedDDL = computed(
    () => tableDDLs.value[metadataKey(selectedObject.value.profileId, selectedObject.value.database, selectedObject.value.table)] || ''
  )

  function metadataKey(profileId, database, table) {
    return `${profileId || profileIdValue()}.${database}.${table}`
  }

  function clearTableMetadataCache(profileId, database, table = '') {
    if (!profileId || !database) return
    const exactKey = table ? metadataKey(profileId, database, table) : ''
    const keyPrefix = `${profileId}.${database}.`
    tableMetadata.value = Object.fromEntries(Object.entries(tableMetadata.value).filter(([key]) => (table ? key !== exactKey : !key.startsWith(keyPrefix))))
    tableDDLs.value = Object.fromEntries(Object.entries(tableDDLs.value).filter(([key]) => (table ? key !== exactKey : !key.startsWith(keyPrefix))))
  }

  function clearTableListCache(profileId, database) {
    if (!profileId || !database) return
    const nextCache = {...getConnectionState(profileId).tableCache}
    delete nextCache[database]
    updateConnectionState(profileId, {tableCache: nextCache})
  }

  function invalidateSchemaCache(profileId, database, table = '', options = {}) {
    clearTableMetadataCache(profileId, database, table)
    if (options.tableList) clearTableListCache(profileId, database)
  }

  function treeKey(...parts) {
    return parts.join('/')
  }

  function isExpanded(...parts) {
    return expandedTree.value.has(treeKey(...parts))
  }

  function setExpanded(expanded, ...parts) {
    const next = new Set(expandedTree.value)
    const key = treeKey(...parts)
    if (expanded) {
      next.add(key)
    } else {
      next.delete(key)
    }
    expandedTree.value = next
  }

  function toggleExpanded(...parts) {
    setExpanded(!isExpanded(...parts), ...parts)
  }

  async function refreshTables(profileId = profileIdValue(), database = selectedDatabase.value, force = false) {
    if (!database) return
    const state = getConnectionState(profileId)
    if (!force && state.tableCache[database]) return
    if (!hasRuntime()) return
    const startedAt = perfStart()
    if (force) {
      invalidateSchemaCache(profileId, database, '', {tableList: true})
    }
    addLog('info', force ? 'Refresh tables' : 'Load tables', logContext({profileId, database}))
    try {
      const tables = await ListTables(profileId, database)
      updateConnectionState(profileId, {
        tableCache: {...getConnectionState(profileId).tableCache, [database]: tables}
      })
      addLog('success', 'Tables loaded', logContext({profileId, database, tables: tables.length, elapsedMs: elapsedSince(startedAt), perf: 'schema'}))
    } catch (error) {
      setMessage(errorMessage(error), 'error', logContext({operation: 'refreshTables', database}))
    }
  }

  async function toggleDatabase(profileId, database) {
    const willExpand = !isExpanded('database', profileId, database)
    setExpanded(willExpand, 'database', profileId, database)
    addLog('debug', willExpand ? 'Expand database node' : 'Collapse database node', logContext({profile: activeProfileName(profileId), database}))
    if (willExpand) {
      await refreshTables(profileId, database)
    }
  }

  async function toggleTables(profileId, database) {
    const willExpand = !isExpanded('tables', profileId, database)
    setExpanded(willExpand, 'tables', profileId, database)
    addLog('debug', willExpand ? 'Expand tables node' : 'Collapse tables node', logContext({profile: activeProfileName(profileId), database}))
    if (willExpand) {
      await refreshTables(profileId, database)
    }
  }

  async function selectDatabase(profileId, database) {
    selectedProfileId.value = profileId
    syncActiveConnectionState(profileId)
    selectedDatabase.value = database
    selectedTable.value = ''
    addLog('info', 'Select database', logContext({profile: activeProfileName(profileId), database}))
    setExpanded(true, 'database', profileId, database)
    await refreshTables(profileId, database)
  }

  async function selectTable(table, database = selectedDatabase.value, profileId = profileIdValue()) {
    selectedProfileId.value = profileId
    syncActiveConnectionState(profileId)
    if (database && selectedDatabase.value !== database) {
      suppressDatabaseWatch.value = true
      selectedDatabase.value = database
      await nextTick()
      suppressDatabaseWatch.value = false
    }
    selectedTable.value = table.name || table
    selectedRowIndex.value = -1
    addLog('info', 'Select table', logContext({profile: activeProfileName(profileId), database, table: selectedTable.value}))
    setExpanded(true, 'database', profileId, database)
    setExpanded(true, 'tables', profileId, database)
    await loadTableMetadata(profileId, database, selectedTable.value)
    openDataTab(profileId, database, selectedTable.value)
  }

  async function selectTableObject(type, tableName, database = selectedDatabase.value, profileId = profileIdValue()) {
    selectedProfileId.value = profileId
    syncActiveConnectionState(profileId)
    if (database && selectedDatabase.value !== database) {
      suppressDatabaseWatch.value = true
      selectedDatabase.value = database
      await nextTick()
      suppressDatabaseWatch.value = false
    }
    selectedTable.value = tableName
    selectedRowIndex.value = -1
    addLog('info', 'Select table object', logContext({profile: activeProfileName(profileId), database, table: tableName, type}))
    setExpanded(true, 'database', profileId, database)
    setExpanded(true, 'tables', profileId, database)
    setExpanded(true, 'table', profileId, database, tableName)
    setExpanded(true, type, profileId, database, tableName)
    await loadTableMetadata(profileId, database, tableName)
    if (type === 'ddl') await loadTableDDL(profileId, database, tableName)
    openStructureTab(type, profileId, database, tableName)
  }

  async function handleSelectedDatabaseChange(database, resetTableView) {
    if (suppressDatabaseWatch.value) return
    selectedTable.value = ''
    selectedObject.value = {profileId: profileIdValue(), type: 'database', database, table: ''}
    resetTableView()
    if (database && getConnectionState(profileIdValue()).status.connected) {
      await refreshTables(profileIdValue(), database)
    }
  }

  async function handleSelectedTableChange(table) {
    if (table) {
      resetGridScroll('data')
      await loadTableMetadata(profileIdValue(), selectedDatabase.value, table)
      if (currentTab.value?.kind === 'data' && typeof loadTablePage === 'function') {
        selectedObject.value = {profileId: profileIdValue(), type: 'table', database: selectedDatabase.value, table}
        await loadTablePage(1)
      }
    }
  }

  async function loadTableMetadata(profileId, database, table) {
    if (!database || !table) return
    const key = metadataKey(profileId, database, table)
    if (tableMetadata.value[key]) return
    const startedAt = perfStart()
    if (!hasRuntime()) {
      tableMetadata.value = {
        ...tableMetadata.value,
        [key]: {
          columns: demoTableData().columns,
          indexes: [
            {indexName: 'PRIMARY', columnName: 'id', nonUnique: false, seqInIndex: 1, indexType: 'BTREE', cardinality: 2},
            {indexName: 'idx_users_email', columnName: 'email', nonUnique: true, seqInIndex: 1, indexType: 'BTREE', cardinality: 2}
          ]
        }
      }
      addLog('debug', 'Preview table metadata loaded', logContext({profileId, database, table, elapsedMs: elapsedSince(startedAt)}))
      return
    }
    const [columns, indexes] = await Promise.all([ListColumns(profileId, database, table), ListIndexes(profileId, database, table)])
    tableMetadata.value = {
      ...tableMetadata.value,
      [key]: {columns, indexes}
    }
    addLog(
      'success',
      'Table metadata loaded',
      logContext({profileId, database, table, columns: columns.length, indexes: indexes.length, elapsedMs: elapsedSince(startedAt)})
    )
  }

  async function loadTableDDL(profileId, database, table) {
    if (!database || !table) return
    const key = metadataKey(profileId, database, table)
    if (tableDDLs.value[key]) return
    const startedAt = perfStart()
    if (!hasRuntime()) {
      tableDDLs.value = {
        ...tableDDLs.value,
        [key]: `CREATE TABLE \`${table}\` (\n  \`id\` bigint NOT NULL AUTO_INCREMENT,\n  \`name\` varchar(120) DEFAULT NULL,\n  PRIMARY KEY (\`id\`)\n) ENGINE=InnoDB;`
      }
      addLog('debug', 'Preview DDL loaded', logContext({profileId, database, table, elapsedMs: elapsedSince(startedAt)}))
      return
    }
    try {
      const ddl = await ShowCreateTable(profileId, database, table)
      tableDDLs.value = {...tableDDLs.value, [key]: ddl}
      addLog('success', 'DDL loaded', logContext({database, table, elapsedMs: elapsedSince(startedAt)}))
    } catch (error) {
      setMessage(errorMessage(error), 'error', logContext({operation: 'showCreateTable', database, table}))
    }
  }

  return {
    selectedObject,
    expandedTree,
    tableMetadata,
    tableDDLs,
    selectedMetadata,
    structureTitle,
    structureColumns,
    structureRows,
    selectedDDL,
    metadataKey,
    clearTableMetadataCache,
    clearTableListCache,
    invalidateSchemaCache,
    isExpanded,
    setExpanded,
    toggleExpanded,
    refreshTables,
    toggleDatabase,
    toggleTables,
    selectDatabase,
    selectTable,
    selectTableObject,
    handleSelectedDatabaseChange,
    handleSelectedTableChange,
    loadTableMetadata,
    loadTableDDL
  }
}
