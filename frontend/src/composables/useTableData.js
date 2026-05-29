import {computed, ref} from 'vue'
import {GetTableData} from '../../wailsjs/go/main/App'
import {
  demoTableData,
  isLongTextColumn,
  isNullableColumn,
  tableCellText,
  tablePageLogSql
} from './tableDataUtils'
import {useTableColumnResize} from './useTableColumnResize'
import {useTableCsvImport} from './useTableCsvImport'
import {useTableExport} from './useTableExport'
import {useTableFilterBuilder} from './useTableFilterBuilder'
import {useTableRowMutation} from './useTableRowMutation'

export function useTableData({
  activeProfileId,
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
}) {
  const dataTableViewRef = ref(null)
  const dataGridScrollTop = ref(0)
  const tableData = ref({columns: [], primaryKeys: [], rows: [], total: 0, page: 1, pageSize: 50})
  const selectedRowIndex = ref(-1)
  const tableWhere = ref('')
  const tableOrderBy = ref('')
  const tableOrderDir = ref('ASC')

  const profileIdValue = () => typeof activeProfileId === 'function' ? activeProfileId() : activeProfileId.value
  const totalPages = computed(() => Math.max(1, Math.ceil((tableData.value.total || 0) / tableData.value.pageSize)))
  const canMutateRows = computed(() => tableData.value.primaryKeys?.length > 0)
  const selectedRow = computed(() => selectedRowIndex.value >= 0 ? tableData.value.rows?.[selectedRowIndex.value] : null)
  const selectedRowsCount = computed(() => selectedRow.value ? 1 : 0)
  const canEditSelectedRow = computed(() => canMutateRows.value && Boolean(selectedRow.value))
  const canDeleteSelectedRow = computed(() => canMutateRows.value && Boolean(selectedRow.value))
  const orderByOptions = computed(() => [
    {label: 'none', value: ''},
    ...tableData.value.columns.map((column) => ({label: column.name, value: column.name}))
  ])
  const {
    columnWidths,
    currentColumnWidthKey,
    columnWidth,
    beginColumnResize
  } = useTableColumnResize({
    activeProfileId,
    addLog,
    logContext,
    selectedDatabase,
    selectedTable
  })
  const {
    filterDialogOpen,
    filterDraft,
    filterColumnOptions,
    openFilterDialog,
    chooseFilterColumn,
    chooseFilterOperator,
    applyFilterBuilder,
    buildFilterCondition
  } = useTableFilterBuilder({
    addLog,
    loadTablePage: (...args) => loadTablePage(...args),
    logContext,
    selectedTable,
    setMessage,
    tableData,
    tableWhere
  })
  const {
    copySelectedRow,
    copyVisibleRows,
    exportVisibleCsv,
    exportVisibleJson
  } = useTableExport({
    addLog,
    copyText,
    downloadText,
    logContext,
    selectedDatabase,
    selectedRow,
    selectedTable,
    tableData
  })
  const {
    importDialogOpen,
    importPreview,
    openCsvImportPreview,
    confirmCsvImport
  } = useTableCsvImport({
    askConfirm,
    busy,
    errorMessage,
    hasRuntime,
    loadTablePage: (...args) => loadTablePage(...args),
    logContext,
    profileIdValue,
    selectedDatabase,
    selectedTable,
    setMessage,
    tableData,
    addLog
  })
  const {
    editDialogOpen,
    editValues,
    editNulls,
    editKeys,
    insertDialogOpen,
    insertValues,
    insertNulls,
    openEditRow,
    openInsertRow,
    saveInsertRow,
    saveRow,
    deleteRow
  } = useTableRowMutation({
    askConfirm,
    busy,
    canMutateRows,
    errorMessage,
    loadTablePage: (...args) => loadTablePage(...args),
    logContext,
    profileIdValue,
    selectedDatabase,
    selectedTable,
    setMessage,
    tableData,
    addLog
  })

  async function loadTablePage(page = tableData.value.page) {
    if (!selectedDatabase.value || !selectedTable.value) return
    const startedAt = perfStart()
    const profileId = profileIdValue()
    addLog('info', 'Load table page', logContext({
      profileId,
      page,
      pageSize: tableData.value.pageSize,
      sql: tablePageLogSql({
        database: selectedDatabase.value,
        table: selectedTable.value,
        columns: tableData.value.columns,
        where: tableWhere.value,
        orderBy: tableOrderBy.value,
        orderDir: tableOrderDir.value,
        page,
        pageSize: Number(tableData.value.pageSize || 50)
      })
    }))
    if (!hasRuntime()) {
      tableData.value = demoTableData(page, tableData.value.pageSize)
      selectedRowIndex.value = -1
      resetGridScroll('data')
      addLog('success', 'Preview table data loaded', logContext({rows: tableData.value.rows.length, elapsedMs: elapsedSince(startedAt)}))
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
      resetGridScroll('data')
      addLog('success', 'Table page loaded', logContext({page: tableData.value.page, rows: tableData.value.rows.length, total: tableData.value.total, elapsedMs: elapsedSince(startedAt), perf: 'tableLoad'}))
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

  function isPrimaryKeyColumn(column) {
    return tableData.value.primaryKeys.includes(column?.name)
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

  function editSelectedRow() {
    if (!selectedRow.value) return
    openEditRow(selectedRow.value)
  }

  async function deleteSelectedRow() {
    if (!selectedRow.value) return
    await deleteRow(selectedRow.value)
  }

  function choosePageSize(value, closeCustomSelect) {
    tableData.value.pageSize = Number(value)
    closeCustomSelect()
    loadTablePage(1)
  }

  function chooseTableOrderBy(value, closeCustomSelect) {
    tableOrderBy.value = value
    if (!value) tableOrderDir.value = 'ASC'
    closeCustomSelect()
  }

  function chooseTableOrderDir(value, closeCustomSelect) {
    tableOrderDir.value = value
    closeCustomSelect()
  }

  function resetTableView() {
    selectedRowIndex.value = -1
    tableData.value = {columns: [], primaryKeys: [], rows: [], total: 0, page: 1, pageSize: 50}
  }

  return {
    dataTableViewRef,
    dataGridScrollTop,
    tableData,
    selectedRowIndex,
    tableWhere,
    tableOrderBy,
    tableOrderDir,
    columnWidths,
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
    currentColumnWidthKey,
    orderByOptions,
    filterColumnOptions,
    loadTablePage,
    applyTableFilter,
    clearTableFilter,
    openFilterDialog,
    chooseFilterColumn,
    chooseFilterOperator,
    applyFilterBuilder,
    buildFilterCondition,
    tableCellText,
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
    openEditRow,
    editSelectedRow,
    openInsertRow,
    saveInsertRow,
    saveRow,
    deleteSelectedRow,
    deleteRow,
    choosePageSize,
    chooseTableOrderBy,
    chooseTableOrderDir,
    resetTableView,
    demoTableData
  }

}
