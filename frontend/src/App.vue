<script setup>
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue'
import {
  BulkInsertRows,
  ChoosePrivateKeyPath,
  Connect,
  DeleteCredentials,
  DeleteTableRow,
  DisconnectProfile,
  Execute,
  GetTableData,
  InsertTableRow,
  ListColumns,
  ListDatabases,
  ListIndexes,
  ListTables,
  LoadCredentials,
  OpenCSVFile,
  OpenSQLFile,
  SaveCredentials,
  ShowCreateTable,
  Status,
  TestConnection,
  UpdateTableRow
} from '../wailsjs/go/main/App'

const STORAGE_KEY = 'mysql-gui.profiles'
const LAYOUT_KEY = 'mysql-gui.layout'
const QUERY_HISTORY_KEY = 'mysql-gui.queryHistory'

const hasRuntime = () => Boolean(window.go?.main?.App)
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

const emptyProfile = () => ({
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
})

const profiles = ref([])
const selectedProfileId = ref('')
const connectedProfileId = ref('')
const status = ref({connected: false})
const connectionStates = ref({})
const databases = ref([])
const tableCache = ref({})
const selectedDatabase = ref('')
const selectedTable = ref('')
const openTabs = ref([{id: 'console', kind: 'query', title: 'console'}])
const activeTabId = ref('console')
const selectedObject = ref({profileId: '', type: 'table', database: '', table: ''})
const busy = ref(false)
const message = ref('')
const operationLogs = ref([])
const consoleOutputRef = ref(null)
const logLevelFilter = ref('all')
const logSearch = ref('')
const contextMenu = ref({open: false, x: 0, y: 0, database: '', table: ''})
const openSelectId = ref('')

const profileDialogOpen = ref(false)
const draftProfile = ref(emptyProfile())
const editingProfileId = ref('')
const profileDialogTab = ref('general')
const testConnectionState = ref({status: 'idle', message: ''})

const query = ref('SELECT 1;')
const queryEditorRef = ref(null)
const queryHistory = ref([])
const selectedHistoryIndex = ref('')
const resultTabs = ref([])
const activeResultTabId = ref('')
const tableData = ref({columns: [], primaryKeys: [], rows: [], total: 0, page: 1, pageSize: 50})
const selectedRowIndex = ref(-1)
const tableWhere = ref('')
const tableOrderBy = ref('')
const tableOrderDir = ref('ASC')
const columnWidths = ref({})

const editDialogOpen = ref(false)
const editValues = ref({})
const editNulls = ref({})
const editKeys = ref({})
const insertDialogOpen = ref(false)
const insertValues = ref({})
const insertNulls = ref({})
const importDialogOpen = ref(false)
const importPreview = ref({columns: [], rows: [], total: 0})
const filterDialogOpen = ref(false)
const filterDraft = ref({column: '', operator: '=', value: '', value2: ''})
const resultDetailOpen = ref(false)
const resultDetail = ref({title: '', fields: []})
const suppressDatabaseWatch = ref(false)
const confirmDialogOpen = ref(false)
const confirmDialog = ref({title: '', body: '', action: '确认'})
let confirmResolve = null
const expandedTree = ref(new Set())
const tableMetadata = ref({})
const tableDDLs = ref({})
const explorerWidth = ref(360)
const servicesHeight = ref(240)
const servicesTreeWidth = ref(240)
let resizeState = null
let columnResizeState = null

const selectedProfile = computed(() => profiles.value.find((item) => item.id === selectedProfileId.value))
const activeProfileId = computed(() => currentTab.value?.profileId || selectedProfileId.value || connectedProfileId.value)
const activeConnection = computed(() => getConnectionState(activeProfileId.value))
const connectedLabel = computed(() => activeConnection.value.status.connected ? `${activeConnection.value.status.user}@${activeConnection.value.status.server}` : '未连接')
const totalPages = computed(() => Math.max(1, Math.ceil((tableData.value.total || 0) / tableData.value.pageSize)))
const canMutateRows = computed(() => tableData.value.primaryKeys?.length > 0)
const selectedRow = computed(() => selectedRowIndex.value >= 0 ? tableData.value.rows?.[selectedRowIndex.value] : null)
const selectedRowsCount = computed(() => selectedRow.value ? 1 : 0)
const canEditSelectedRow = computed(() => canMutateRows.value && Boolean(selectedRow.value))
const canDeleteSelectedRow = computed(() => canMutateRows.value && Boolean(selectedRow.value))
const currentColumnWidthKey = computed(() => `${activeProfileId.value}.${selectedDatabase.value}.${selectedTable.value}`)
const currentTab = computed(() => openTabs.value.find((tab) => tab.id === activeTabId.value))
const shellColumns = computed(() => `${explorerWidth.value}px 6px minmax(0, 1fr)`)
const mainRows = computed(() => `37px 34px minmax(0, 1fr) ${servicesHeight.value}px 24px`)
const servicesColumns = computed(() => `${servicesTreeWidth.value}px 6px minmax(0, 1fr)`)
const selectedMetadata = computed(() => tableMetadata.value[metadataKey(selectedObject.value.profileId, selectedObject.value.database, selectedObject.value.table)] || {columns: [], indexes: []})
const activeResultTab = computed(() => resultTabs.value.find((tab) => tab.id === activeResultTabId.value) || null)
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
const selectedDDL = computed(() => tableDDLs.value[metadataKey(selectedObject.value.profileId, selectedObject.value.database, selectedObject.value.table)] || '')
const latestLog = computed(() => operationLogs.value[operationLogs.value.length - 1])
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
const historyOptions = computed(() => [
  {label: 'Recent SQL', value: ''},
  ...queryHistory.value.map((item, index) => ({label: item.slice(0, 90), value: String(index)}))
])
const orderByOptions = computed(() => [
  {label: 'none', value: ''},
  ...tableData.value.columns.map((column) => ({label: column.name, value: column.name}))
])
const orderDirOptions = [
  {label: 'ASC', value: 'ASC'},
  {label: 'DESC', value: 'DESC'}
]
const filterColumnOptions = computed(() => tableData.value.columns.map((column) => ({label: `${column.name}  ${column.type}`, value: column.name})))
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
const logLevelOptions = [
  {label: 'All', value: 'all'},
  {label: 'Info', value: 'info'},
  {label: 'Success', value: 'success'},
  {label: 'Warn', value: 'warn'},
  {label: 'Error', value: 'error'},
  {label: 'Debug', value: 'debug'}
]
const visibleLogs = computed(() => {
  const query = logSearch.value.trim().toLowerCase()
  return operationLogs.value.filter((log) => {
    if (logLevelFilter.value !== 'all' && log.level !== logLevelFilter.value) return false
    if (!query) return true
    return `${log.time} ${log.level} ${log.text} ${logContextSummary(log.context)}`.toLowerCase().includes(query)
  })
})

onMounted(async () => {
  loadLayout()
  window.addEventListener('contextmenu', preventNativeContextMenu)
  window.addEventListener('selectstart', preventChromeTextSelection)
  addLog('info', 'Application started')
  queryHistory.value = loadQueryHistory()
  profiles.value = loadProfiles()
  if (profiles.value.length === 0) {
    profiles.value = [emptyProfile()]
    persistProfiles()
  }
  selectedProfileId.value = profiles.value[0]?.id || ''
  if (selectedProfileId.value) {
    setExpanded(true, 'server', selectedProfileId.value)
  }
  if (hasRuntime()) {
    status.value = await Status()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('contextmenu', preventNativeContextMenu)
  window.removeEventListener('selectstart', preventChromeTextSelection)
})

function loadLayout() {
  try {
    const layout = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}')
    explorerWidth.value = clamp(Number(layout.explorerWidth) || 360, 240, 620)
    servicesHeight.value = clamp(Number(layout.servicesHeight) || 240, 150, 520)
    servicesTreeWidth.value = clamp(Number(layout.servicesTreeWidth) || 240, 160, 520)
  } catch {
    persistLayout()
  }
}

function persistLayout() {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify({
    explorerWidth: explorerWidth.value,
    servicesHeight: servicesHeight.value,
    servicesTreeWidth: servicesTreeWidth.value
  }))
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function beginResize(kind, event) {
  event.preventDefault()
  resizeState = {
    kind,
    startX: event.clientX,
    startY: event.clientY,
    explorerWidth: explorerWidth.value,
    servicesHeight: servicesHeight.value,
    servicesTreeWidth: servicesTreeWidth.value
  }
  document.body.classList.add('is-resizing')
  document.body.style.cursor = kind === 'services' ? 'row-resize' : 'col-resize'
  window.addEventListener('mousemove', resizePane)
  window.addEventListener('mouseup', stopResize)
}

function resizePane(event) {
  if (!resizeState) return
  if (resizeState.kind === 'explorer') {
    explorerWidth.value = clamp(resizeState.explorerWidth + event.clientX - resizeState.startX, 240, 620)
  }
  if (resizeState.kind === 'services') {
    servicesHeight.value = clamp(resizeState.servicesHeight - (event.clientY - resizeState.startY), 150, 520)
  }
  if (resizeState.kind === 'servicesTree') {
    servicesTreeWidth.value = clamp(resizeState.servicesTreeWidth + event.clientX - resizeState.startX, 160, 520)
  }
}

function stopResize() {
  if (!resizeState) return
  resizeState = null
  document.body.classList.remove('is-resizing')
  document.body.style.cursor = ''
  window.removeEventListener('mousemove', resizePane)
  window.removeEventListener('mouseup', stopResize)
  persistLayout()
}

function resetPaneSize(kind) {
  if (kind === 'explorer') explorerWidth.value = 360
  if (kind === 'services') servicesHeight.value = 240
  if (kind === 'servicesTree') servicesTreeWidth.value = 240
  persistLayout()
}

watch(selectedDatabase, async (database) => {
  if (suppressDatabaseWatch.value) return
  selectedTable.value = ''
  selectedObject.value = {profileId: activeProfileId.value, type: 'database', database, table: ''}
  selectedRowIndex.value = -1
  tableData.value = {columns: [], primaryKeys: [], rows: [], total: 0, page: 1, pageSize: 50}
  if (database && getConnectionState(activeProfileId.value).status.connected) {
    await refreshTables(activeProfileId.value, database)
  }
})

watch(selectedTable, async (table) => {
  if (table) {
    await loadTableMetadata(activeProfileId.value, selectedDatabase.value, table)
    if (currentTab.value?.kind === 'data') {
      selectedObject.value = {profileId: activeProfileId.value, type: 'table', database: selectedDatabase.value, table}
      await loadTablePage(1)
    }
  }
})

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

function metadataKey(profileId, database, table) {
  return `${profileId || activeProfileId.value}.${database}.${table}`
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

async function toggleDatabase(profileId, database) {
  const willExpand = !isExpanded('database', profileId, database)
  setExpanded(willExpand, 'database', profileId, database)
  addLog('debug', willExpand ? 'Expand database node' : 'Collapse database node', logContext({profile: activeProfileName(profileId), database}))
  if (willExpand) {
    setExpanded(true, 'tables', profileId, database)
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
  setExpanded(true, 'tables', profileId, database)
  await refreshTables(profileId, database)
}

async function selectTable(table, database = selectedDatabase.value, profileId = activeProfileId.value) {
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
  setExpanded(true, 'table', profileId, database, selectedTable.value)
  await loadTableMetadata(profileId, database, selectedTable.value)
  openDataTab(profileId, database, selectedTable.value)
}

async function selectTableObject(type, tableName, database = selectedDatabase.value, profileId = activeProfileId.value) {
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

function addLog(level, text, context = {}) {
  const entry = {
    id: newId(),
    level,
    text,
    time: formatLogTime(new Date()),
    context
  }
  operationLogs.value = [...operationLogs.value.slice(-499), entry]
  nextTick(() => {
    if (consoleOutputRef.value) {
      consoleOutputRef.value.scrollTop = consoleOutputRef.value.scrollHeight
    }
  })
}

function clearLogs() {
  operationLogs.value = []
  addLog('info', 'Operation log cleared')
}

function copyVisibleLogs() {
  const lines = visibleLogs.value.map((log) => `[${log.time}] ${log.level.toUpperCase()} ${log.text} ${logContextSummary(log.context)}`.trim())
  copyText(lines.join('\n'), '操作日志')
}

function exportVisibleLogsJson() {
  if (!visibleLogs.value.length) return
  downloadText(`mysql-gui-logs-${Date.now()}.json`, JSON.stringify(visibleLogs.value, null, 2), 'application/json;charset=utf-8')
  addLog('success', 'Export visible logs JSON', logContext({rows: visibleLogs.value.length}))
}

function exportVisibleLogsCsv() {
  if (!visibleLogs.value.length) return
  const headers = ['time', 'level', 'text', 'context']
  const lines = [
    headers.join(','),
    ...visibleLogs.value.map((log) => [
      csvValue(log.time),
      csvValue(log.level),
      csvValue(log.text),
      csvValue(logContextSummary(log.context))
    ].join(','))
  ]
  downloadText(`mysql-gui-logs-${Date.now()}.csv`, lines.join('\n'), 'text/csv;charset=utf-8')
  addLog('success', 'Export visible logs CSV', logContext({rows: visibleLogs.value.length}))
}

function csvValue(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function logContextSummary(context) {
  return Object.entries(context || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join('  ')
}

function openTableContextMenu(profileId, database, table, event) {
  contextMenu.value = {open: true, x: event.clientX, y: event.clientY, profileId, database, table}
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

async function loadTableMetadata(profileId, database, table) {
  if (!database || !table) return
  const key = metadataKey(profileId, database, table)
  if (tableMetadata.value[key]) return
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
    return
  }
  const [columns, indexes] = await Promise.all([
    ListColumns(profileId, database, table),
    ListIndexes(profileId, database, table)
  ])
  tableMetadata.value = {
    ...tableMetadata.value,
    [key]: {columns, indexes}
  }
}

async function loadTableDDL(profileId, database, table) {
  if (!database || !table) return
  const key = metadataKey(profileId, database, table)
  if (tableDDLs.value[key]) return
  if (!hasRuntime()) {
    tableDDLs.value = {
      ...tableDDLs.value,
      [key]: `CREATE TABLE \`${table}\` (\n  \`id\` bigint NOT NULL AUTO_INCREMENT,\n  \`name\` varchar(120) DEFAULT NULL,\n  PRIMARY KEY (\`id\`)\n) ENGINE=InnoDB;`
    }
    return
  }
  try {
    const ddl = await ShowCreateTable(profileId, database, table)
    tableDDLs.value = {...tableDDLs.value, [key]: ddl}
    addLog('success', 'DDL loaded', logContext({database, table}))
  } catch (error) {
    setMessage(errorMessage(error), 'error', logContext({operation: 'showCreateTable', database, table}))
  }
}

function loadProfiles() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map(normalizeProfile) : []
  } catch {
    return []
  }
}

function normalizeProfile(profile) {
  const base = emptyProfile()
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
  draftProfile.value = emptyProfile()
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
  const connection = normalizeProfile(draftProfile.value)
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
  const nextProfile = normalizeProfile(draftProfile.value)
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
      setExpanded(true, 'tables', profileId, 'demo')
      setExpanded(true, 'table', profileId, 'demo', 'users')
      await loadTableMetadata(profileId, 'demo', 'users')
      await nextTick()
      suppressDatabaseWatch.value = false
      openDataTab(profileId, 'demo', 'users')
      setMessage('浏览器预览模式：后端连接在 Wails 客户端内可用', 'warn', logContext())
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
      setExpanded(true, 'tables', profileId, selectedDatabase.value)
      if (selectedTable.value) {
        setExpanded(true, 'table', profileId, selectedDatabase.value, selectedTable.value)
        await loadTableMetadata(profileId, selectedDatabase.value, selectedTable.value)
      }
    }
    await nextTick()
    suppressDatabaseWatch.value = false
    if (selectedDatabase.value && selectedTable.value) {
      openDataTab(profileId, selectedDatabase.value, selectedTable.value)
    }
    setMessage('连接成功', 'success', logContext({profileId, databases: nextDatabases.length}))
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

async function refreshTables(profileId = activeProfileId.value, database = selectedDatabase.value, force = false) {
  if (!database) return
  const state = getConnectionState(profileId)
  if (!force && state.tableCache[database]) return
  if (!hasRuntime()) return
  addLog('info', force ? 'Refresh tables' : 'Load tables', logContext({profileId, database}))
  try {
    const tables = await ListTables(profileId, database)
    updateConnectionState(profileId, {
      tableCache: {...getConnectionState(profileId).tableCache, [database]: tables}
    })
    addLog('success', 'Tables loaded', logContext({profileId, database, tables: tables.length}))
  } catch (error) {
    setMessage(errorMessage(error), 'error', logContext({operation: 'refreshTables', database}))
  }
}

async function runQuery() {
  await executeSql('query')
}

async function explainQuery() {
  await executeSql('explain')
}

async function executeSql(mode = 'query') {
  const sql = currentSqlText()
  if (!sql) {
    setMessage('SQL 为空', 'warn', logContext())
    return
  }
  if (mode === 'query' && isDangerousSql(sql) && !await askConfirm('确认执行 SQL', '检测到 UPDATE 或 DELETE 语句没有 WHERE 条件。这个操作可能影响整张表，确定继续执行？', '继续执行')) {
    addLog('warn', 'SQL execution cancelled by safety guard', logContext({sql: sql.slice(0, 180)}))
    return
  }
  const executableSql = mode === 'explain' ? explainSql(sql) : sql
  addQueryHistory(sql)
  const profileId = activeProfileId.value
  addLog('info', mode === 'explain' ? 'Explain SQL' : 'Execute SQL', logContext({profileId, database: selectedDatabase.value, sql: executableSql.slice(0, 180)}))
  busy.value = true
  try {
    if (!hasRuntime()) {
      appendResultTab({
        mode,
        sql: executableSql,
        result: {columns: mode === 'explain' ? ['id', 'select_type', 'table', 'type', 'rows', 'Extra'] : ['id', 'name'], rows: mode === 'explain' ? [[1, 'SIMPLE', 'users', 'ALL', 2, 'Using where']] : [[1, 'preview']], rowsAffected: 1, elapsedMs: 1, message: 'Preview result'}
      })
      setMessage('Preview result', 'success')
      return
    }
    const nextResult = await Execute(profileId, executableSql, selectedDatabase.value)
    appendResultTab({mode, sql: executableSql, result: nextResult})
    setMessage(nextResult.message || '执行完成', 'success', logContext({elapsedMs: nextResult.elapsedMs, rows: nextResult.rows?.length || 0, affected: nextResult.rowsAffected || 0}))
    if (selectedTable.value) await loadTablePage(tableData.value.page)
  } catch (error) {
    setMessage(errorMessage(error), 'error', logContext({operation: mode === 'explain' ? 'explain' : 'execute'}))
  } finally {
    busy.value = false
  }
}

function appendResultTab({mode, sql, result}) {
  const tab = {
    id: newId(),
    mode,
    title: `${mode === 'explain' ? 'Explain' : 'Result'} ${resultTabs.value.length + 1}`,
    sql,
    columns: result.columns || [],
    rows: result.rows || [],
    rowsAffected: result.rowsAffected || 0,
    elapsedMs: result.elapsedMs || 0,
    message: result.message || '',
    truncated: Boolean(result.truncated),
    createdAt: formatLogTime(new Date())
  }
  resultTabs.value = [...resultTabs.value.slice(-9), tab]
  activeResultTabId.value = tab.id
}

function closeResultTab(tabId, event) {
  event?.stopPropagation()
  const index = resultTabs.value.findIndex((tab) => tab.id === tabId)
  if (index === -1) return
  const wasActive = activeResultTabId.value === tabId
  const nextTabs = resultTabs.value.filter((tab) => tab.id !== tabId)
  resultTabs.value = nextTabs
  if (wasActive) {
    activeResultTabId.value = (nextTabs[index] || nextTabs[index - 1])?.id || ''
  }
}

function explainSql(sql) {
  const trimmed = sql.trim().replace(/;+\s*$/, '')
  if (/^EXPLAIN\b/i.test(trimmed)) return trimmed
  return `EXPLAIN ${trimmed}`
}

function currentSqlText() {
  const editor = queryEditorRef.value
  const start = editor?.selectionStart ?? 0
  const end = editor?.selectionEnd ?? 0
  const selected = start !== end ? query.value.slice(start, end).trim() : ''
  if (selected) return selected
  return currentStatementAt(query.value, start) || query.value.trim()
}

function currentStatementAt(sql, cursorIndex = 0) {
  const spans = statementSpans(sql)
  const cursor = Math.max(0, Math.min(cursorIndex, sql.length))
  const containing = spans.find((span) => cursor >= span.start && cursor <= span.end)
  if (containing) return sql.slice(containing.start, containing.end).trim()
  const next = spans.find((span) => span.start > cursor)
  return next ? sql.slice(next.start, next.end).trim() : ''
}

function statementSpans(sql) {
  const spans = []
  let statementStart = 0
  let quote = ''
  let lineComment = false
  let blockComment = false

  const closeStatement = (end) => {
    const raw = sql.slice(statementStart, end)
    const offset = raw.search(/\S/)
    if (offset !== -1) {
      const start = statementStart + offset
      let trimmedEnd = end
      while (trimmedEnd > start && /\s/.test(sql[trimmedEnd - 1])) trimmedEnd -= 1
      spans.push({start, end: trimmedEnd})
    }
    statementStart = end + 1
  }

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    const next = sql[index + 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (char === '\\') {
        index += 1
      } else if (char === quote) {
        if (next === quote) {
          index += 1
        } else {
          quote = ''
        }
      }
      continue
    }
    if ((char === '-' && next === '-') || char === '#') {
      lineComment = true
      if (char === '-') index += 1
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char
      continue
    }
    if (char === ';') closeStatement(index)
  }
  closeStatement(sql.length)
  return spans
}

function addQueryHistory(sql) {
  const normalized = sql.trim()
  if (!normalized) return
  queryHistory.value = [normalized, ...queryHistory.value.filter((item) => item !== normalized)].slice(0, 30)
  selectedHistoryIndex.value = ''
  persistQueryHistory()
}

function loadQueryHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUERY_HISTORY_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, 30) : []
  } catch {
    return []
  }
}

function persistQueryHistory() {
  localStorage.setItem(QUERY_HISTORY_KEY, JSON.stringify(queryHistory.value.slice(0, 30)))
}

function isDangerousSql(sql) {
  const normalized = sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
  return /^(UPDATE|DELETE)\b/.test(normalized) && !/\bWHERE\b/.test(normalized)
}

function applyQueryHistory() {
  if (selectedHistoryIndex.value === '') return
  const item = queryHistory.value[Number(selectedHistoryIndex.value)]
  if (item) {
    query.value = item
    addLog('debug', 'Load SQL from history', logContext())
  }
}

async function openSqlFile() {
  if (!hasRuntime()) {
    setMessage('当前是浏览器预览，打开 SQL 文件需要在 Wails 客户端中使用', 'warn')
    return
  }
  try {
    const content = await OpenSQLFile()
    if (!content) return
    query.value = content
    openConsoleTab()
    addLog('success', 'SQL file opened', logContext({chars: content.length}))
    setMessage('SQL 文件已打开', 'success')
  } catch (error) {
    setMessage(errorMessage(error), 'error', logContext({operation: 'openSqlFile'}))
  }
}

function formatQuery() {
  const formatted = query.value
    .replace(/\s+/g, ' ')
    .replace(/\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|LEFT JOIN|RIGHT JOIN|INNER JOIN|JOIN|ON)\b/gi, '\n$1')
    .replace(/,\s*/g, ',\n  ')
    .replace(/^\n/, '')
    .trim()
  query.value = formatted
  addLog('debug', 'Format SQL', logContext())
}

function insertSqlTemplate(type, database = selectedDatabase.value, tableName = selectedTable.value, profileId = activeProfileId.value) {
  if (!database || !tableName) return
  const table = `\`${database}\`.\`${tableName}\``
  const metadata = tableMetadata.value[metadataKey(profileId, database, tableName)]
  const sourceColumns = database === selectedDatabase.value && tableName === selectedTable.value && tableData.value.columns.length
    ? tableData.value.columns
    : (metadata?.columns || [])
  const primaryKeys = sourceColumns.filter((column) => column.key === 'PRI').map((column) => column.name)
  const columns = sourceColumns.map((column) => `\`${column.name}\``)
  const templateMap = {
    select: `SELECT ${columns.length ? columns.join(', ') : '*'}\nFROM ${table}\nLIMIT 100;`,
    insert: `INSERT INTO ${table} (${columns.join(', ')})\nVALUES (${columns.map(() => '?').join(', ')});`,
    update: `UPDATE ${table}\nSET ${columns[0] || '`column`'} = ?\nWHERE ${primaryKeys.map((key) => `\`${key}\` = ?`).join(' AND ') || '1 = 0'};`,
    delete: `DELETE FROM ${table}\nWHERE ${primaryKeys.map((key) => `\`${key}\` = ?`).join(' AND ') || '1 = 0'}\nLIMIT 1;`
  }
  query.value = templateMap[type] || query.value
  openConsoleTab()
  addLog('info', 'Insert SQL template', logContext({type}))
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

function handleQueryKeydown(event) {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault()
    runQuery()
  }
}

async function loadTablePage(page = tableData.value.page) {
  if (!selectedDatabase.value || !selectedTable.value) return
  const profileId = activeProfileId.value
  addLog('info', 'Load table page', logContext({profileId, page, pageSize: tableData.value.pageSize}))
  if (!hasRuntime()) {
    tableData.value = demoTableData(page, tableData.value.pageSize)
    selectedRowIndex.value = -1
    addLog('success', 'Preview table data loaded', logContext({rows: tableData.value.rows.length}))
    return
  }
  busy.value = true
  try {
    tableData.value = await GetTableData({
      profileId,
      database: selectedDatabase.value,
      table: selectedTable.value,
      page,
      pageSize: Number(tableData.value.pageSize || 50),
      where: tableWhere.value,
      orderBy: tableOrderBy.value,
      orderDir: tableOrderDir.value
    })
    selectedRowIndex.value = -1
    addLog('success', 'Table page loaded', logContext({page: tableData.value.page, rows: tableData.value.rows.length, total: tableData.value.total}))
  } catch (error) {
    setMessage(errorMessage(error), 'error', logContext({operation: 'loadTablePage'}))
  } finally {
    busy.value = false
  }
}

function applyTableFilter() {
  addLog('info', 'Apply table filter', logContext({where: tableWhere.value, orderBy: tableOrderBy.value, orderDir: tableOrderDir.value}))
  loadTablePage(1)
}

function clearTableFilter() {
  tableWhere.value = ''
  tableOrderBy.value = ''
  tableOrderDir.value = 'ASC'
  addLog('info', 'Clear table filter', logContext())
  loadTablePage(1)
}

function openFilterDialog() {
  if (!selectedTable.value || !tableData.value.columns.length) return
  filterDraft.value = {
    column: tableData.value.columns[0]?.name || '',
    operator: '=',
    value: '',
    value2: ''
  }
  filterDialogOpen.value = true
  addLog('debug', 'Open filter builder', logContext({table: selectedTable.value}))
}

function chooseFilterColumn(value) {
  filterDraft.value.column = value
  closeCustomSelect()
}

function chooseFilterOperator(value) {
  filterDraft.value.operator = value
  closeCustomSelect()
}

function applyFilterBuilder() {
  const condition = buildFilterCondition(filterDraft.value)
  if (!condition) {
    setMessage('筛选条件不完整', 'warn', logContext({operation: 'filterBuilder'}))
    return
  }
  tableWhere.value = tableWhere.value.trim() ? `(${tableWhere.value.trim()}) AND ${condition}` : condition
  filterDialogOpen.value = false
  addLog('info', 'Apply filter builder condition', logContext({where: condition}))
  loadTablePage(1)
}

function buildFilterCondition(filter) {
  const column = tableData.value.columns.find((item) => item.name === filter.column)
  if (!column) return ''
  const operator = filter.operator
  const identifier = quoteIdentifier(column.name)
  if (operator === 'IS NULL' || operator === 'IS NOT NULL') return `${identifier} ${operator}`
  if (operator === 'BETWEEN') {
    if (!String(filter.value).trim() || !String(filter.value2).trim()) return ''
    return `${identifier} BETWEEN ${sqlLiteral(filter.value, column)} AND ${sqlLiteral(filter.value2, column)}`
  }
  if (!String(filter.value).trim()) return ''
  const value = operator.includes('LIKE') ? `%${filter.value}%` : filter.value
  return `${identifier} ${operator} ${sqlLiteral(value, column)}`
}

function quoteIdentifier(name) {
  return `\`${String(name).replace(/`/g, '``')}\``
}

function sqlLiteral(value, column) {
  const text = String(value)
  const type = String(column?.type || '').toLowerCase()
  if (/^(tinyint|smallint|mediumint|int|bigint|decimal|float|double|real|bit)/.test(type) && /^-?\d+(\.\d+)?$/.test(text.trim())) {
    return text.trim()
  }
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
}

function tableCellText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function isNullableColumn(column) {
  return column?.nullable === 'YES'
}

function isPrimaryKeyColumn(column) {
  return tableData.value.primaryKeys.includes(column?.name)
}

function isLongTextColumn(column) {
  const type = String(column?.type || '').toLowerCase()
  return type.includes('text') || type.includes('json') || type.includes('blob') || type.includes('longvarchar')
}

function mutationValuesFrom(values, nulls) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, nulls[key] ? null : value]))
}

function csvEscape(value) {
  const text = tableCellText(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function tableRowsToCsv(rows) {
  const headers = tableData.value.columns.map((column) => column.name)
  const lines = [headers.map(csvEscape).join(',')]
  for (const row of rows) {
    lines.push(headers.map((name) => csvEscape(row[name])).join(','))
  }
  return lines.join('\n')
}

function resultRowsToCsv(resultTab = activeResultTab.value) {
  if (!resultTab?.columns?.length) return ''
  const lines = [resultTab.columns.map(csvEscape).join(',')]
  for (const row of resultTab.rows || []) {
    lines.push(resultTab.columns.map((_, index) => csvEscape(row[index])).join(','))
  }
  return lines.join('\n')
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text)
    setMessage(`${label}已复制`, 'success', logContext())
  } catch (error) {
    setMessage(errorMessage(error), 'error', logContext({operation: 'copy'}))
  }
}

function copySelectedRow() {
  if (!selectedRow.value) return
  copyText(tableRowsToCsv([selectedRow.value]), '选中行')
}

function copyVisibleRows() {
  copyText(tableRowsToCsv(tableData.value.rows || []), '当前页数据')
}

function exportVisibleCsv() {
  const csv = tableRowsToCsv(tableData.value.rows || [])
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'})
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${selectedDatabase.value}.${selectedTable.value}.csv`
  link.click()
  URL.revokeObjectURL(url)
  addLog('success', 'Export current page CSV', logContext({rows: tableData.value.rows?.length || 0}))
}

function exportVisibleJson() {
  const json = JSON.stringify(tableData.value.rows || [], null, 2)
  downloadText(`${selectedDatabase.value}.${selectedTable.value}.json`, json, 'application/json;charset=utf-8')
  addLog('success', 'Export current page JSON', logContext({rows: tableData.value.rows?.length || 0}))
}

async function openCsvImportPreview() {
  if (!selectedTable.value) return
  if (!hasRuntime()) {
    const preview = parseCsv('id,name,email\n1,Ada,ada@example.com\n2,Grace,grace@example.com')
    importPreview.value = preview
    importDialogOpen.value = true
    setMessage('浏览器预览模式：已生成 CSV 示例预览', 'warn')
    return
  }
  try {
    const content = await OpenCSVFile()
    if (!content) return
    importPreview.value = parseCsv(content)
    importDialogOpen.value = true
    addLog('success', 'CSV file parsed', logContext({rows: importPreview.value.total, columns: importPreview.value.columns.length}))
  } catch (error) {
    setMessage(errorMessage(error), 'error', logContext({operation: 'openCsvImport'}))
  }
}

function parseCsv(content) {
  const rows = []
  let current = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    const next = content[index + 1]
    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      current.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      current.push(cell)
      if (current.some((value) => value !== '')) rows.push(current)
      current = []
      cell = ''
    } else {
      cell += char
    }
  }
  current.push(cell)
  if (current.some((value) => value !== '')) rows.push(current)
  const columns = rows[0] || []
  const dataRows = rows.slice(1)
  return {columns, rows: dataRows, previewRows: dataRows.slice(0, 20), total: dataRows.length}
}

function importRowsFromPreview() {
  const tableColumns = new Set(tableData.value.columns.map((column) => column.name))
  const importColumns = importPreview.value.columns.filter((column) => tableColumns.has(column))
  return (importPreview.value.rows || []).map((row) => Object.fromEntries(importColumns.map((column) => [column, row[importPreview.value.columns.indexOf(column)] ?? null])))
}

async function confirmCsvImport() {
  if (!importPreview.value.total) return
  const importColumns = importPreview.value.columns.filter((column) => tableData.value.columns.some((item) => item.name === column))
  if (!importColumns.length) {
    setMessage('CSV 表头没有匹配当前表字段', 'error', logContext({operation: 'csvImport'}))
    return
  }
  if (!await askConfirm('导入 CSV', `将向 ${selectedDatabase.value}.${selectedTable.value} 导入 ${importPreview.value.total} 行，匹配字段：${importColumns.join(', ')}。确定继续？`, '导入')) return
  busy.value = true
  try {
    const affected = await BulkInsertRows({
      profileId: activeProfileId.value,
      database: selectedDatabase.value,
      table: selectedTable.value,
      rows: importRowsFromPreview()
    })
    importDialogOpen.value = false
    await loadTablePage(1)
    setMessage(`CSV 已导入 ${affected} 行`, 'success', logContext({rows: affected}))
  } catch (error) {
    setMessage(errorMessage(error), 'error', logContext({operation: 'csvImport'}))
  } finally {
    busy.value = false
  }
}

function copyResultRows() {
  if (!activeResultTab.value?.columns?.length) return
  copyText(resultRowsToCsv(), '查询结果')
}

function exportResultCsv() {
  if (!activeResultTab.value?.columns?.length) return
  const csv = resultRowsToCsv()
  downloadText(`${activeResultTab.value.title.replace(/\s+/g, '_')}.csv`, csv, 'text/csv;charset=utf-8')
  addLog('success', 'Export SQL result CSV', logContext({rows: activeResultTab.value.rows?.length || 0}))
}

function exportResultJson() {
  if (!activeResultTab.value?.columns?.length) return
  const rows = (activeResultTab.value.rows || []).map((row) => Object.fromEntries(activeResultTab.value.columns.map((column, index) => [column, row[index]])))
  downloadText(`${activeResultTab.value.title.replace(/\s+/g, '_')}.json`, JSON.stringify(rows, null, 2), 'application/json;charset=utf-8')
  addLog('success', 'Export SQL result JSON', logContext({rows: rows.length}))
}

function openResultDetail(row, rowIndex) {
  if (!activeResultTab.value?.columns?.length) return
  resultDetail.value = {
    title: `${activeResultTab.value.title} / row ${rowIndex + 1}`,
    fields: activeResultTab.value.columns.map((column, index) => ({
      column,
      value: formatDetailValue(row[index])
    }))
  }
  resultDetailOpen.value = true
  addLog('debug', 'Open SQL result row detail', logContext({row: rowIndex + 1, columns: activeResultTab.value.columns.length}))
}

function formatDetailValue(value) {
  if (value === null || value === undefined) return '<null>'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
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

function columnWidth(columnName) {
  return columnWidths.value[currentColumnWidthKey.value]?.[columnName] || 150
}

function setColumnWidth(columnName, width) {
  columnWidths.value = {
    ...columnWidths.value,
    [currentColumnWidthKey.value]: {
      ...(columnWidths.value[currentColumnWidthKey.value] || {}),
      [columnName]: Math.max(80, Math.min(520, width))
    }
  }
}

function beginColumnResize(columnName, event) {
  event.preventDefault()
  event.stopPropagation()
  columnResizeState = {
    columnName,
    startX: event.clientX,
    startWidth: columnWidth(columnName)
  }
  document.body.classList.add('is-resizing')
  document.body.style.cursor = 'col-resize'
  window.addEventListener('mousemove', resizeColumn)
  window.addEventListener('mouseup', stopColumnResize)
}

function resizeColumn(event) {
  if (!columnResizeState) return
  setColumnWidth(columnResizeState.columnName, columnResizeState.startWidth + event.clientX - columnResizeState.startX)
}

function stopColumnResize() {
  if (!columnResizeState) return
  addLog('debug', 'Resize data column', logContext({column: columnResizeState.columnName, width: columnWidth(columnResizeState.columnName)}))
  columnResizeState = null
  document.body.classList.remove('is-resizing')
  document.body.style.cursor = ''
  window.removeEventListener('mousemove', resizeColumn)
  window.removeEventListener('mouseup', stopColumnResize)
}

function toggleCustomSelect(id) {
  openSelectId.value = openSelectId.value === id ? '' : id
}

function closeCustomSelect() {
  openSelectId.value = ''
}

function optionLabel(options, value, fallback = '') {
  return options.find((option) => String(option.value) === String(value))?.label || fallback
}

function chooseDatabase(value) {
  selectedDatabase.value = value
  closeCustomSelect()
}

function choosePageSize(value) {
  tableData.value.pageSize = Number(value)
  closeCustomSelect()
  loadTablePage(1)
}

function chooseHistory(value) {
  selectedHistoryIndex.value = value
  closeCustomSelect()
  applyQueryHistory()
}

function chooseTableOrderBy(value) {
  tableOrderBy.value = value
  if (!value) tableOrderDir.value = 'ASC'
  closeCustomSelect()
}

function chooseTableOrderDir(value) {
  tableOrderDir.value = value
  closeCustomSelect()
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

function selectDataRow(index) {
  selectedRowIndex.value = index
  addLog('debug', 'Select data row', logContext({row: (tableData.value.page - 1) * tableData.value.pageSize + index + 1}))
}

function clearDataRowSelection() {
  if (selectedRowIndex.value >= 0) addLog('debug', 'Clear data row selection', logContext())
  selectedRowIndex.value = -1
}

function isSelectedDataRow(index) {
  return selectedRowIndex.value === index
}

function openEditRow(row) {
  if (!canMutateRows.value) return
  addLog('info', 'Open row editor', logContext({keys: tableData.value.primaryKeys.map((key) => `${key}=${row[key]}`).join(', ')}))
  editKeys.value = Object.fromEntries(tableData.value.primaryKeys.map((key) => [key, row[key]]))
  editValues.value = {...row}
  editNulls.value = Object.fromEntries(tableData.value.columns.map((column) => [column.name, row[column.name] === null || row[column.name] === undefined]))
  editDialogOpen.value = true
}

function editSelectedRow() {
  if (!selectedRow.value) return
  openEditRow(selectedRow.value)
}

function openInsertRow() {
  if (!tableData.value.columns.length) return
  addLog('info', 'Open insert row dialog', logContext())
  const columns = tableData.value.columns.filter((column) => !String(column.extra || '').includes('auto_increment'))
  insertValues.value = Object.fromEntries(columns.map((column) => [column.name, '']))
  insertNulls.value = Object.fromEntries(columns.map((column) => [column.name, isNullableColumn(column)]))
  insertDialogOpen.value = true
}

async function saveInsertRow() {
  const profileId = activeProfileId.value
  addLog('info', 'Insert row', logContext({profileId, columns: Object.keys(insertValues.value).length}))
  busy.value = true
  try {
    await InsertTableRow({
      profileId,
      database: selectedDatabase.value,
      table: selectedTable.value,
      keyValues: {},
      values: mutationValuesFrom(insertValues.value, insertNulls.value)
    })
    insertDialogOpen.value = false
    await loadTablePage(tableData.value.page)
    setMessage('行已新增', 'success', logContext())
  } catch (error) {
    setMessage(errorMessage(error), 'error', logContext({operation: 'insertRow'}))
  } finally {
    busy.value = false
  }
}

async function saveRow() {
  const profileId = activeProfileId.value
  addLog('info', 'Update row', logContext({profileId, keys: Object.entries(editKeys.value).map(([key, value]) => `${key}=${value}`).join(', ')}))
  busy.value = true
  try {
    await UpdateTableRow({
      profileId,
      database: selectedDatabase.value,
      table: selectedTable.value,
      keyValues: editKeys.value,
      values: mutationValuesFrom(editValues.value, editNulls.value)
    })
    editDialogOpen.value = false
    await loadTablePage(tableData.value.page)
    setMessage('行已更新', 'success', logContext())
  } catch (error) {
    setMessage(errorMessage(error), 'error', logContext({operation: 'updateRow'}))
  } finally {
    busy.value = false
  }
}

async function deleteSelectedRow() {
  if (!selectedRow.value) return
  await deleteRow(selectedRow.value)
}

async function deleteRow(row) {
  const profileId = activeProfileId.value
  addLog('warn', 'Request delete row', logContext({profileId, keys: tableData.value.primaryKeys.map((key) => `${key}=${row[key]}`).join(', ')}))
  if (!canMutateRows.value || !await askConfirm('删除行', '确定删除选中的一行数据？这个操作会直接写入数据库。', '删除')) return
  const keyValues = Object.fromEntries(tableData.value.primaryKeys.map((key) => [key, row[key]]))
  busy.value = true
  try {
    await DeleteTableRow({
      profileId,
      database: selectedDatabase.value,
      table: selectedTable.value,
      keyValues,
      values: {}
    })
    await loadTablePage(tableData.value.page)
    setMessage('行已删除', 'success', logContext({keys: Object.entries(keyValues).map(([key, value]) => `${key}=${value}`).join(', ')}))
  } catch (error) {
    setMessage(errorMessage(error), 'error', logContext({operation: 'deleteRow'}))
  } finally {
    busy.value = false
  }
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

function demoTableData(page = 1, pageSize = 50) {
  return {
    columns: [
      {name: 'id', type: 'bigint', key: 'PRI'},
      {name: 'name', type: 'varchar(120)', key: ''},
      {name: 'email', type: 'varchar(160)', key: ''},
      {name: 'created_at', type: 'datetime', key: ''}
    ],
    primaryKeys: ['id'],
    rows: [
      {id: 1, name: 'Ada Lovelace', email: 'ada@example.com', created_at: '2026-05-28 10:20:00'},
      {id: 2, name: 'Grace Hopper', email: 'grace@example.com', created_at: '2026-05-28 10:21:00'}
    ],
    total: 2,
    page,
    pageSize
  }
}
</script>

<template>
  <div class="ide-shell" :style="{gridTemplateColumns: shellColumns}" @click="closeSurfaceOverlays">
    <aside class="explorer">
      <header class="tool-window-title">
        <span>Database Explorer</span>
        <div class="window-actions">
          <button title="Add" @click="openNewProfileDialog">+</button>
          <button title="Refresh" :disabled="!activeConnection.status.connected" @click="refreshTables(activeProfileId, selectedDatabase, true)">↻</button>
          <button title="Edit" :disabled="!selectedProfile" @click="openEditProfileDialog(selectedProfile)">⚙</button>
        </div>
      </header>

      <div class="explorer-toolbar">
        <button title="Connect" :disabled="busy || !selectedProfile" @click="connectSelected">▶</button>
        <button title="Disconnect" :disabled="!activeConnection.status.connected" @click="disconnect">■</button>
        <button title="Delete" :disabled="!selectedProfile" @click="removeProfile(selectedProfile)">−</button>
        <span class="toolbar-separator"></span>
        <button title="Open SQL" @click="openConsoleTab">SQL</button>
        <button title="View Data" :disabled="!selectedTable" @click="openDataTab(activeProfileId, selectedDatabase, selectedTable)">▦</button>
      </div>

      <div class="tree-scroll">
        <div v-for="profile in profiles" :key="profile.id" class="tree-group">
          <button
            class="tree-row server-row"
            :class="{selected: profile.id === selectedProfileId, connected: isProfileConnected(profile)}"
            @click="selectProfile(profile)"
            @dblclick="connectSelected"
          >
            <span class="tree-expander" @click.stop="toggleExpanded('server', profile.id)">{{ isExpanded('server', profile.id) ? '⌄' : '›' }}</span>
            <span class="tree-icon icon-server"></span>
            <span class="tree-label">{{ profile.name }}</span>
            <span v-if="isProfileConnected(profile)" class="status-dot"></span>
            <span class="tree-badge">{{ profile.ssh.enabled ? 'SSH' : profile.host }}</span>
          </button>

          <div v-if="isExpanded('server', profile.id)" class="tree-children">
            <template v-if="isProfileConnected(profile)">
              <template v-for="database in getConnectionState(profile.id).databases" :key="database.name">
              <button
                class="tree-row database-node"
                :class="{selected: profile.id === activeProfileId && database.name === selectedDatabase && !selectedTable, 'active-parent': profile.id === activeProfileId && database.name === selectedDatabase && selectedTable}"
                @click="selectDatabase(profile.id, database.name)"
              >
                <span class="tree-expander" @click.stop="toggleDatabase(profile.id, database.name)">{{ isExpanded('database', profile.id, database.name) ? '⌄' : '›' }}</span>
                <span class="tree-icon icon-database"></span>
                <span class="tree-label">{{ database.name }}</span>
              </button>

              <div v-if="isExpanded('database', profile.id, database.name)" class="tree-children nested">
                <button class="tree-row muted-row" @click="toggleTables(profile.id, database.name)">
                  <span class="tree-expander">{{ isExpanded('tables', profile.id, database.name) ? '⌄' : '›' }}</span>
                  <span class="tree-icon icon-folder"></span>
                  <span class="tree-label">tables</span>
                  <span class="tree-badge">{{ tableCount(profile.id, database.name) }}</span>
                </button>
                <template v-if="isExpanded('tables', profile.id, database.name)">
                  <div v-for="table in tableList(profile.id, database.name)" :key="table.name">
                    <button
                      class="tree-row table-node"
                      :class="{
                        selected: currentTab?.profileId === profile.id && currentTab?.kind === 'data' && currentTab.table === table.name && currentTab.database === database.name,
                        'active-parent': currentTab?.profileId === profile.id && currentTab?.kind === 'structure' && currentTab.table === table.name && currentTab.database === database.name
                      }"
                      @click="selectTable(table, database.name, profile.id)"
                      @contextmenu.prevent="openTableContextMenu(profile.id, database.name, table.name, $event)"
                    >
                      <span class="tree-expander" @click.stop="toggleExpanded('table', profile.id, database.name, table.name)">{{ isExpanded('table', profile.id, database.name, table.name) ? '⌄' : '›' }}</span>
                      <span class="tree-icon icon-table"></span>
                      <span class="tree-label">{{ table.name }}</span>
                    </button>

                    <div v-if="isExpanded('table', profile.id, database.name, table.name)" class="tree-children table-objects">
                      <button
                        class="tree-row object-folder"
                        :class="{selected: currentTab?.profileId === profile.id && currentTab?.kind === 'structure' && currentTab.objectType === 'columns' && currentTab.table === table.name && currentTab.database === database.name}"
                        @click="selectTableObject('columns', table.name, database.name, profile.id)"
                      >
                        <span class="tree-expander" @click.stop="toggleExpanded('columns', profile.id, database.name, table.name)">{{ isExpanded('columns', profile.id, database.name, table.name) ? '⌄' : '›' }}</span>
                        <span class="tree-icon icon-folder"></span>
                        <span class="tree-label">columns</span>
                        <span class="tree-badge">{{ (tableMetadata[metadataKey(profile.id, database.name, table.name)]?.columns || []).length }}</span>
                      </button>
                      <div v-if="isExpanded('columns', profile.id, database.name, table.name)" class="tree-children leaf-list">
                        <button
                          v-for="column in (tableMetadata[metadataKey(profile.id, database.name, table.name)]?.columns || [])"
                          :key="column.name"
                          class="tree-row leaf-row"
                          @click="selectTableObject('columns', table.name, database.name, profile.id)"
                        >
                          <span class="tree-icon icon-column" :class="{primary: column.key === 'PRI'}"></span>
                          <span class="tree-label">{{ column.name }}</span>
                          <span class="tree-detail">{{ column.type }}</span>
                        </button>
                      </div>

                      <button
                        class="tree-row object-folder"
                        :class="{selected: currentTab?.profileId === profile.id && currentTab?.kind === 'structure' && currentTab.objectType === 'keys' && currentTab.table === table.name && currentTab.database === database.name}"
                        @click="selectTableObject('keys', table.name, database.name, profile.id)"
                      >
                        <span class="tree-expander" @click.stop="toggleExpanded('keys', profile.id, database.name, table.name)">{{ isExpanded('keys', profile.id, database.name, table.name) ? '⌄' : '›' }}</span>
                        <span class="tree-icon icon-folder"></span>
                        <span class="tree-label">keys</span>
                        <span class="tree-badge">{{ (tableMetadata[metadataKey(profile.id, database.name, table.name)]?.columns || []).filter((column) => column.key === 'PRI').length }}</span>
                      </button>
                      <div v-if="isExpanded('keys', profile.id, database.name, table.name)" class="tree-children leaf-list">
                        <button
                          v-for="column in (tableMetadata[metadataKey(profile.id, database.name, table.name)]?.columns || []).filter((item) => item.key === 'PRI')"
                          :key="column.name"
                          class="tree-row leaf-row"
                          @click="selectTableObject('keys', table.name, database.name, profile.id)"
                        >
                          <span class="tree-icon icon-key"></span>
                          <span class="tree-label">PRIMARY</span>
                          <span class="tree-detail">{{ column.name }}</span>
                        </button>
                      </div>

                      <button
                        class="tree-row object-folder"
                        :class="{selected: currentTab?.profileId === profile.id && currentTab?.kind === 'structure' && currentTab.objectType === 'indexes' && currentTab.table === table.name && currentTab.database === database.name}"
                        @click="selectTableObject('indexes', table.name, database.name, profile.id)"
                      >
                        <span class="tree-expander" @click.stop="toggleExpanded('indexes', profile.id, database.name, table.name)">{{ isExpanded('indexes', profile.id, database.name, table.name) ? '⌄' : '›' }}</span>
                        <span class="tree-icon icon-folder"></span>
                        <span class="tree-label">indexes</span>
                        <span class="tree-badge">{{ [...new Set((tableMetadata[metadataKey(profile.id, database.name, table.name)]?.indexes || []).map((item) => item.indexName))].length }}</span>
                      </button>
                      <div v-if="isExpanded('indexes', profile.id, database.name, table.name)" class="tree-children leaf-list">
                        <button
                          v-for="index in (tableMetadata[metadataKey(profile.id, database.name, table.name)]?.indexes || [])"
                          :key="`${index.indexName}.${index.seqInIndex}`"
                          class="tree-row leaf-row"
                          @click="selectTableObject('indexes', table.name, database.name, profile.id)"
                        >
                          <span class="tree-icon icon-index"></span>
                          <span class="tree-label">{{ index.indexName }}</span>
                          <span class="tree-detail">{{ index.columnName }}</span>
                        </button>
                      </div>

                      <button
                        class="tree-row object-folder"
                        :class="{selected: currentTab?.profileId === profile.id && currentTab?.kind === 'structure' && currentTab.objectType === 'ddl' && currentTab.table === table.name && currentTab.database === database.name}"
                        @click="selectTableObject('ddl', table.name, database.name, profile.id)"
                      >
                        <span class="tree-spacer"></span>
                        <span class="tree-icon icon-index"></span>
                        <span class="tree-label">DDL</span>
                      </button>
                    </div>
                  </div>
                </template>
              </div>
              </template>
            </template>
            <div v-else class="tree-row muted-row server-empty">
              <span class="tree-spacer"></span>
              <span class="tree-icon icon-disconnected"></span>
              <span class="tree-label">Not connected</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
    <div
      class="resize-handle vertical explorer-resizer"
      title="Drag to resize Database Explorer"
      @mousedown="beginResize('explorer', $event)"
      @dblclick="resetPaneSize('explorer')"
    ></div>

    <main class="ide-main" :style="{gridTemplateRows: mainRows}">
      <nav class="editor-tabs">
        <button
          v-for="tab in openTabs"
          :key="tab.id"
          class="editor-tab"
          :class="{active: tab.id === activeTabId}"
          @click="activateTab(tab.id)"
        >
          <span v-if="tab.kind === 'query'" class="mysql-mark">⌁</span>
          <span v-else-if="tab.kind === 'data'" class="table-icon">▦</span>
          <span v-else class="folder-icon">▣</span>
          {{ tabTitle(tab) }}
          <span class="tab-close" @click="closeTab(tab.id, $event)">×</span>
        </button>
        <div class="tab-spacer"></div>
        <span class="connection-pill">
          <span :class="['status-light', {online: activeConnection.status.connected}]"></span>
          {{ connectedLabel }}
        </span>
      </nav>

      <div class="main-toolbar">
        <button class="run-button" :disabled="busy || !selectedProfile" @click="activeConnection.status.connected ? runQuery() : connectSelected()">▶</button>
        <button :disabled="!activeConnection.status.connected" @click="disconnect">■</button>
        <button :disabled="!selectedProfile" @click="openEditProfileDialog(selectedProfile)">⚙</button>
        <span class="toolbar-separator"></span>
        <div class="custom-select" :class="{open: openSelectId === 'database', disabled: !activeConnection.status.connected}" @click.stop>
          <button class="custom-select-button" :disabled="!activeConnection.status.connected" @click="toggleCustomSelect('database')">
            <span>{{ optionLabel(databaseOptions, selectedDatabase, 'Database') }}</span>
            <span class="select-caret">⌄</span>
          </button>
          <div v-if="openSelectId === 'database'" class="custom-select-menu">
            <button
              v-for="option in databaseOptions"
              :key="option.value || 'empty'"
              :class="{active: option.value === selectedDatabase}"
              @click="chooseDatabase(option.value)"
            >{{ option.label }}</button>
          </div>
        </div>
        <span class="toolbar-mode">Tx: Auto</span>
        <button :disabled="!selectedTable" @click="loadTablePage(tableData.page)">↻</button>
        <button :disabled="!selectedTable" @click="openInsertRow">+</button>
        <template v-if="selectedRow">
          <span class="selection-chip">已选 {{ selectedRowsCount }} 行</span>
          <button class="icon-tool" title="编辑选中行" :disabled="!canEditSelectedRow" @click="editSelectedRow">✎</button>
          <button class="icon-tool danger-tool" title="删除选中行" :disabled="!canDeleteSelectedRow" @click="deleteSelectedRow">⌫</button>
        </template>
        <button :disabled="!selectedTable" @click="selectTableObject('ddl', selectedTable, selectedDatabase, activeProfileId)">DDL</button>
        <div class="toolbar-fill"></div>
        <div class="custom-select compact" :class="{open: openSelectId === 'pageSize'}" @click.stop>
          <button class="custom-select-button" @click="toggleCustomSelect('pageSize')">
            <span>{{ optionLabel(pageSizeOptions, tableData.pageSize, '50 rows') }}</span>
            <span class="select-caret">⌄</span>
          </button>
          <div v-if="openSelectId === 'pageSize'" class="custom-select-menu align-right">
            <button
              v-for="option in pageSizeOptions"
              :key="option.value"
              :class="{active: option.value === tableData.pageSize}"
              @click="choosePageSize(option.value)"
            >{{ option.label }}</button>
          </div>
        </div>
      </div>

      <section class="editor-area">
        <div v-if="currentTab?.kind === 'query'" class="query-surface">
          <div class="query-toolbar">
            <div class="query-toolbar-title">
              <span class="query-title-icon">⌁</span>
              <div>
                <strong>SQL Console</strong>
                <span>{{ selectedDatabase || 'No database selected' }}</span>
              </div>
            </div>
            <span class="toolbar-divider"></span>
            <div class="toolbar-group">
              <span class="toolbar-label">Execute</span>
              <button class="toolbar-action primary-action" :disabled="busy" title="Run selected SQL or statement at cursor" @click="runQuery">
                <span>▶</span>
                <span>Run</span>
              </button>
              <button class="toolbar-action" :disabled="busy" title="Run EXPLAIN for selected SQL or statement at cursor" @click="explainQuery">Explain</button>
              <button class="toolbar-action" title="Open SQL file" @click="openSqlFile">Open</button>
              <button class="toolbar-action" title="Format SQL" @click="formatQuery">Format</button>
            </div>
            <span class="toolbar-divider"></span>
            <div class="toolbar-group template-group">
              <span class="toolbar-label">Generate</span>
              <button class="template-action" :disabled="!selectedTable" title="Generate SELECT template" @click="insertSqlTemplate('select')">SELECT</button>
              <button class="template-action" :disabled="!selectedTable" title="Generate INSERT template" @click="insertSqlTemplate('insert')">INSERT</button>
              <button class="template-action" :disabled="!selectedTable" title="Generate UPDATE template" @click="insertSqlTemplate('update')">UPDATE</button>
              <button class="template-action" :disabled="!selectedTable" title="Generate DELETE template" @click="insertSqlTemplate('delete')">DELETE</button>
            </div>
            <div class="toolbar-fill"></div>
            <div class="toolbar-group history-group">
              <span class="toolbar-label">History</span>
              <div class="custom-select wide" :class="{open: openSelectId === 'history', disabled: !queryHistory.length}" @click.stop>
                <button class="custom-select-button" :disabled="!queryHistory.length" @click="toggleCustomSelect('history')">
                  <span>{{ optionLabel(historyOptions, selectedHistoryIndex, 'Recent SQL') }}</span>
                  <span class="select-caret">⌄</span>
                </button>
                <div v-if="openSelectId === 'history'" class="custom-select-menu">
                  <button
                    v-for="option in historyOptions"
                    :key="option.value || 'empty'"
                    :class="{active: option.value === selectedHistoryIndex}"
                    @click="chooseHistory(option.value)"
                  >{{ option.label }}</button>
                </div>
              </div>
            </div>
            <span class="shortcut-hint">Cmd/Ctrl + Enter</span>
          </div>
          <div class="sql-surface">
            <div class="line-gutter">
              <span v-for="line in 24" :key="line">{{ line }}</span>
            </div>
            <textarea ref="queryEditorRef" v-model="query" spellcheck="false" data-native-context @keydown="handleQueryKeydown"></textarea>
          </div>
          <div class="query-result">
            <div class="result-toolbar">
              <div class="result-tabs">
                <button
                  v-for="tab in resultTabs"
                  :key="tab.id"
                  :class="{active: tab.id === activeResultTabId}"
                  @click="activeResultTabId = tab.id"
                >
                  <span>{{ tab.title }}</span>
                  <span class="tab-close" @click="closeResultTab(tab.id, $event)">×</span>
                </button>
                <span v-if="!resultTabs.length" class="result-placeholder">Result</span>
              </div>
              <div class="result-actions">
                <span>{{ activeResultTab?.message || 'Ready' }}</span>
                <span>{{ activeResultTab?.elapsedMs || 0 }} ms</span>
                <button :disabled="!activeResultTab?.columns?.length" @click="copyResultRows">Copy</button>
                <button :disabled="!activeResultTab?.columns?.length" @click="exportResultCsv">CSV</button>
                <button :disabled="!activeResultTab?.columns?.length" @click="exportResultJson">JSON</button>
              </div>
            </div>
            <div class="grid-wrap">
              <table v-if="activeResultTab?.columns?.length" class="data-grid">
                <thead>
                  <tr>
                    <th class="row-num"></th>
                    <th v-for="column in activeResultTab.columns" :key="column">{{ column }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, rowIndex) in activeResultTab.rows" :key="rowIndex" @dblclick="openResultDetail(row, rowIndex)">
                    <td class="row-num">{{ rowIndex + 1 }}</td>
                    <td v-for="(value, cellIndex) in row" :key="cellIndex">{{ value ?? '<null>' }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-else class="empty-state">Run SQL to view results.</div>
            </div>
          </div>
        </div>

        <div v-else-if="currentTab?.kind === 'structure'" class="data-surface">
          <div class="filter-row">
            <span>{{ structureTitle }}</span>
            <button :disabled="!selectedTable" @click="insertDdlTemplate('addColumn', selectedObject.database, selectedObject.table, selectedObject.profileId)">+ Column</button>
            <button :disabled="!selectedTable" @click="insertDdlTemplate('createIndex', selectedObject.database, selectedObject.table, selectedObject.profileId)">+ Index</button>
            <button :disabled="!selectedTable" @click="insertDdlTemplate('renameTable', selectedObject.database, selectedObject.table, selectedObject.profileId)">Rename</button>
            <button class="danger-inline" :disabled="!selectedTable" @click="insertDdlTemplate('dropTable', selectedObject.database, selectedObject.table, selectedObject.profileId)">Drop</button>
            <div class="pager">
              <span>{{ structureRows.length }} items</span>
            </div>
          </div>

          <div class="grid-wrap">
            <pre v-if="currentTab?.objectType === 'ddl'" class="ddl-view">{{ selectedDDL || 'Loading DDL...' }}</pre>
            <table v-if="currentTab?.objectType !== 'ddl'" class="data-grid">
              <thead>
                <tr>
                  <th class="row-num"></th>
                  <th v-for="column in structureColumns" :key="column">{{ column }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, rowIndex) in structureRows" :key="rowIndex">
                  <td class="row-num">{{ rowIndex + 1 }}</td>
                  <td v-for="(value, cellIndex) in row" :key="cellIndex">{{ value || '<null>' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="floating-count">{{ currentTab?.objectType === 'ddl' ? 'DDL' : `${structureRows.length} items` }}</div>
        </div>

        <div v-else-if="currentTab?.kind === 'data'" class="data-surface" @click="clearDataRowSelection">
          <div class="filter-row" @click.stop>
            <span>⌁ WHERE</span>
            <input class="inline-filter" v-model="tableWhere" placeholder="e.g. id > 10" data-native-context>
            <button :disabled="!selectedTable || !tableData.columns.length" @click="openFilterDialog">Filter</button>
            <span>≡ ORDER BY</span>
            <div class="custom-select" :class="{open: openSelectId === 'orderBy'}" @click.stop>
              <button class="custom-select-button" @click="toggleCustomSelect('orderBy')">
                <span>{{ optionLabel(orderByOptions, tableOrderBy, 'none') }}</span>
                <span class="select-caret">⌄</span>
              </button>
              <div v-if="openSelectId === 'orderBy'" class="custom-select-menu">
                <button
                  v-for="option in orderByOptions"
                  :key="option.value || 'none'"
                  :class="{active: option.value === tableOrderBy}"
                  @click="chooseTableOrderBy(option.value)"
                >{{ option.label }}</button>
              </div>
            </div>
            <div class="custom-select compact" :class="{open: openSelectId === 'orderDir', disabled: !tableOrderBy}" @click.stop>
              <button class="custom-select-button" :disabled="!tableOrderBy" @click="toggleCustomSelect('orderDir')">
                <span>{{ optionLabel(orderDirOptions, tableOrderDir, 'ASC') }}</span>
                <span class="select-caret">⌄</span>
              </button>
              <div v-if="openSelectId === 'orderDir'" class="custom-select-menu">
                <button
                  v-for="option in orderDirOptions"
                  :key="option.value"
                  :class="{active: option.value === tableOrderDir}"
                  @click="chooseTableOrderDir(option.value)"
                >{{ option.label }}</button>
              </div>
            </div>
            <button @click="applyTableFilter">Apply</button>
            <button @click="clearTableFilter">Clear</button>
            <button :disabled="!selectedTable" @click="openInsertRow">+ Row</button>
            <button :disabled="!selectedTable" @click="openCsvImportPreview">Import CSV</button>
            <template v-if="selectedRow">
              <span class="selection-chip">已选 {{ selectedRowsCount }} 行</span>
              <button class="icon-tool" title="编辑选中行" :disabled="!canEditSelectedRow" @click="editSelectedRow">✎</button>
              <button class="icon-tool danger-tool" title="删除选中行" :disabled="!canDeleteSelectedRow" @click="deleteSelectedRow">⌫</button>
              <button class="icon-tool" title="复制选中行" @click="copySelectedRow">⧉</button>
            </template>
            <button title="复制当前页" :disabled="!tableData.rows?.length" @click="copyVisibleRows">Copy</button>
            <button title="导出当前页 CSV" :disabled="!tableData.rows?.length" @click="exportVisibleCsv">CSV</button>
            <button title="导出当前页 JSON" :disabled="!tableData.rows?.length" @click="exportVisibleJson">JSON</button>
            <div class="pager">
              <button :disabled="tableData.page <= 1" @click="loadTablePage(tableData.page - 1)">‹</button>
              <span>{{ tableData.page }} / {{ totalPages }}</span>
              <button :disabled="tableData.page >= totalPages" @click="loadTablePage(tableData.page + 1)">›</button>
            </div>
          </div>

          <div class="grid-wrap">
            <table v-if="tableData.columns.length" class="data-grid" @click.stop>
              <thead>
                <tr>
                  <th class="row-num"></th>
                  <th v-for="column in tableData.columns" :key="column.name" :style="{width: `${columnWidth(column.name)}px`, minWidth: `${columnWidth(column.name)}px`}">
                    <span class="col-name" :style="{width: `${columnWidth(column.name)}px`}">{{ column.name }}</span>
                    <span class="filter-mark">▽</span>
                    <span class="column-resizer" @mousedown="beginColumnResize(column.name, $event)"></span>
                  </th>
                  <th class="actions-col">actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, index) in tableData.rows"
                  :key="index"
                  :class="{'selected-row': isSelectedDataRow(index)}"
                  @click="selectDataRow(index)"
                  @dblclick="openEditRow(row)"
                >
                  <td class="row-num">{{ (tableData.page - 1) * tableData.pageSize + index + 1 }}</td>
                  <td v-for="column in tableData.columns" :key="column.name" :style="{width: `${columnWidth(column.name)}px`, minWidth: `${columnWidth(column.name)}px`}">{{ row[column.name] ?? '<null>' }}</td>
                  <td class="row-actions">
                    <button :disabled="!canMutateRows" @click.stop="openEditRow(row)">Edit</button>
                    <button :disabled="!canMutateRows" @click.stop="deleteRow(row)">Delete</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty-state">Connect and select a table from Database Explorer.</div>
          </div>

          <div class="floating-count">{{ tableData.rows?.length || 0 }} rows · {{ tableData.total || 0 }} total</div>
        </div>

        <div v-else class="empty-workspace">
          <span>Open a table, structure node, or SQL console from Database Explorer.</span>
        </div>
      </section>

      <section class="services">
        <div
          class="resize-handle horizontal services-resizer"
          title="Drag to resize Services"
          @mousedown="beginResize('services', $event)"
          @dblclick="resetPaneSize('services')"
        ></div>
        <header class="services-title">
          <span>Services</span>
          <div class="window-actions">
            <div class="custom-select compact" :class="{open: openSelectId === 'logLevel'}" @click.stop>
              <button class="custom-select-button" title="Log level" @click="toggleCustomSelect('logLevel')">
                <span>{{ optionLabel(logLevelOptions, logLevelFilter, 'All') }}</span>
                <span class="select-caret">⌄</span>
              </button>
              <div v-if="openSelectId === 'logLevel'" class="custom-select-menu align-right">
                <button
                  v-for="option in logLevelOptions"
                  :key="option.value"
                  :class="{active: option.value === logLevelFilter}"
                  @click="chooseLogLevel(option.value)"
                >{{ option.label }}</button>
              </div>
            </div>
            <input v-model="logSearch" class="log-search" placeholder="Search logs" data-native-context>
            <button title="Copy visible logs" :disabled="!visibleLogs.length" @click="copyVisibleLogs">⧉</button>
            <button title="Export visible logs as CSV" :disabled="!visibleLogs.length" @click="exportVisibleLogsCsv">CSV</button>
            <button title="Export visible logs as JSON" :disabled="!visibleLogs.length" @click="exportVisibleLogsJson">JSON</button>
            <button title="Clear logs" @click="clearLogs">⌫</button>
            <button title="Refresh current table" :disabled="!selectedTable" @click="loadTablePage(tableData.page)">↻</button>
            <button>×</button>
          </div>
        </header>
        <div class="services-body" :style="{gridTemplateColumns: servicesColumns}">
          <aside class="services-tree">
            <div class="tree-row muted-row"><span class="folder-icon">▣</span><span>Database</span></div>
            <div class="tree-row selected"><span class="mysql-mark">⌁</span><span>{{ selectedProfile?.name || '@localhost' }}</span></div>
            <div v-if="selectedTable" class="tree-row nested-service"><span class="table-icon">▦</span><span>{{ selectedTable }}</span></div>
          </aside>
          <div
            class="resize-handle vertical services-tree-resizer"
            title="Drag to resize Services tree"
            @mousedown="beginResize('servicesTree', $event)"
            @dblclick="resetPaneSize('servicesTree')"
          ></div>
          <div ref="consoleOutputRef" class="console-output">
            <div v-if="!visibleLogs.length" class="log-empty">Console output</div>
            <div v-for="log in visibleLogs" :key="log.id" :class="['log-row', `level-${log.level}`]">
              <span class="log-time">{{ log.time }}</span>
              <span class="log-level">{{ log.level }}</span>
              <span class="log-text">{{ log.text }}</span>
              <span v-if="logContextSummary(log.context)" class="log-context">{{ logContextSummary(log.context) }}</span>
            </div>
          </div>
        </div>
      </section>

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

    <div v-if="confirmDialogOpen" class="dialog-backdrop">
      <section class="dialog confirm-dialog">
        <header>
          <h2>{{ confirmDialog.title }}</h2>
          <button type="button" class="icon-close" @click="resolveConfirm(false)">×</button>
        </header>
        <div class="dialog-body">
          <p class="confirm-copy">{{ confirmDialog.body }}</p>
        </div>
        <footer>
          <button type="button" class="ghost" @click="resolveConfirm(false)">取消</button>
          <button type="button" class="danger-primary" @click="resolveConfirm(true)">{{ confirmDialog.action }}</button>
        </footer>
      </section>
    </div>

    <div v-if="filterDialogOpen" class="dialog-backdrop">
      <form class="dialog compact-dialog filter-dialog" @submit.prevent="applyFilterBuilder">
        <header>
          <div class="dialog-title">
            <h2>构建筛选条件</h2>
            <span>{{ selectedDatabase }}.{{ selectedTable }}</span>
          </div>
          <button type="button" class="icon-close" @click="filterDialogOpen = false">×</button>
        </header>
        <div class="dialog-body filter-builder">
          <label class="field">
            <span>字段</span>
            <div class="custom-select field-select" :class="{open: openSelectId === 'filterColumn'}" @click.stop>
              <button class="custom-select-button" type="button" @click="toggleCustomSelect('filterColumn')">
                <span>{{ optionLabel(filterColumnOptions, filterDraft.column, '选择字段') }}</span>
                <span class="select-caret">⌄</span>
              </button>
              <div v-if="openSelectId === 'filterColumn'" class="custom-select-menu">
                <button
                  v-for="option in filterColumnOptions"
                  :key="option.value"
                  type="button"
                  :class="{active: option.value === filterDraft.column}"
                  @click="chooseFilterColumn(option.value)"
                >{{ option.label }}</button>
              </div>
            </div>
          </label>
          <label class="field">
            <span>条件</span>
            <div class="custom-select field-select" :class="{open: openSelectId === 'filterOperator'}" @click.stop>
              <button class="custom-select-button" type="button" @click="toggleCustomSelect('filterOperator')">
                <span>{{ optionLabel(filterOperatorOptions, filterDraft.operator, '= equals') }}</span>
                <span class="select-caret">⌄</span>
              </button>
              <div v-if="openSelectId === 'filterOperator'" class="custom-select-menu">
                <button
                  v-for="option in filterOperatorOptions"
                  :key="option.value"
                  type="button"
                  :class="{active: option.value === filterDraft.operator}"
                  @click="chooseFilterOperator(option.value)"
                >{{ option.label }}</button>
              </div>
            </div>
          </label>
          <label v-if="!['IS NULL', 'IS NOT NULL'].includes(filterDraft.operator)" class="field wide">
            <span>{{ filterDraft.operator === 'BETWEEN' ? '起始值' : '值' }}</span>
            <input v-model="filterDraft.value" data-native-context>
          </label>
          <label v-if="filterDraft.operator === 'BETWEEN'" class="field wide">
            <span>结束值</span>
            <input v-model="filterDraft.value2" data-native-context>
          </label>
          <div class="filter-preview wide">
            <span>WHERE</span>
            <code>{{ buildFilterCondition(filterDraft) || '条件未完成' }}</code>
          </div>
        </div>
        <footer>
          <button type="button" class="ghost" @click="filterDialogOpen = false">取消</button>
          <button class="primary" type="submit">应用筛选</button>
        </footer>
      </form>
    </div>

    <div v-if="resultDetailOpen" class="dialog-backdrop">
      <section class="dialog result-detail-dialog">
        <header>
          <div class="dialog-title">
            <h2>结果行详情</h2>
            <span>{{ resultDetail.title }}</span>
          </div>
          <button type="button" class="icon-close" @click="resultDetailOpen = false">×</button>
        </header>
        <div class="dialog-body result-detail-body">
          <div v-for="field in resultDetail.fields" :key="field.column" class="detail-field">
            <span>{{ field.column }}</span>
            <pre data-native-context>{{ field.value }}</pre>
          </div>
        </div>
        <footer>
          <button type="button" class="ghost" @click="resultDetailOpen = false">关闭</button>
        </footer>
      </section>
    </div>

    <div v-if="importDialogOpen" class="dialog-backdrop">
      <section class="dialog import-dialog">
        <header>
          <div class="dialog-title">
            <h2>导入 CSV 预览</h2>
            <span>{{ selectedDatabase }}.{{ selectedTable }} · {{ importPreview.total }} rows</span>
          </div>
          <button type="button" class="icon-close" @click="importDialogOpen = false">×</button>
        </header>
        <div class="dialog-body">
          <p class="confirm-copy">将按 CSV 表头匹配当前表字段；未匹配字段会忽略。单次最多导入 1000 行。</p>
          <div class="grid-wrap import-preview-grid">
            <table v-if="importPreview.columns.length" class="data-grid">
              <thead>
                <tr>
                  <th class="row-num"></th>
                  <th v-for="column in importPreview.columns" :key="column">{{ column }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, rowIndex) in importPreview.previewRows" :key="rowIndex">
                  <td class="row-num">{{ rowIndex + 1 }}</td>
                  <td v-for="(value, cellIndex) in row" :key="cellIndex">{{ value || '<empty>' }}</td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty-state">没有解析到 CSV 数据。</div>
          </div>
        </div>
        <footer>
          <button type="button" class="ghost" @click="importDialogOpen = false">关闭</button>
          <button class="primary" type="button" :disabled="busy || !importPreview.total" @click="confirmCsvImport">导入</button>
        </footer>
      </section>
    </div>

    <div
      v-if="contextMenu.open"
      class="context-menu"
      :style="{left: `${contextMenu.x}px`, top: `${contextMenu.y}px`}"
      @click.stop
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
.ide-shell .ddl-view,
.ide-shell .console-output {
  -webkit-user-select: text;
  user-select: text;
}

.ide-shell button,
.ide-shell label,
.ide-shell header,
.ide-shell nav,
.ide-shell footer,
.ide-shell .tool-window-title,
.ide-shell .explorer-toolbar,
.ide-shell .main-toolbar,
.ide-shell .query-toolbar,
.ide-shell .editor-tabs,
.ide-shell .editor-tab,
.ide-shell .tree-row,
.ide-shell .services-title,
.ide-shell .services-tree,
.ide-shell .statusbar,
.ide-shell .custom-select,
.ide-shell .custom-select-menu,
.ide-shell .connection-pill,
.ide-shell .selection-chip,
.ide-shell .floating-count {
  -webkit-user-select: none;
  user-select: none;
}

.ide-shell input,
.ide-shell textarea,
.ide-shell [data-native-context],
.ide-shell .ddl-view,
.ide-shell .console-output,
.ide-shell .console-output * {
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

.explorer {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--panel);
  border-right: 1px solid #151619;
}

.tool-window-title,
.services-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 37px;
  padding: 0 8px;
  color: #e0e2e6;
  font-weight: 700;
  border-bottom: 1px solid var(--line);
}

.services-title .window-actions {
  min-width: 0;
}

.services-title .custom-select.compact {
  max-width: 96px;
}

.log-search {
  width: 180px;
  min-height: 24px;
  padding: 3px 8px;
  background: #1f2023;
  border: 1px solid var(--line);
}

.window-actions,
.explorer-toolbar,
.main-toolbar,
.editor-tabs,
.filter-row,
.pager,
.input-row,
.query-actions,
.row-actions,
.statusbar {
  display: flex;
  align-items: center;
  gap: 4px;
}

.explorer-toolbar,
.main-toolbar {
  height: 34px;
  padding: 0 8px;
  background: var(--panel);
  border-bottom: 1px solid var(--line);
}

.toolbar-separator {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--line);
}

.toolbar-fill,
.tab-spacer,
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

.selection-chip {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 7px;
  color: #b9c7dc;
  background: #303641;
  border: 1px solid #465066;
  border-radius: 4px;
}

.icon-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  min-width: 26px;
  padding: 0;
  color: #cfd7e6;
  background: #303338;
  border-color: var(--line);
}

.icon-tool:hover:not(:disabled) {
  color: #ffffff;
  background: #3c4656;
}

.danger-tool {
  color: #ffb4aa;
  background: rgba(244, 87, 82, 0.12);
  border-color: rgba(244, 87, 82, 0.34);
}

.danger-tool:hover:not(:disabled) {
  color: #ffffff;
  background: rgba(244, 87, 82, 0.28);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.custom-select {
  position: relative;
  min-width: 140px;
}

.custom-select.compact {
  min-width: 92px;
}

.custom-select.wide {
  min-width: 260px;
}

.custom-select-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 25px;
  padding: 0 7px 0 9px;
  color: var(--text);
  background: #303338;
  border: 1px solid var(--line);
  border-radius: 5px;
}

.custom-select-button span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-select.open .custom-select-button {
  border-color: #4d8df7;
  box-shadow: 0 0 0 1px rgba(77, 141, 247, 0.25);
}

.custom-select.disabled {
  opacity: 0.48;
}

.select-caret {
  color: var(--muted);
  font-size: 12px;
}

.custom-select-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 30;
  width: max(100%, 180px);
  max-height: 260px;
  overflow: auto;
  padding: 4px;
  background: #2b2d30;
  border: 1px solid #4a4e55;
  border-radius: 6px;
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.45);
}

.custom-select-menu.align-right {
  right: 0;
  left: auto;
}

.custom-select-menu button {
  display: block;
  width: 100%;
  min-height: 25px;
  padding: 0 8px;
  color: #cbd1db;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.custom-select-menu button.active {
  color: #ffffff;
  background: #41506a;
}

.run-button,
.status-light.online {
  color: var(--green);
}

.tree-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 6px 8px 12px;
}

.tree-group {
  margin-bottom: 2px;
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

.tree-row.connected .tree-label {
  color: #e0e4ea;
  font-weight: 650;
}

.tree-children {
  margin-left: 14px;
  padding-left: 8px;
  border-left: 1px solid rgba(93, 99, 110, 0.28);
}

.tree-children.nested {
  margin-left: 17px;
}

.tree-children.table-objects {
  margin-left: 17px;
}

.tree-children.leaf-list {
  margin-left: 17px;
}

.tree-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.server-row .tree-label,
.database-node .tree-label,
.table-node .tree-label,
.object-folder .tree-label {
  flex: 1;
}

.tree-badge {
  margin-left: auto;
  padding: 1px 5px;
  color: var(--muted);
  font-size: 11px;
  background: #373a3f;
  border-radius: 4px;
}

.tree-detail {
  margin-left: 6px;
  color: #747a84;
  font-size: 12px;
}

.tree-expander,
.tree-spacer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 16px;
  width: 16px;
  height: 20px;
  color: #8b9099;
  font-size: 14px;
  border-radius: 4px;
}

.tree-expander:hover {
  color: #d8dce3;
  background: rgba(255, 255, 255, 0.08);
}

.tree-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
}

.icon-server::before {
  content: "";
  width: 12px;
  height: 12px;
  border: 1px solid #35a7e8;
  border-radius: 3px;
  box-shadow: inset 0 -3px 0 rgba(53, 167, 232, 0.28);
}

.icon-database::before {
  content: "";
  width: 12px;
  height: 14px;
  border: 1px solid #36a3ff;
  border-radius: 50% / 18%;
  box-shadow: inset 0 3px 0 rgba(54, 163, 255, 0.25);
}

.icon-folder::before {
  content: "";
  width: 13px;
  height: 10px;
  margin-top: 2px;
  border: 1px solid #67a8ff;
  border-radius: 2px;
  background: rgba(103, 168, 255, 0.08);
}

.icon-folder::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 6px;
  height: 3px;
  border: 1px solid #67a8ff;
  border-bottom: 0;
  border-radius: 2px 2px 0 0;
}

.icon-table::before {
  content: "";
  width: 13px;
  height: 13px;
  border: 1px solid #b5c7dd;
  border-radius: 2px;
  background:
    linear-gradient(#b5c7dd, #b5c7dd) 0 4px / 100% 1px no-repeat,
    linear-gradient(#b5c7dd, #b5c7dd) 0 8px / 100% 1px no-repeat,
    linear-gradient(#b5c7dd, #b5c7dd) 4px 0 / 1px 100% no-repeat;
}

.icon-column::before {
  content: "";
  width: 11px;
  height: 13px;
  border: 1px solid #82aaff;
  border-radius: 2px;
}

.icon-column.primary::after,
.icon-key::before {
  content: "";
  width: 11px;
  height: 11px;
  border: 1px solid #e5c463;
  border-radius: 50%;
}

.icon-column.primary::after {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 5px;
  height: 5px;
  background: #e5c463;
}

.icon-index::before {
  content: "i";
  color: #8ab4ff;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
}

.icon-disconnected::before {
  content: "";
  width: 8px;
  height: 8px;
  border: 1px solid #858b95;
  border-radius: 50%;
}

.status-dot {
  width: 7px;
  height: 7px;
  margin-left: auto;
  background: var(--green);
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(77, 179, 99, 0.16);
}

.server-row .tree-badge {
  margin-left: 0;
}

.server-empty {
  color: #858b95;
}

.leaf-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  color: #78a8ff;
  font-size: 12px;
}

.leaf-icon.primary {
  color: #e5c463;
}

.leaf-row {
  color: #cfd3da;
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

.editor-tabs {
  background: var(--panel-darker);
  border-bottom: 1px solid var(--line);
}

.editor-tab {
  height: 37px;
  padding: 0 12px;
  border-radius: 0;
  border-right: 1px solid var(--line);
}

.editor-tab.active {
  background: #2b2d30;
}

.tab-close {
  margin-left: 10px;
  color: var(--muted);
  padding: 0 4px;
  border-radius: 4px;
}

.tab-close:hover {
  color: #ffffff;
  background: #4a4e55;
}

.connection-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 8px;
  color: var(--muted);
}

.status-light {
  width: 8px;
  height: 8px;
  background: #6b7280;
  border-radius: 50%;
}

.editor-area {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.query-surface {
  display: grid;
  grid-template-rows: 40px minmax(180px, 1fr) 190px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.query-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 0 10px;
  background: linear-gradient(#292b2f, #25272b);
  border-bottom: 1px solid var(--line);
}

.query-toolbar-title {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 8px;
  min-width: 176px;
  color: #d9dde5;
}

.query-toolbar-title strong,
.query-toolbar-title span {
  display: block;
}

.query-toolbar-title strong {
  font-size: 12px;
  line-height: 15px;
  font-weight: 700;
}

.query-toolbar-title div > span {
  max-width: 138px;
  overflow: hidden;
  color: #858b95;
  font-size: 11px;
  line-height: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.query-title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  color: #35a7e8;
  background: rgba(53, 167, 232, 0.08);
  border: 1px solid rgba(53, 167, 232, 0.22);
  border-radius: 5px;
}

.toolbar-group {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 4px;
  min-width: 0;
}

.toolbar-label {
  margin-right: 2px;
  color: #737982;
  font-size: 11px;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: #3b3e44;
}

.toolbar-action,
.template-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 24px;
  min-height: 24px;
  padding: 0 8px;
  color: #cbd1db;
  background: transparent;
  border-color: transparent;
}

.toolbar-action:hover:not(:disabled),
.template-action:hover:not(:disabled) {
  color: #ffffff;
  background: #343840;
}

.primary-action {
  color: #d9f2dd;
  background: rgba(77, 179, 99, 0.14);
  border-color: rgba(77, 179, 99, 0.32);
}

.primary-action:hover:not(:disabled) {
  background: rgba(77, 179, 99, 0.24);
}

.template-action {
  color: #b9c4d3;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 11px;
}

.history-group {
  max-width: min(320px, 32vw);
}

.history-group .custom-select {
  min-width: 190px;
  max-width: 260px;
}

.shortcut-hint {
  flex: 0 0 auto;
  color: #737982;
  font-size: 11px;
  white-space: nowrap;
}

.sql-surface {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  background: #1f2023;
}

.line-gutter {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 8px 12px 0 0;
  color: #5f646d;
  font-family: "SFMono-Regular", Consolas, monospace;
  line-height: 24px;
  border-right: 1px solid var(--line-soft);
}

.sql-surface textarea {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 8px 16px;
  color: #c9ccd2;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  line-height: 24px;
  resize: none;
  outline: none;
  background:
    linear-gradient(transparent 23px, rgba(255, 255, 255, 0.025) 24px) 0 0 / 100% 24px,
  #1f2023;
}

.query-result {
  display: grid;
  grid-template-rows: 31px minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  background: #1f2023;
  border-top: 1px solid var(--line);
}

.result-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 8px;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
}

.result-tabs,
.result-actions {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 4px;
}

.result-tabs {
  flex: 1;
  overflow: hidden;
}

.result-tabs button {
  display: inline-flex;
  align-items: center;
  max-width: 170px;
  height: 25px;
  min-height: 25px;
  padding: 0 6px 0 9px;
  color: #9fa6b2;
  background: transparent;
  border-color: transparent;
}

.result-tabs button.active {
  color: #eef2f8;
  background: #343840;
  border-color: #454b55;
}

.result-tabs button > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-placeholder {
  color: var(--text);
  font-weight: 700;
}

.result-actions {
  flex: 0 0 auto;
  color: #858b95;
}

.result-actions button {
  min-height: 23px;
  padding: 0 7px;
  color: #aeb8c7;
  background: #2d3035;
  border-color: #3e434a;
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

.inline-filter {
  width: min(260px, 24vw);
  min-height: 24px;
  padding: 3px 8px;
  background: #1f2023;
  border: 1px solid var(--line);
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

.column-resizer {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
}

.column-resizer:hover {
  background: #4d8df7;
}

.data-grid tbody tr:hover td {
  background: #262a30;
}

.data-grid tbody tr.selected-row td {
  color: #eef3ff;
  background: #28364b;
}

.data-grid tbody tr.selected-row:hover td {
  background: #30415b;
}

.row-num {
  min-width: 44px !important;
  width: 44px;
  color: #727884 !important;
  text-align: right !important;
  background: #24262a;
}

.col-name {
  color: #d0d4dc;
}

.filter-mark {
  float: right;
  color: #858b95;
}

.actions-col {
  min-width: 130px !important;
}

.row-actions button {
  min-height: 21px;
  padding: 0 6px;
  color: #9dbbff;
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

.services {
  position: relative;
  display: grid;
  grid-template-rows: 38px minmax(0, 1fr);
  min-height: 0;
  background: var(--panel-darker);
  border-top: 1px solid var(--line);
}

.services-resizer {
  position: absolute;
  top: -4px;
  left: 0;
  right: 0;
  height: 7px;
  background: transparent;
}

.services-resizer:hover,
.services-resizer:active {
  background: #4d8df7;
}

.services-body {
  display: grid;
  min-height: 0;
  overflow: hidden;
}

.services-tree-resizer {
  height: 100%;
  background: var(--line);
}

.services-tree {
  min-width: 0;
  overflow: auto;
  padding: 8px;
  background: var(--panel);
}

.nested-service {
  margin-left: 24px;
}

.console-output {
  min-width: 0;
  min-height: 0;
  padding: 12px;
  overflow: auto;
  color: #b9bdc5;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 13px;
  line-height: 20px;
}

.log-empty {
  display: grid;
  place-items: center;
  height: 100%;
  color: #6f7580;
}

.log-row {
  display: grid;
  grid-template-columns: 72px 58px minmax(180px, 1fr) minmax(160px, 0.8fr);
  gap: 10px;
  min-width: 720px;
  padding: 2px 4px;
  border-radius: 3px;
}

.log-row:hover {
  background: #24282f;
}

.log-time {
  color: #777d87;
}

.log-level {
  color: #9aa3af;
  text-transform: uppercase;
}

.log-text {
  color: #d0d5dd;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.log-context {
  color: #7d8490;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.level-success .log-level {
  color: #74c476;
}

.level-warn .log-level {
  color: #d6a35f;
}

.level-error .log-level {
  color: #ff8f87;
}

.level-debug .log-level {
  color: #7f8da3;
}

.context-menu {
  position: fixed;
  z-index: 20;
  display: flex;
  flex-direction: column;
  min-width: 190px;
  padding: 5px;
  background: #2b2d30;
  border: 1px solid #4a4e55;
  border-radius: 6px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
}

.context-menu button {
  justify-content: flex-start;
  width: 100%;
  text-align: left;
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

.field-select {
  width: 100%;
}

.field-select .custom-select-menu {
  max-height: 240px;
  overflow: auto;
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
