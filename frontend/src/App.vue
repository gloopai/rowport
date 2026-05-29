<script setup>
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue'
import DatabaseExplorer from './components/DatabaseExplorer.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import DataTableView from './components/DataTableView.vue'
import EditorTabs from './components/EditorTabs.vue'
import EditRowDialog from './components/EditRowDialog.vue'
import FilterDialog from './components/FilterDialog.vue'
import ImportCsvDialog from './components/ImportCsvDialog.vue'
import InsertRowDialog from './components/InsertRowDialog.vue'
import MainToolbar from './components/MainToolbar.vue'
import ProfileDialog from './components/ProfileDialog.vue'
import ResultDetailDialog from './components/ResultDetailDialog.vue'
import ServicesPanel from './components/ServicesPanel.vue'
import SqlEditorToolbar from './components/SqlEditorToolbar.vue'
import SqlResultPane from './components/SqlResultPane.vue'
import SqlSidePanel from './components/SqlSidePanel.vue'
import SqlTextEditor from './components/SqlTextEditor.vue'
import StatusBar from './components/StatusBar.vue'
import StructureView from './components/StructureView.vue'
import TableContextMenu from './components/TableContextMenu.vue'
import {elapsedSince, formatLogTime, hasRuntime, newId, perfStart} from './composables/appHelpers'
import {useAppFeedback} from './composables/useAppFeedback'
import {useAppSurface} from './composables/useAppSurface'
import {useConnections} from './composables/useConnections'
import {useLayoutResize} from './composables/useLayoutResize'
import {logLevelOptions, useOperationLogs} from './composables/useOperationLogs'
import {useSchemaExplorer} from './composables/useSchemaExplorer'
import {filterOperatorOptions, orderDirOptions, pageSizeOptions} from './composables/selectOptions'
import {compactSql} from './composables/sqlUtils'
import {useSelectControls} from './composables/useSelectControls'
import {useSqlConsole} from './composables/useSqlConsole'
import {useTableContextMenu} from './composables/useTableContextMenu'
import {useTableData} from './composables/useTableData'
import {useVirtualGrid, virtualRows, VIRTUAL_ROW_HEIGHT} from './composables/useVirtualGrid'
import {useWorkspaceTabs} from './composables/useWorkspaceTabs'

const appStartedAt = performance.now()

const selectedDatabase = ref('')
const selectedTable = ref('')
const selectedObject = ref({profileId: '', type: 'table', database: '', table: ''})
const busy = ref(false)

const suppressDatabaseWatch = ref(false)
const appActions = {
  copyText: (...args) => copyText(...args),
  downloadText: (...args) => downloadText(...args)
}

const {
  servicesPanelRef,
  logLevelFilter,
  logSearch,
  latestLog,
  visibleLogs,
  perfSummary,
  addLog,
  clearLogs,
  copyVisibleLogs,
  exportVisibleLogsJson,
  exportVisibleLogsCsv,
  logContextSummary,
  logSql
} = useOperationLogs({
  copyText: (...args) => appActions.copyText(...args),
  downloadText: (...args) => appActions.downloadText(...args),
  formatLogTime,
  logContext,
  newId
})
const {confirmDialogOpen, confirmDialog, setMessage, askConfirm, resolveConfirm, copyText, downloadText, errorMessage} = useAppFeedback({
  addLog,
  logContext
})
appActions.copyText = copyText
appActions.downloadText = downloadText
const {openTabs, activeTabId, currentTab, tabTitle, openConsoleTab, openDataTab, openStructureTab, activateTab, closeTab, insertDdlTemplate} = useWorkspaceTabs(
  {
    activeProfileId: () => activeProfileId.value,
    addLog,
    loadTableDDL: (...args) => loadTableDDL(...args),
    loadTableMetadata: (...args) => loadTableMetadata(...args),
    loadTablePage: (...args) => loadTablePage(...args),
    logContext,
    metadataKey: (...args) => metadataKey(...args),
    profileById: (...args) => profileById(...args),
    queryRef: {
      get value() {
        return query.value
      },
      set value(value) {
        query.value = value
      }
    },
    refreshTables: (...args) => refreshTables(...args),
    selectedDatabase,
    selectedObject,
    selectedProfile: () => selectedProfile.value,
    selectedProfileId: {
      get value() {
        return selectedProfileId.value
      },
      set value(value) {
        selectedProfileId.value = value
      }
    },
    selectedTable,
    suppressDatabaseWatch,
    syncActiveConnectionState: (...args) => syncActiveConnectionState(...args),
    tableData: {
      get value() {
        return tableData.value
      }
    },
    tableMetadata: {
      get value() {
        return tableMetadata.value
      }
    }
  }
)
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
  resetGridScroll: (...args) => resetGridScroll(...args),
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
  resetGridScroll: (...args) => resetGridScroll(...args),
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
const {shellColumns, mainRows, servicesColumns, queryMainRows, loadLayout, beginResize, resetPaneSize} = useLayoutResize()
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
const {virtualDataRows, dataTopSpacerHeight, dataBottomSpacerHeight, dataGridColspan, handleDataGridScroll, resetGridScroll} = useVirtualGrid({
  dataGridScrollTop,
  dataTableViewRef,
  resetResultGridScroll,
  tableData
})
const {
  contextMenu,
  contextMenuStyle,
  openTableContextMenu,
  closeContextMenu,
  copyQualifiedTableName,
  openContextTableData,
  openContextTableStructure,
  insertContextSqlTemplate,
  insertContextDdlTemplate
} = useTableContextMenu({
  addLog,
  copyText,
  insertDdlTemplate,
  insertSqlTemplate,
  loadTableMetadata,
  logContext,
  selectTable,
  selectTableObject
})
const {
  openSelectId,
  toggleCustomSelect,
  closeCustomSelect,
  chooseDatabase,
  choosePageSize,
  chooseHistory,
  chooseTableOrderBy,
  chooseTableOrderDir,
  chooseFilterColumn,
  chooseFilterOperator,
  chooseLogLevel
} = useSelectControls({
  chooseFilterColumnValue,
  chooseFilterOperatorValue,
  chooseQueryHistory,
  chooseTableOrderByValue,
  chooseTableOrderDirValue,
  chooseTablePageSize,
  logLevelFilter,
  selectedDatabase
})
const {queryRows, closeSurfaceOverlays, observeQueryToolbar, bindSurfaceEvents, unbindSurfaceEvents} = useAppSurface({
  closeContextMenu,
  closeCustomSelect,
  queryToolbarRef
})
const databaseOptions = computed(() => [
  {label: 'Database', value: ''},
  ...activeConnection.value.databases.map((database) => ({label: database.name, value: database.name}))
])
function chooseTlsMode(value) {
  draftProfile.value.tls.mode = value
  closeCustomSelect()
}
const tableIsReadOnly = computed(() => Boolean(selectedTable.value) && tableData.value.columns.length > 0 && !canMutateRows.value)
const perfStatusText = computed(() => perfSummary.value.map((metric) => `${metric.label} ${metric.lastMs}ms`).join(' · '))
const perfStatusTitle = computed(() =>
  perfSummary.value
    .map((metric) => `${metric.label}：最近 ${metric.lastMs}ms · 平均 ${metric.avgMs}ms · 峰值 ${metric.maxMs}ms · ${metric.count} 次`)
    .join('\n')
)
onMounted(async () => {
  loadLayout()
  bindSurfaceEvents()
  initializeQueryHistory()
  await initializeProfiles()
  if (selectedProfileId.value) {
    setExpanded(true, 'server', selectedProfileId.value)
  }
  observeQueryToolbar()
  addLog('info', 'Application ready', logContext({elapsedMs: elapsedSince(appStartedAt), profiles: profiles.value.length, perf: 'startup'}))
})

onBeforeUnmount(() => {
  unbindSurfaceEvents()
})

watch(selectedDatabase, async (database) => {
  await handleSelectedDatabaseChange(database, resetTableView)
})

watch(selectedTable, async (table) => {
  await handleSelectedTableChange(table)
})

function logContext(extra = {}) {
  const profileId = extra.profileId || activeProfileId.value
  return {
    profile: extra.profile || activeProfileName(profileId),
    database: selectedDatabase.value || '',
    table: selectedTable.value || '',
    ...extra
  }
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
        :table-read-only="tableIsReadOnly"
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
              <SqlTextEditor ref="queryEditorRef" v-model="query" @keydown="handleQueryKeydown" @selection-change="syncQuerySelection" />
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

      <StatusBar
        :profile-name="selectedProfile?.name || ''"
        :selected-database="selectedDatabase"
        :selected-table="selectedTable"
        :perf-status-text="perfStatusText"
        :perf-status-title="perfStatusTitle"
        :latest-log="latestLog"
        :row-count="tableData.rows?.length || 0"
      />
    </main>

    <ProfileDialog
      :open="profileDialogOpen"
      :editing-profile-id="editingProfileId"
      :draft-profile="draftProfile"
      :active-tab="profileDialogTab"
      :test-connection-state="testConnectionState"
      :open-select-id="openSelectId"
      @close="profileDialogOpen = false"
      @set-tab="profileDialogTab = $event"
      @test="testDraftConnection"
      @choose-private-key="choosePrivateKeyPath"
      @toggle-select="toggleCustomSelect"
      @choose-tls-mode="chooseTlsMode"
      @submit="saveProfile"
    />

    <EditRowDialog
      :open="editDialogOpen"
      :database="selectedDatabase"
      :table="selectedTable"
      :table-data="tableData"
      :values="editValues"
      :nulls="editNulls"
      :is-nullable-column="isNullableColumn"
      :is-primary-key-column="isPrimaryKeyColumn"
      :is-long-text-column="isLongTextColumn"
      @close="editDialogOpen = false"
      @submit="saveRow"
    />

    <InsertRowDialog
      :open="insertDialogOpen"
      :database="selectedDatabase"
      :table="selectedTable"
      :columns="tableData.columns"
      :values="insertValues"
      :nulls="insertNulls"
      :is-nullable-column="isNullableColumn"
      :is-long-text-column="isLongTextColumn"
      @close="insertDialogOpen = false"
      @submit="saveInsertRow"
    />

    <ConfirmDialog :open="confirmDialogOpen" :dialog="confirmDialog" @resolve="resolveConfirm" />

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

    <ResultDetailDialog :open="resultDetailOpen" :detail="resultDetail" @close="resultDetailOpen = false" />

    <ImportCsvDialog
      :open="importDialogOpen"
      :database="selectedDatabase"
      :table="selectedTable"
      :preview="importPreview"
      :busy="busy"
      @close="importDialogOpen = false"
      @confirm="confirmCsvImport"
    />

    <TableContextMenu
      :open="contextMenu.open"
      :menu-style="contextMenuStyle"
      @open-data="openContextTableData"
      @open-structure="openContextTableStructure"
      @copy-name="copyQualifiedTableName"
      @insert-sql="insertContextSqlTemplate"
      @insert-ddl="insertContextDdlTemplate"
    />
  </div>
</template>
