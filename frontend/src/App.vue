<script setup>
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue'
import DatabaseExplorer from './components/DatabaseExplorer.vue'
import CustomSelect from './components/CustomSelect.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import DataTableView from './components/DataTableView.vue'
import EditorTabs from './components/EditorTabs.vue'
import FilterDialog from './components/FilterDialog.vue'
import ImportCsvDialog from './components/ImportCsvDialog.vue'
import MainToolbar from './components/MainToolbar.vue'
import ResultDetailDialog from './components/ResultDetailDialog.vue'
import ServicesPanel from './components/ServicesPanel.vue'
import SqlEditorToolbar from './components/SqlEditorToolbar.vue'
import SqlResultPane from './components/SqlResultPane.vue'
import SqlSidePanel from './components/SqlSidePanel.vue'
import SqlTextEditor from './components/SqlTextEditor.vue'
import StructureView from './components/StructureView.vue'
import {useConnections} from './composables/useConnections'
import {useLayoutResize} from './composables/useLayoutResize'
import {logLevelOptions, useOperationLogs} from './composables/useOperationLogs'
import {useSchemaExplorer} from './composables/useSchemaExplorer'
import {compactSql} from './composables/sqlUtils'
import {useSqlConsole} from './composables/useSqlConsole'
import {useTableData} from './composables/useTableData'

const appStartedAt = performance.now()

const hasRuntime = () => Boolean(window.go?.main?.App)
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

const selectedDatabase = ref('')
const selectedTable = ref('')
const openTabs = ref([{id: 'console', kind: 'query', title: 'console'}])
const activeTabId = ref('console')
const selectedObject = ref({profileId: '', type: 'table', database: '', table: ''})
const busy = ref(false)
const message = ref('')
const contextMenu = ref({open: false, x: 0, y: 0, database: '', table: ''})
const openSelectId = ref('')

const suppressDatabaseWatch = ref(false)
const confirmDialogOpen = ref(false)
const confirmDialog = ref({title: '', body: '', action: '确认'})
let confirmResolve = null
const queryToolbarHeight = ref(40)
let queryToolbarObserver = null
const VIRTUAL_ROW_HEIGHT = 27
const VIRTUAL_VISIBLE_ROWS = 80
const VIRTUAL_OVERSCAN = 12
const CONTEXT_MENU_WIDTH = 220
const CONTEXT_MENU_MAX_HEIGHT = 420

const currentTab = computed(() => openTabs.value.find((tab) => tab.id === activeTabId.value))
const {
  servicesPanelRef,
  logLevelFilter,
  logSearch,
  latestLog,
  visibleLogs,
  addLog,
  clearLogs,
  copyVisibleLogs,
  exportVisibleLogsJson,
  exportVisibleLogsCsv,
  logContextSummary,
  logSql
} = useOperationLogs({
  copyText,
  downloadText,
  formatLogTime,
  logContext,
  newId
})
const {
  dataTableViewRef,
  dataGridScrollTop,
  tableData,
  selectedRowIndex,
  tableWhere,
  tableOrderBy,
  tableOrderDir,
  editDialogOpen,
  editValues,
  editNulls,
  editKeys,
  insertDialogOpen,
  insertValues,
  insertNulls,
  importDialogOpen,
  importPreview,
  filterDialogOpen,
  filterDraft,
  totalPages,
  canMutateRows,
  selectedRow,
  selectedRowsCount,
  canEditSelectedRow,
  canDeleteSelectedRow,
  orderByOptions,
  filterColumnOptions,
  loadTablePage,
  applyTableFilter,
  clearTableFilter,
  openFilterDialog,
  chooseFilterColumn: chooseFilterColumnValue,
  chooseFilterOperator: chooseFilterOperatorValue,
  applyFilterBuilder,
  buildFilterCondition,
  isNullableColumn,
  isPrimaryKeyColumn,
  isLongTextColumn,
  copySelectedRow,
  copyVisibleRows,
  exportVisibleCsv,
  exportVisibleJson,
  openCsvImportPreview,
  confirmCsvImport,
  columnWidth,
  beginColumnResize,
  selectDataRow,
  clearDataRowSelection,
  isSelectedDataRow,
  editSelectedRow,
  openInsertRow,
  saveInsertRow,
  saveRow,
  deleteSelectedRow,
  choosePageSize: chooseTablePageSize,
  chooseTableOrderBy: chooseTableOrderByValue,
  chooseTableOrderDir: chooseTableOrderDirValue,
  resetTableView,
  demoTableData
} = useTableData({
  activeProfileId: () => activeProfileId.value,
  askConfirm,
  busy,
  copyText,
  downloadText,
  elapsedSince,
  errorMessage,
  hasRuntime,
  logContext,
  perfStart,
  resetGridScroll,
  selectedDatabase,
  selectedTable,
  setMessage,
  addLog
})
const {
  tableMetadata,
  structureTitle,
  structureColumns,
  structureRows,
  selectedDDL,
  metadataKey,
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
} = useSchemaExplorer({
  activeProfileId: () => activeProfileId.value,
  activeProfileName: (...args) => activeProfileName(...args),
  addLog,
  currentTab,
  demoTableData,
  elapsedSince,
  errorMessage,
  getConnectionState: (...args) => getConnectionState(...args),
  hasRuntime,
  loadTablePage,
  logContext,
  openDataTab,
  openStructureTab,
  perfStart,
  resetGridScroll,
  selectedDatabase,
  selectedObjectRef: selectedObject,
  selectedProfileId: {
    get value() {
      return selectedProfileId.value
    },
    set value(value) {
      selectedProfileId.value = value
    }
  },
  selectedRowIndex,
  selectedTable,
  setMessage,
  suppressDatabaseWatch,
  syncActiveConnectionState: (...args) => syncActiveConnectionState(...args),
  tableData,
  updateConnectionState: (...args) => updateConnectionState(...args)
})
const {
  profiles,
  selectedProfileId,
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
} = useConnections({
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
})
const queryRows = computed(() => `${queryToolbarHeight.value}px minmax(0, 1fr)`)
const {
  shellColumns,
  mainRows,
  servicesColumns,
  queryMainRows,
  loadLayout,
  beginResize,
  resetPaneSize
} = useLayoutResize()
const contextMenuStyle = computed(() => ({
  left: `${contextMenu.value.x}px`,
  top: `${contextMenu.value.y}px`,
  width: `${CONTEXT_MENU_WIDTH}px`,
  maxHeight: `${Math.max(160, Math.min(CONTEXT_MENU_MAX_HEIGHT, window.innerHeight - 16))}px`
}))
const virtualDataRows = computed(() => virtualRows(tableData.value.rows || [], dataGridScrollTop.value))
const dataTopSpacerHeight = computed(() => virtualDataRows.value.start * VIRTUAL_ROW_HEIGHT)
const dataBottomSpacerHeight = computed(() => Math.max(0, ((tableData.value.rows || []).length - virtualDataRows.value.end) * VIRTUAL_ROW_HEIGHT))
const dataGridColspan = computed(() => tableData.value.columns.length + 2)
const {
  query,
  queryEditorRef,
  queryToolbarRef,
  runningQueryId,
  sqlResultPaneRef,
  resultDetailOpen,
  resultDetail,
  resultTabs,
  activeResultTabId,
  activeResultTab,
  virtualResultRows,
  resultTopSpacerHeight,
  resultBottomSpacerHeight,
  resultGridColspan,
  handleResultGridScroll,
  resetResultGridScroll,
  closeResultTab,
  selectedHistoryId,
  historySearch,
  savedQueryHistory,
  recentQueryHistory,
  savedHistoryItem,
  initializeQueryHistory,
  historyOptionLabel,
  toggleSavedHistory,
  clearRecentHistory,
  chooseHistory: chooseQueryHistory,
  runQuery,
  explainQuery,
  cancelRunningQuery,
  syncQuerySelection,
  openSqlFile,
  formatQuery,
  insertSqlTemplate,
  handleQueryKeydown,
  copyResultRows: copySqlResultRows,
  exportResultCsv: exportSqlResultCsv,
  exportResultJson: exportSqlResultJson,
  openResultDetail
} = useSqlConsole({
  activeProfileId,
  activeProfileName,
  appendLog: addLog,
  askConfirm,
  busy,
  currentTab,
  elapsedSince,
  errorMessage,
  formatLogTime,
  hasRuntime,
  invalidateSchemaCache,
  loadTablePage,
  logContext,
  metadataKey,
  newId,
  openConsoleTab,
  perfStart,
  refreshTables,
  selectedDatabase,
  selectedTable,
  setMessage,
  tableData,
  tableMetadata,
  virtualRows,
  rowHeight: VIRTUAL_ROW_HEIGHT
})
const databaseOptions = computed(() => [
  {label: 'Database', value: ''},
  ...activeConnection.value.databases.map((database) => ({label: database.name, value: database.name}))
])
const pageSizeOptions = [
  {label: '25 rows', value: 25},
  {label: '50 rows', value: 50},
  {label: '100 rows', value: 100},
  {label: '200 rows', value: 200}
]
const orderDirOptions = [
  {label: 'ASC', value: 'ASC'},
  {label: 'DESC', value: 'DESC'}
]
const filterOperatorOptions = [
  {label: '= equals', value: '='},
  {label: '!= not equal', value: '!='},
  {label: '> greater than', value: '>'},
  {label: '>= greater or equal', value: '>='},
  {label: '< less than', value: '<'},
  {label: '<= less or equal', value: '<='},
  {label: 'LIKE contains', value: 'LIKE'},
  {label: 'NOT LIKE excludes', value: 'NOT LIKE'},
  {label: 'IS NULL', value: 'IS NULL'},
  {label: 'IS NOT NULL', value: 'IS NOT NULL'},
  {label: 'BETWEEN', value: 'BETWEEN'}
]
onMounted(async () => {
  loadLayout()
  window.addEventListener('contextmenu', preventNativeContextMenu)
  window.addEventListener('selectstart', preventChromeTextSelection)
  window.addEventListener('resize', syncQueryToolbarHeight)
  initializeQueryHistory()
  await initializeProfiles()
  if (selectedProfileId.value) {
    setExpanded(true, 'server', selectedProfileId.value)
  }
  await nextTick()
  observeQueryToolbar()
  addLog('info', 'Application ready', logContext({elapsedMs: elapsedSince(appStartedAt), profiles: profiles.value.length}))
})

onBeforeUnmount(() => {
  window.removeEventListener('contextmenu', preventNativeContextMenu)
  window.removeEventListener('selectstart', preventChromeTextSelection)
  window.removeEventListener('resize', syncQueryToolbarHeight)
  queryToolbarObserver?.disconnect()
})

function observeQueryToolbar() {
  syncQueryToolbarHeight()
  queryToolbarObserver?.disconnect()
  const toolbarElement = queryToolbarRef.value?.getElement?.()
  if (!toolbarElement || typeof ResizeObserver === 'undefined') return
  queryToolbarObserver = new ResizeObserver(syncQueryToolbarHeight)
  queryToolbarObserver.observe(toolbarElement)
}

function syncQueryToolbarHeight() {
  nextTick(() => {
    const height = queryToolbarRef.value?.getElement?.()?.getBoundingClientRect?.().height || 40
    queryToolbarHeight.value = Math.max(40, Math.ceil(height))
  })
}

watch(selectedDatabase, async (database) => {
  await handleSelectedDatabaseChange(database, resetTableView)
})

watch(selectedTable, async (table) => {
  await handleSelectedTableChange(table)
})

function tabTitle(tab) {
  const profile = profileById(tab.profileId)
  if (tab.kind === 'query') return `console_${profile?.name || selectedProfile.value?.name || 'mysql'}`
  if (tab.kind === 'data') return `${tab.table} [${profile?.host || selectedProfile.value?.host || 'localhost'}]`
  if (tab.kind === 'structure') return `${tab.table} / ${tab.objectType}`
  return tab.title || 'Tab'
}

function logContext(extra = {}) {
  const profileId = extra.profileId || activeProfileId.value
  return {
    profile: extra.profile || activeProfileName(profileId),
    database: selectedDatabase.value || '',
    table: selectedTable.value || '',
    ...extra
  }
}

function formatLogTime(date) {
  return date.toLocaleTimeString([], {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'})
}

function perfStart() {
  return performance.now()
}

function elapsedSince(startedAt) {
  return Math.max(0, Math.round(performance.now() - startedAt))
}

function virtualRows(rows, scrollTop) {
  const total = rows.length
  if (total <= VIRTUAL_VISIBLE_ROWS + VIRTUAL_OVERSCAN * 2) {
    return {items: rows.map((row, index) => ({row, index})), start: 0, end: total}
  }
  const firstVisible = Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT)
  const start = Math.max(0, firstVisible - VIRTUAL_OVERSCAN)
  const end = Math.min(total, start + VIRTUAL_VISIBLE_ROWS + VIRTUAL_OVERSCAN * 2)
  return {
    items: rows.slice(start, end).map((row, offset) => ({row, index: start + offset})),
    start,
    end
  }
}

function handleDataGridScroll(event) {
  dataGridScrollTop.value = event.target.scrollTop
}

function resetGridScroll(kind) {
  if (kind === 'result') {
    resetResultGridScroll()
  }
  if (kind === 'data') {
    dataGridScrollTop.value = 0
    nextTick(() => {
      dataTableViewRef.value?.scrollToTop()
    })
  }
}

function openTableContextMenu(profileId, database, table, event) {
  const viewportWidth = window.innerWidth || 0
  const viewportHeight = window.innerHeight || 0
  const menuHeight = Math.min(CONTEXT_MENU_MAX_HEIGHT, viewportHeight - 16)
  let x = event.clientX
  let y = event.clientY
  if (x + CONTEXT_MENU_WIDTH + 8 > viewportWidth) x = Math.max(8, event.clientX - CONTEXT_MENU_WIDTH)
  if (y + menuHeight + 8 > viewportHeight) y = Math.max(8, viewportHeight - menuHeight - 8)
  contextMenu.value = {open: true, x, y, profileId, database, table}
  addLog('debug', 'Open table context menu', logContext({profileId, database, table}))
}

function closeContextMenu() {
  contextMenu.value.open = false
}

function contextTableInfo() {
  return {profileId: contextMenu.value.profileId, database: contextMenu.value.database, table: contextMenu.value.table}
}

function copyQualifiedTableName() {
  const {database, table} = contextTableInfo()
  copyText(`\`${database}\`.\`${table}\``, '表名')
  closeContextMenu()
}

function openContextTableData() {
  const {profileId, database, table} = contextTableInfo()
  selectTable(table, database, profileId)
  closeContextMenu()
}

function openContextTableStructure(type) {
  const {profileId, database, table} = contextTableInfo()
  selectTableObject(type, table, database, profileId)
  closeContextMenu()
}

async function insertContextSqlTemplate(type) {
  const {profileId, database, table} = contextTableInfo()
  await loadTableMetadata(profileId, database, table)
  insertSqlTemplate(type, database, table, profileId)
  closeContextMenu()
}

async function insertContextDdlTemplate(type) {
  const {profileId, database, table} = contextTableInfo()
  await loadTableMetadata(profileId, database, table)
  insertDdlTemplate(type, database, table, profileId)
  closeContextMenu()
}

function openConsoleTab() {
  const profileId = selectedProfileId.value || activeProfileId.value
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

function insertDdlTemplate(type, database = selectedDatabase.value, tableName = selectedTable.value, profileId = activeProfileId.value) {
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
  query.value = templateMap[type] || query.value
  openConsoleTab()
  addLog('info', 'Insert DDL template', logContext({type, database, table: tableName}))
}

function chooseFilterColumn(value) {
  chooseFilterColumnValue(value, closeCustomSelect)
}

function chooseFilterOperator(value) {
  chooseFilterOperatorValue(value, closeCustomSelect)
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text)
    setMessage(`${label}已复制`, 'success', logContext())
  } catch (error) {
    setMessage(errorMessage(error), 'error', logContext({operation: 'copy'}))
  }
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], {type})
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function toggleCustomSelect(id) {
  openSelectId.value = openSelectId.value === id ? '' : id
}

function closeCustomSelect() {
  openSelectId.value = ''
}

function chooseDatabase(value) {
  selectedDatabase.value = value
  closeCustomSelect()
}

function choosePageSize(value) {
  chooseTablePageSize(value, closeCustomSelect)
}

function chooseHistory(value) {
  chooseQueryHistory(value, closeCustomSelect)
}

function chooseTableOrderBy(value) {
  chooseTableOrderByValue(value, closeCustomSelect)
}

function chooseTableOrderDir(value) {
  chooseTableOrderDirValue(value, closeCustomSelect)
}

function chooseLogLevel(value) {
  logLevelFilter.value = value
  closeCustomSelect()
}

function closeSurfaceOverlays() {
  closeContextMenu()
  closeCustomSelect()
}

function preventNativeContextMenu(event) {
  const target = event.target
  if (target?.closest?.('[data-native-context]')) return
  event.preventDefault()
}

function preventChromeTextSelection(event) {
  const target = event.target
  if (target?.closest?.('input, textarea, [contenteditable="true"], [data-native-context], [data-allow-select], .ddl-view, .console-output')) return
  event.preventDefault()
}

function setMessage(value, level = 'info', context = logContext()) {
  message.value = value
  addLog(level, value, context)
}

function askConfirm(title, body, action = '确认') {
  addLog('warn', 'Open confirmation dialog', logContext({title, action}))
  confirmDialog.value = {title, body, action}
  confirmDialogOpen.value = true
  return new Promise((resolve) => {
    confirmResolve = resolve
  })
}

function resolveConfirm(value) {
  confirmDialogOpen.value = false
  addLog(value ? 'warn' : 'debug', value ? 'Confirm dialog accepted' : 'Confirm dialog cancelled', logContext({title: confirmDialog.value.title}))
  if (confirmResolve) {
    confirmResolve(value)
    confirmResolve = null
  }
}

function errorMessage(error) {
  return error?.message || String(error)
}

</script>

<template>
  <div class="ide-shell" :style="{gridTemplateColumns: shellColumns}" @click="closeSurfaceOverlays">
    <DatabaseExplorer
      :profiles="profiles"
      :busy="busy"
      :selected-profile="selectedProfile"
      :selected-profile-id="selectedProfileId"
      :active-profile-id="activeProfileId"
      :active-connection="activeConnection"
      :selected-database="selectedDatabase"
      :selected-table="selectedTable"
      :current-tab="currentTab"
      :table-metadata="tableMetadata"
      :is-profile-connected="isProfileConnected"
      :is-expanded="isExpanded"
      :get-connection-state="getConnectionState"
      :table-count="tableCount"
      :table-list="tableList"
      :metadata-key="metadataKey"
      @new-profile="openNewProfileDialog"
      @refresh-tables="refreshTables"
      @edit-profile="openEditProfileDialog"
      @connect="connectSelected"
      @disconnect="disconnect"
      @remove-profile="removeProfile"
      @open-console="openConsoleTab"
      @open-data="openDataTab"
      @select-profile="selectProfile"
      @toggle-expanded="toggleExpanded"
      @select-database="selectDatabase"
      @toggle-database="toggleDatabase"
      @toggle-tables="toggleTables"
      @select-table="selectTable"
      @open-table-context-menu="openTableContextMenu"
      @select-table-object="selectTableObject"
    />
    <div
      class="resize-handle vertical explorer-resizer"
      title="Drag to resize Database Explorer"
      @mousedown="beginResize('explorer', $event)"
      @dblclick="resetPaneSize('explorer')"
    ></div>

    <main class="ide-main" :style="{gridTemplateRows: mainRows}">
      <EditorTabs
        :open-tabs="openTabs"
        :active-tab-id="activeTabId"
        :active-connection="activeConnection"
        :connected-label="connectedLabel"
        :tab-title="tabTitle"
        @activate-tab="activateTab"
        @close-tab="closeTab"
      />

      <MainToolbar
        :busy="busy"
        :selected-profile="selectedProfile"
        :active-connection="activeConnection"
        :open-select-id="openSelectId"
        :database-options="databaseOptions"
        :selected-database="selectedDatabase"
        :selected-table="selectedTable"
        :table-page="tableData.page"
        :selected-row="selectedRow"
        :selected-rows-count="selectedRowsCount"
        :can-edit-selected-row="canEditSelectedRow"
        :can-delete-selected-row="canDeleteSelectedRow"
        :active-profile-id="activeProfileId"
        :page-size-options="pageSizeOptions"
        :page-size="tableData.pageSize"
        @run-or-connect="activeConnection.status.connected ? runQuery() : connectSelected()"
        @disconnect="disconnect"
        @edit-profile="openEditProfileDialog"
        @toggle-select="toggleCustomSelect"
        @choose-database="chooseDatabase"
        @load-table-page="loadTablePage"
        @open-insert-row="openInsertRow"
        @edit-selected-row="editSelectedRow"
        @delete-selected-row="deleteSelectedRow"
        @select-table-object="selectTableObject"
        @choose-page-size="choosePageSize"
      />

      <section class="editor-area">
        <div v-if="currentTab?.kind === 'query'" class="query-surface" :style="{gridTemplateRows: queryRows}">
          <SqlEditorToolbar
            ref="queryToolbarRef"
            :selected-database="selectedDatabase"
            :busy="busy"
            :running-query-id="runningQueryId"
            @run="runQuery"
            @cancel="cancelRunningQuery"
            @explain="explainQuery"
            @open-sql="openSqlFile"
          />
          <div class="query-workspace">
            <div class="query-main-stack" :style="{gridTemplateRows: queryMainRows}">
              <SqlTextEditor
                ref="queryEditorRef"
                v-model="query"
                @keydown="handleQueryKeydown"
                @selection-change="syncQuerySelection"
              />
              <div
                class="resize-handle horizontal query-result-resizer"
                title="Drag to resize SQL results"
                @mousedown="beginResize('queryResult', $event)"
                @dblclick="resetPaneSize('queryResult')"
              ></div>
              <SqlResultPane
                ref="sqlResultPaneRef"
                :result-tabs="resultTabs"
                :active-result-tab-id="activeResultTabId"
                :active-result-tab="activeResultTab"
                :virtual-result-rows="virtualResultRows"
                :result-top-spacer-height="resultTopSpacerHeight"
                :result-bottom-spacer-height="resultBottomSpacerHeight"
                :result-grid-colspan="resultGridColspan"
                :compact-sql="compactSql"
                @activate-tab="activeResultTabId = $event"
                @close-tab="closeResultTab"
                @copy-rows="copySqlResultRows(copyText)"
                @export-csv="exportSqlResultCsv(downloadText)"
                @export-json="exportSqlResultJson(downloadText)"
                @open-row-detail="openResultDetail"
                @scroll="handleResultGridScroll"
              />
            </div>
            <SqlSidePanel
              v-model:history-search="historySearch"
              :selected-table="selectedTable"
              :saved-history-item="savedHistoryItem"
              :saved-query-history="savedQueryHistory"
              :recent-query-history="recentQueryHistory"
              :selected-history-id="selectedHistoryId"
              :history-option-label="historyOptionLabel"
              @format="formatQuery"
              @insert-template="insertSqlTemplate"
              @toggle-saved="toggleSavedHistory"
              @clear-recent="clearRecentHistory"
              @choose-history="chooseHistory"
            />
          </div>
        </div>

        <StructureView
          v-else-if="currentTab?.kind === 'structure'"
          :current-tab="currentTab"
          :selected-table="selectedTable"
          :selected-object="selectedObject"
          :structure-title="structureTitle"
          :structure-columns="structureColumns"
          :structure-rows="structureRows"
          :selected-ddl="selectedDDL"
          @insert-ddl-template="insertDdlTemplate"
        />

        <DataTableView
          v-else-if="currentTab?.kind === 'data'"
          ref="dataTableViewRef"
          v-model:table-where="tableWhere"
          :selected-table="selectedTable"
          :table-data="tableData"
          :open-select-id="openSelectId"
          :order-by-options="orderByOptions"
          :table-order-by="tableOrderBy"
          :order-dir-options="orderDirOptions"
          :table-order-dir="tableOrderDir"
          :selected-row="selectedRow"
          :selected-rows-count="selectedRowsCount"
          :can-edit-selected-row="canEditSelectedRow"
          :can-delete-selected-row="canDeleteSelectedRow"
          :total-pages="totalPages"
          :virtual-data-rows="virtualDataRows"
          :data-top-spacer-height="dataTopSpacerHeight"
          :data-bottom-spacer-height="dataBottomSpacerHeight"
          :data-grid-colspan="dataGridColspan"
          :can-mutate-rows="canMutateRows"
          :column-width="columnWidth"
          :is-selected-data-row="isSelectedDataRow"
          @clear-selection="clearDataRowSelection"
          @open-filter-dialog="openFilterDialog"
          @toggle-select="toggleCustomSelect"
          @choose-order-by="chooseTableOrderBy"
          @choose-order-dir="chooseTableOrderDir"
          @apply-filter="applyTableFilter"
          @clear-filter="clearTableFilter"
          @open-insert-row="openInsertRow"
          @open-csv-import-preview="openCsvImportPreview"
          @edit-selected-row="editSelectedRow"
          @delete-selected-row="deleteSelectedRow"
          @copy-selected-row="copySelectedRow"
          @copy-visible-rows="copyVisibleRows"
          @export-visible-csv="exportVisibleCsv"
          @export-visible-json="exportVisibleJson"
          @load-table-page="loadTablePage"
          @scroll="handleDataGridScroll"
          @begin-column-resize="beginColumnResize"
          @select-data-row="selectDataRow"
          @open-edit-row="openEditRow"
          @delete-row="deleteRow"
        />

        <div v-else class="empty-workspace">
          <span>Open a table, structure node, or SQL console from Database Explorer.</span>
        </div>
      </section>

      <ServicesPanel
        ref="servicesPanelRef"
        v-model:log-search="logSearch"
        :services-columns="servicesColumns"
        :open-select-id="openSelectId"
        :log-level-options="logLevelOptions"
        :log-level-filter="logLevelFilter"
        :visible-logs="visibleLogs"
        :selected-table="selectedTable"
        :table-page="tableData.page"
        :selected-profile="selectedProfile"
        :log-context-summary="logContextSummary"
        :log-sql="logSql"
        :compact-sql="compactSql"
        @resize-services="beginResize('services', $event)"
        @reset-services="resetPaneSize('services')"
        @toggle-select="toggleCustomSelect"
        @choose-log-level="chooseLogLevel"
        @copy-visible-logs="copyVisibleLogs"
        @export-visible-logs-csv="exportVisibleLogsCsv"
        @export-visible-logs-json="exportVisibleLogsJson"
        @clear-logs="clearLogs"
        @load-table-page="loadTablePage"
        @resize-services-tree="beginResize('servicesTree', $event)"
        @reset-services-tree="resetPaneSize('servicesTree')"
      />

      <footer class="statusbar">
        <span>Database</span>
        <span>›</span>
        <span>{{ selectedProfile?.name || '@localhost' }}</span>
        <span v-if="selectedDatabase">› {{ selectedDatabase }}</span>
        <span v-if="selectedTable">› {{ selectedTable }}</span>
        <span class="statusbar-fill"></span>
        <span v-if="latestLog">{{ latestLog.level }}: {{ latestLog.text }}</span>
        <span>{{ tableData.rows?.length || 0 }} rows</span>
        <span>UTF-8</span>
        <span>4 spaces</span>
      </footer>
    </main>

    <div v-if="profileDialogOpen" class="dialog-backdrop">
      <form class="dialog connection-dialog" @submit.prevent="saveProfile">
        <header>
          <div class="dialog-title">
            <h2>{{ editingProfileId ? '编辑服务器' : '新增服务器' }}</h2>
            <span>{{ draftProfile.user || 'user' }}@{{ draftProfile.host || 'host' }}:{{ draftProfile.port || '3306' }}</span>
          </div>
          <button type="button" class="icon-close" @click="profileDialogOpen = false">×</button>
        </header>

        <div class="dialog-body split-dialog-body">
          <aside class="dialog-tabs">
            <button type="button" :class="{active: profileDialogTab === 'general'}" @click="profileDialogTab = 'general'">常规</button>
            <button type="button" :class="{active: profileDialogTab === 'ssh'}" @click="profileDialogTab = 'ssh'">SSH</button>
            <button type="button" :class="{active: profileDialogTab === 'advanced'}" @click="profileDialogTab = 'advanced'">高级</button>
          </aside>

          <section class="dialog-pane">
            <div v-if="profileDialogTab === 'general'" class="dialog-section">
              <h3>MySQL 连接</h3>
              <p>配置服务器地址、账号和默认数据库。密码可选择保存到系统钥匙串。</p>
              <div class="form-grid">
                <label class="field"><span>连接名称</span><input v-model="draftProfile.name" required data-native-context></label>
                <label class="field"><span>默认数据库</span><input v-model="draftProfile.database" placeholder="可选" data-native-context></label>
                <label class="field"><span>主机</span><input v-model="draftProfile.host" required data-native-context></label>
                <label class="field"><span>端口</span><input v-model="draftProfile.port" required data-native-context></label>
                <label class="field"><span>用户</span><input v-model="draftProfile.user" required data-native-context></label>
                <label class="field"><span>密码</span><input v-model="draftProfile.password" type="password" autocomplete="new-password" data-native-context></label>
              </div>
              <label class="check-row">
                <input v-model="draftProfile.rememberPassword" type="checkbox" data-native-context>
                <span>保存 MySQL 密码到系统钥匙串</span>
              </label>
            </div>

            <div v-if="profileDialogTab === 'ssh'" class="dialog-section">
              <h3>SSH 隧道</h3>
              <p>需要通过跳板机访问 MySQL 时启用。可以使用 SSH 密码或私钥路径。</p>
              <label class="check-row enable-row">
                <input v-model="draftProfile.ssh.enabled" type="checkbox" data-native-context>
                <span>通过 SSH 连接</span>
              </label>
              <div class="form-grid" :class="{muted: !draftProfile.ssh.enabled}">
                <label class="field"><span>SSH 主机</span><input v-model="draftProfile.ssh.host" :disabled="!draftProfile.ssh.enabled" data-native-context></label>
                <label class="field"><span>SSH 端口</span><input v-model="draftProfile.ssh.port" :disabled="!draftProfile.ssh.enabled" data-native-context></label>
                <label class="field"><span>SSH 用户</span><input v-model="draftProfile.ssh.user" :disabled="!draftProfile.ssh.enabled" data-native-context></label>
                <label class="field"><span>SSH 密码</span><input v-model="draftProfile.ssh.password" :disabled="!draftProfile.ssh.enabled" type="password" data-native-context></label>
                <label class="field wide">
                  <span>私钥路径</span>
                  <div class="input-row">
                    <input v-model="draftProfile.ssh.privateKeyPath" :disabled="!draftProfile.ssh.enabled" placeholder="~/.ssh/id_rsa" data-native-context>
                    <button type="button" :disabled="!draftProfile.ssh.enabled" @click="choosePrivateKeyPath">选择</button>
                  </div>
                </label>
                <label class="field"><span>私钥口令</span><input v-model="draftProfile.ssh.passphrase" :disabled="!draftProfile.ssh.enabled" type="password" data-native-context></label>
                <label class="check-row"><input v-model="draftProfile.ssh.rememberPassword" :disabled="!draftProfile.ssh.enabled" type="checkbox" data-native-context><span>保存 SSH 密码</span></label>
                <label class="check-row"><input v-model="draftProfile.ssh.rememberPassphrase" :disabled="!draftProfile.ssh.enabled" type="checkbox" data-native-context><span>保存私钥口令</span></label>
              </div>
            </div>

            <div v-if="profileDialogTab === 'advanced'" class="dialog-section">
              <h3>高级选项</h3>
              <p>调整连接建立和连接池参数。保存后下次连接生效。</p>
              <div class="form-grid">
                <label class="field">
                  <span>连接超时（秒）</span>
                  <input v-model.number="draftProfile.advanced.connectTimeoutSeconds" min="1" max="120" type="number" data-native-context>
                </label>
                <label class="field">
                  <span>最大连接数</span>
                  <input v-model.number="draftProfile.advanced.maxOpenConns" min="1" max="128" type="number" data-native-context>
                </label>
                <label class="field">
                  <span>空闲连接数</span>
                  <input v-model.number="draftProfile.advanced.maxIdleConns" min="0" max="128" type="number" data-native-context>
                </label>
                <div class="advanced-list">
                  <div><span>密码存储</span><strong>系统钥匙串</strong></div>
                  <div><span>字符集</span><strong>utf8mb4</strong></div>
                </div>
              </div>
            </div>

            <div v-if="testConnectionState.message" :class="['test-status', testConnectionState.status]">
              {{ testConnectionState.message }}
            </div>
          </section>
        </div>

        <footer>
          <button type="button" class="ghost" :disabled="testConnectionState.status === 'testing'" @click="testDraftConnection">测试连接</button>
          <span class="dialog-footer-spacer"></span>
          <button type="button" class="ghost" @click="profileDialogOpen = false">取消</button>
          <button class="primary" type="submit">保存</button>
        </footer>
      </form>
    </div>

    <div v-if="editDialogOpen" class="dialog-backdrop">
      <form class="dialog compact-dialog row-dialog" @submit.prevent="saveRow">
        <header>
          <div class="dialog-title">
            <h2>编辑行</h2>
            <span>{{ selectedDatabase }}.{{ selectedTable }} · 主键字段只读</span>
          </div>
          <button type="button" class="icon-close" @click="editDialogOpen = false">×</button>
        </header>
        <div class="row-editor-summary">
          <span>{{ tableData.columns.length }} 个字段</span>
          <span>{{ tableData.primaryKeys.length }} 个主键</span>
          <span>保存后会立即写入数据库</span>
        </div>
        <div class="dialog-body row-editor">
          <div
            v-for="column in tableData.columns"
            :key="column.name"
            class="field row-field"
            :class="{'is-primary': isPrimaryKeyColumn(column), 'is-null': editNulls[column.name], 'is-long': isLongTextColumn(column)}"
          >
            <span class="field-heading">
              <span class="field-name">{{ column.name }}</span>
              <span class="field-meta">
                <span v-if="isPrimaryKeyColumn(column)" class="field-badge key-badge">PRIMARY</span>
                <span class="field-type">{{ column.type }}</span>
              </span>
            </span>
            <label v-if="isNullableColumn(column)" class="null-toggle" :class="{active: editNulls[column.name], disabled: isPrimaryKeyColumn(column)}">
              <input v-model="editNulls[column.name]" type="checkbox" :disabled="isPrimaryKeyColumn(column)" data-native-context>
              <span>NULL</span>
            </label>
            <textarea
              v-if="isLongTextColumn(column)"
              v-model="editValues[column.name]"
              :disabled="isPrimaryKeyColumn(column) || editNulls[column.name]"
              rows="4"
              data-native-context
            ></textarea>
            <input v-else v-model="editValues[column.name]" :disabled="isPrimaryKeyColumn(column) || editNulls[column.name]" data-native-context>
          </div>
        </div>
        <footer>
          <button type="button" class="ghost" @click="editDialogOpen = false">取消</button>
          <button class="primary" type="submit">保存修改</button>
        </footer>
      </form>
    </div>

    <div v-if="insertDialogOpen" class="dialog-backdrop">
      <form class="dialog compact-dialog row-dialog" @submit.prevent="saveInsertRow">
        <header>
          <div class="dialog-title">
            <h2>新增行</h2>
            <span>{{ selectedDatabase }}.{{ selectedTable }} · 自增字段已跳过</span>
          </div>
          <button type="button" class="icon-close" @click="insertDialogOpen = false">×</button>
        </header>
        <div class="row-editor-summary">
          <span>{{ tableData.columns.filter((item) => !String(item.extra || '').includes('auto_increment')).length }} 个可填写字段</span>
          <span>保存后会立即写入数据库</span>
        </div>
        <div class="dialog-body row-editor">
          <div
            v-for="column in tableData.columns.filter((item) => !String(item.extra || '').includes('auto_increment'))"
            :key="column.name"
            class="field row-field"
            :class="{'is-null': insertNulls[column.name], 'is-long': isLongTextColumn(column)}"
          >
            <span class="field-heading">
              <span class="field-name">{{ column.name }}</span>
              <span class="field-meta">
                <span v-if="column.default !== null && column.default !== undefined" class="field-badge">默认 {{ column.default }}</span>
                <span class="field-type">{{ column.type }}</span>
              </span>
            </span>
            <label v-if="isNullableColumn(column)" class="null-toggle" :class="{active: insertNulls[column.name]}">
              <input v-model="insertNulls[column.name]" type="checkbox" data-native-context>
              <span>NULL</span>
            </label>
            <textarea
              v-if="isLongTextColumn(column)"
              v-model="insertValues[column.name]"
              :disabled="insertNulls[column.name]"
              :placeholder="column.type"
              rows="4"
              data-native-context
            ></textarea>
            <input v-else v-model="insertValues[column.name]" :disabled="insertNulls[column.name]" :placeholder="column.type" data-native-context>
          </div>
        </div>
        <footer>
          <button type="button" class="ghost" @click="insertDialogOpen = false">取消</button>
          <button class="primary" type="submit">插入</button>
        </footer>
      </form>
    </div>

    <ConfirmDialog
      :open="confirmDialogOpen"
      :dialog="confirmDialog"
      @resolve="resolveConfirm"
    />

    <FilterDialog
      :open="filterDialogOpen"
      :database="selectedDatabase"
      :table="selectedTable"
      :draft="filterDraft"
      :column-options="filterColumnOptions"
      :operator-options="filterOperatorOptions"
      :open-select-id="openSelectId"
      :build-filter-condition="buildFilterCondition"
      @close="filterDialogOpen = false"
      @submit="applyFilterBuilder"
      @toggle-select="toggleCustomSelect"
      @choose-column="chooseFilterColumn"
      @choose-operator="chooseFilterOperator"
    />

    <ResultDetailDialog
      :open="resultDetailOpen"
      :detail="resultDetail"
      @close="resultDetailOpen = false"
    />

    <ImportCsvDialog
      :open="importDialogOpen"
      :database="selectedDatabase"
      :table="selectedTable"
      :preview="importPreview"
      :busy="busy"
      @close="importDialogOpen = false"
      @confirm="confirmCsvImport"
    />

    <Teleport to="body">
      <div
        v-if="contextMenu.open"
        class="context-menu"
        :style="contextMenuStyle"
        @click.stop
        @contextmenu.prevent.stop
      >
        <button @click="openContextTableData">Open Data</button>
        <button @click="openContextTableStructure('columns')">Columns</button>
        <button @click="openContextTableStructure('indexes')">Indexes</button>
        <button @click="openContextTableStructure('ddl')">Show DDL</button>
        <button @click="copyQualifiedTableName">Copy Qualified Name</button>
        <button @click="insertContextSqlTemplate('select')">Generate SELECT</button>
        <button @click="insertContextSqlTemplate('insert')">Generate INSERT</button>
        <button @click="insertContextSqlTemplate('update')">Generate UPDATE</button>
        <button @click="insertContextSqlTemplate('delete')">Generate DELETE</button>
        <button @click="insertContextDdlTemplate('addColumn')">Add Column SQL</button>
        <button @click="insertContextDdlTemplate('createIndex')">Create Index SQL</button>
        <button @click="insertContextDdlTemplate('renameTable')">Rename Table SQL</button>
        <button class="danger-menu-item" @click="insertContextDdlTemplate('dropTable')">Drop Table SQL</button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  -webkit-user-select: none;
  user-select: none;
}

.ide-shell {
  --bg: #1f2023;
  --panel: #2b2d30;
  --panel-dark: #252629;
  --panel-darker: #1e1f22;
  --line: #3a3d41;
  --line-soft: #323539;
  --text: #c9ccd2;
  --muted: #8f949d;
  --blue: #4d8df7;
  --green: #4db363;
  --orange: #d19965;
  --pink: #cc78bc;
  display: grid;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--text);
  background: var(--bg);
  font-size: 13px;
  -webkit-user-select: none;
  user-select: none;
}

.ide-shell input,
.ide-shell textarea,
.ide-shell .ddl-view {
  -webkit-user-select: text;
  user-select: text;
}

.ide-shell button,
.ide-shell label,
.ide-shell header,
.ide-shell nav,
.ide-shell footer,
.ide-shell .tree-row,
.ide-shell .statusbar,
.ide-shell .floating-count {
  -webkit-user-select: none;
  user-select: none;
}

.ide-shell input,
.ide-shell textarea,
.ide-shell [data-native-context],
.ide-shell .ddl-view {
  -webkit-user-select: text;
  user-select: text;
}

:global(body.is-resizing) {
  cursor: col-resize;
  -webkit-user-select: none;
  user-select: none;
}

:global(body.is-resizing *) {
  -webkit-user-select: none;
  user-select: none;
}

.resize-handle {
  position: relative;
  z-index: 4;
  background: var(--line);
  transition: background 120ms ease;
}

.resize-handle:hover,
.resize-handle:active {
  background: #4d8df7;
}

.resize-handle.vertical {
  width: 6px;
  min-width: 6px;
  cursor: col-resize;
}

.resize-handle.horizontal {
  height: 6px;
  min-height: 6px;
  cursor: row-resize;
}

.explorer-resizer {
  height: 100%;
  background: #151619;
}

.window-actions,
.filter-row,
.pager,
.input-row,
.query-actions,
.statusbar {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-separator {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--line);
}

.toolbar-fill,
.statusbar-fill {
  flex: 1;
}

button,
input,
textarea {
  color: var(--text);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
}

button {
  min-height: 24px;
  padding: 0 8px;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: #373a3f;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.select-empty {
  padding: 8px;
  color: #7f8794;
  font-size: 12px;
  white-space: nowrap;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  min-width: 0;
  height: 25px;
  padding: 0 7px 0 4px;
  color: var(--text);
  text-align: left;
  white-space: nowrap;
  border-radius: 4px;
}

.tree-row.selected {
  color: #edf1f7;
  background: #454a52;
}

.tree-row.active-parent {
  color: #d8dce3;
  background: rgba(69, 74, 82, 0.42);
}

.tree-row:hover {
  background: #383b40;
}

.chevron,
.muted-row,
.toolbar-mode {
  color: var(--muted);
}

.db-icon,
.mysql-mark {
  color: #35a7e8;
}

.folder-icon {
  color: #67a8ff;
}

.table-icon {
  color: #b5c7dd;
}

.ide-main {
  display: grid;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--panel-darker);
}

.editor-area {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.query-surface {
  display: grid;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.query-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  min-height: 0;
  overflow: hidden;
}

.query-main-stack {
  display: grid;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 1040px) {
  .query-workspace {
    grid-template-columns: minmax(0, 1fr) 196px;
  }
}

.query-result-resizer {
  z-index: 3;
  background: #2a2d33;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.query-result-resizer:hover {
  background: #3a3f48;
}

.data-surface {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #1f2023;
}

.filter-row {
  height: 31px;
  padding: 0 10px;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
}

.filter-row button {
  min-height: 23px;
  padding: 0 7px;
  color: #aeb8c7;
  background: #2d3035;
  border-color: #3e434a;
}

.filter-row .danger-inline,
.context-menu .danger-menu-item {
  color: #ffb4aa;
}

.ddl-view {
  min-width: 100%;
  min-height: 100%;
  margin: 0;
  padding: 16px;
  overflow: auto;
  color: #cfd7e6;
  background: #1f2023;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 13px;
  line-height: 22px;
  white-space: pre;
}

.pager {
  margin-left: auto;
}

.grid-wrap {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  overflow: auto;
}

.data-grid {
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 13px;
}

.data-grid th,
.data-grid td {
  min-width: 150px;
  max-width: 360px;
  height: 27px;
  padding: 4px 8px;
  overflow: hidden;
  color: #c8ccd2;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-right: 1px solid #35383d;
  border-bottom: 1px solid #35383d;
}

.data-grid th {
  position: sticky;
  top: 0;
  z-index: 1;
  color: #b9bdc5;
  font-weight: 600;
  background: #2b2d30;
}

.data-grid tbody tr:hover td {
  background: #262a30;
}

.data-grid .virtual-spacer-row td {
  height: auto;
  min-width: 0;
  max-width: none;
  padding: 0;
  background: #1f2023;
  border-right: 0;
  border-bottom: 0;
}

.data-grid .virtual-spacer-row:hover td {
  background: #1f2023;
}

.row-num {
  min-width: 44px !important;
  width: 44px;
  color: #727884 !important;
  text-align: right !important;
  background: #24262a;
}

.empty-state {
  display: grid;
  place-items: center;
  height: 100%;
  color: #6f7580;
}

.empty-workspace {
  display: grid;
  place-items: center;
  height: 100%;
  color: #6f7580;
  background: #1f2023;
}

.floating-count {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  padding: 7px 12px;
  color: #c9ccd2;
  background: #34373c;
  border: 1px solid #4a4e55;
  border-radius: 8px;
}

.context-menu {
  position: fixed;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 5px;
  color: #c9ccd2;
  background: #2b2d30;
  border: 1px solid #4a4e55;
  border-radius: 6px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
  overscroll-behavior: contain;
}

.context-menu button {
  justify-content: flex-start;
  width: 100%;
  min-height: 28px;
  color: #c9ccd2;
  text-align: left;
  border-color: transparent;
}

.context-menu button:hover {
  color: #ffffff;
  background: #373a3f;
}

.statusbar {
  padding: 0 10px;
  color: #a8adb6;
  background: var(--panel);
  border-top: 1px solid var(--line);
}

h2 {
  margin: 0;
  letter-spacing: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  color: #b7bcc5;
  font-size: 12px;
  font-weight: 700;
}

.field-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.field-name {
  min-width: 0;
  overflow: hidden;
  color: #c7ccd5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-meta {
  display: inline-flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.field-type {
  min-width: 0;
  overflow: hidden;
  color: #7f8792;
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-badge {
  flex: 0 0 auto;
  max-width: 130px;
  overflow: hidden;
  padding: 2px 6px;
  color: #aeb6c2;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #363a41;
  border: 1px solid #4a4e55;
  border-radius: 999px;
}

.key-badge {
  color: #d8e6ff;
  background: rgba(77, 141, 247, 0.18);
  border-color: rgba(77, 141, 247, 0.38);
}

.field-heading small {
  min-width: 0;
  overflow: hidden;
  color: #7f8792;
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field input,
.field textarea {
  width: 100%;
  min-height: 34px;
  padding: 7px 9px;
  color: #d7dae0;
  background: #1f2023;
  border: 1px solid #4a4e55;
  outline: none;
}

.field input:focus,
.field textarea:focus {
  border-color: #4d8df7;
  box-shadow: 0 0 0 1px rgba(77, 141, 247, 0.35);
}

.field input:disabled {
  color: #858b95;
  background: #282a2e;
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(10, 10, 12, 0.68);
  backdrop-filter: blur(3px);
  z-index: 10;
}

.dialog {
  display: flex;
  flex-direction: column;
  width: min(820px, 100%);
  max-height: min(760px, 92vh);
  overflow: hidden;
  color: #d7dae0;
  background: #2b2d30;
  border: 1px solid #4a4e55;
  border-radius: 8px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
}

.connection-dialog {
  width: min(880px, 100%);
}

.confirm-dialog {
  width: min(460px, 100%);
}

.compact-dialog {
  width: min(620px, 100%);
}

.row-dialog {
  width: min(820px, 100%);
}

.filter-dialog {
  width: min(620px, 100%);
}

.result-detail-dialog {
  width: min(760px, 100%);
}

.import-dialog {
  width: min(920px, 100%);
}

.dialog header,
.dialog footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: #2f3237;
  border-bottom: 1px solid #3f434a;
}

.dialog-title {
  min-width: 0;
}

.dialog-title h2,
.dialog-section h3 {
  margin: 0;
}

.dialog-title span {
  display: block;
  margin-top: 3px;
  color: #858b95;
  font-size: 12px;
  font-weight: 500;
}

.dialog footer {
  justify-content: flex-end;
  gap: 8px;
  background: #2f3237;
  border-top: 1px solid #3f434a;
  border-bottom: 0;
}

.dialog-footer-spacer {
  flex: 1;
}

.dialog-body {
  min-height: 0;
  padding: 18px;
  overflow: auto;
  background: #2b2d30;
}

.row-editor-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 18px;
  color: #a8afb9;
  font-size: 12px;
  background: #272a2f;
  border-bottom: 1px solid #3f434a;
}

.row-editor-summary span {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  background: #202226;
  border: 1px solid #3a3d44;
  border-radius: 999px;
}

.import-preview-grid {
  height: 360px;
  margin-top: 14px;
  border: 1px solid #3f434a;
}

.split-dialog-body {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 0;
  padding: 0;
}

.dialog-tabs {
  padding: 12px 8px;
  background: #25272b;
  border-right: 1px solid #3f434a;
}

.dialog-tabs button {
  justify-content: flex-start;
  width: 100%;
  height: 32px;
  margin-bottom: 4px;
  color: #aeb4be;
  text-align: left;
}

.dialog-tabs button.active {
  color: #eef2f8;
  background: #3b4658;
}

.dialog-pane {
  min-width: 0;
  padding: 18px;
  overflow: auto;
}

.dialog-section h3 {
  color: #edf1f7;
  font-size: 15px;
}

.dialog-section p {
  margin: 6px 0 16px;
  color: #8f949d;
  line-height: 1.5;
}

.form-grid.muted {
  opacity: 0.66;
}

.enable-row {
  margin: 0 0 16px;
}

.advanced-list {
  display: grid;
  gap: 8px;
}

.advanced-list div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #25272b;
  border: 1px solid #3f434a;
  border-radius: 6px;
}

.advanced-list span {
  color: #9aa3af;
}

.advanced-list strong {
  color: #d7dae0;
}

.test-status {
  margin-top: 16px;
  padding: 10px 12px;
  color: #cbd1db;
  background: #25272b;
  border: 1px solid #3f434a;
  border-radius: 6px;
}

.test-status.success {
  color: #d9f2dd;
  border-color: rgba(77, 179, 99, 0.45);
  background: rgba(77, 179, 99, 0.12);
}

.test-status.error {
  color: #ffccc7;
  border-color: rgba(244, 87, 82, 0.45);
  background: rgba(244, 87, 82, 0.12);
}

.test-status.testing {
  color: #cfe0ff;
  border-color: rgba(77, 141, 247, 0.45);
  background: rgba(77, 141, 247, 0.12);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.wide {
  grid-column: 1 / -1;
}

.input-row input {
  flex: 1;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  color: #c9ccd2;
  font-size: 13px;
}

.null-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: fit-content;
  min-height: 24px;
  padding: 2px 8px 2px 4px;
  color: #aeb4be;
  font-size: 12px;
  font-weight: 700;
  background: #24272c;
  border: 1px solid #3f434a;
  border-radius: 999px;
}

.null-toggle input {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  min-height: 14px;
  margin: 0;
  padding: 0;
  accent-color: #4d8df7;
}

.null-toggle.active {
  color: #d8e6ff;
  background: rgba(77, 141, 247, 0.16);
  border-color: rgba(77, 141, 247, 0.45);
}

.null-toggle.disabled {
  opacity: 0.55;
}

.check-row input {
  width: 16px;
  height: 16px;
}

.section-line {
  margin: 18px 0 14px;
  padding-top: 14px;
  border-top: 1px solid #3f434a;
}

.row-editor {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  padding: 12px 14px 14px;
}

.row-field {
  display: grid;
  grid-template-columns: minmax(160px, 220px) 84px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  min-height: 58px;
  padding: 8px 10px;
  background: #25272b;
  border: 1px solid #3b3f46;
  border-radius: 6px;
}

.row-field .field-heading {
  grid-column: 1;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 5px;
  min-width: 0;
  padding-top: 2px;
}

.row-field .field-meta {
  max-width: 100%;
}

.row-field.is-primary {
  background: #262b33;
  border-color: #465267;
}

.row-field.is-null input,
.row-field.is-null textarea {
  color: #7f8792;
  background: #202226;
}

.row-field > input,
.row-field > textarea {
  grid-column: 3;
  grid-row: 1;
  min-width: 0;
}

.row-field .null-toggle {
  grid-column: 2;
  grid-row: 1;
  margin-top: 3px;
}

.row-field textarea {
  min-height: 72px;
  resize: vertical;
}

.row-field.is-long {
  min-height: 96px;
}

.row-field input:disabled,
.row-field textarea:disabled {
  color: #858b95;
  background: #202226;
  border-color: #393d43;
  cursor: not-allowed;
}

.filter-builder {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.filter-preview {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  color: #8f949d;
  background: #202226;
  border: 1px solid #3f434a;
  border-radius: 6px;
}

.filter-preview code {
  color: #d7dae0;
  white-space: normal;
  word-break: break-word;
}

.result-detail-body {
  display: grid;
  gap: 10px;
}

.detail-field {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 10px 12px;
  background: #25272b;
  border: 1px solid #3f434a;
  border-radius: 6px;
}

.detail-field > span {
  min-width: 0;
  color: #9aa3af;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-field pre {
  max-height: 180px;
  margin: 0;
  overflow: auto;
  color: #d7dae0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}

.icon-close {
  width: 30px;
  min-height: 30px;
  padding: 0;
  font-size: 22px;
  line-height: 1;
  background: transparent;
  border-color: transparent;
}

.icon-close:hover {
  color: #ffffff;
  background: #3a3d41;
}

.confirm-copy {
  margin: 0;
  color: #c9ccd2;
  line-height: 1.6;
}

.primary {
  color: #ffffff;
  background: #365fbd;
  border-color: #4977d8;
}

.ghost {
  color: #d7dae0;
  background: #34373c;
  border-color: #4a4e55;
}

.danger-primary {
  color: #ffffff;
  background: #b83b45;
  border-color: #d45661;
}

@media (max-width: 900px) {
  .ide-shell {
    min-width: 720px;
  }

  .form-grid,
  .row-editor {
    grid-template-columns: 1fr;
  }
}
</style>
