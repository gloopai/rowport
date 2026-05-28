import {computed, ref} from 'vue'
import {
  BulkInsertRows,
  DeleteTableRow,
  GetTableData,
  InsertTableRow,
  OpenCSVFile,
  UpdateTableRow
} from '../../wailsjs/go/main/App'

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

  let columnResizeState = null

  const profileIdValue = () => typeof activeProfileId === 'function' ? activeProfileId() : activeProfileId.value
  const totalPages = computed(() => Math.max(1, Math.ceil((tableData.value.total || 0) / tableData.value.pageSize)))
  const canMutateRows = computed(() => tableData.value.primaryKeys?.length > 0)
  const selectedRow = computed(() => selectedRowIndex.value >= 0 ? tableData.value.rows?.[selectedRowIndex.value] : null)
  const selectedRowsCount = computed(() => selectedRow.value ? 1 : 0)
  const canEditSelectedRow = computed(() => canMutateRows.value && Boolean(selectedRow.value))
  const canDeleteSelectedRow = computed(() => canMutateRows.value && Boolean(selectedRow.value))
  const currentColumnWidthKey = computed(() => `${profileIdValue()}.${selectedDatabase.value}.${selectedTable.value}`)
  const orderByOptions = computed(() => [
    {label: 'none', value: ''},
    ...tableData.value.columns.map((column) => ({label: column.name, value: column.name}))
  ])
  const filterColumnOptions = computed(() => tableData.value.columns.map((column) => ({label: `${column.name}  ${column.type}`, value: column.name})))

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
      addLog('success', 'Table page loaded', logContext({page: tableData.value.page, rows: tableData.value.rows.length, total: tableData.value.total, elapsedMs: elapsedSince(startedAt)}))
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

  function chooseFilterColumn(value, closeCustomSelect) {
    filterDraft.value.column = value
    closeCustomSelect()
  }

  function chooseFilterOperator(value, closeCustomSelect) {
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

  function isPrimaryKeyColumn(column) {
    return tableData.value.primaryKeys.includes(column?.name)
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
        profileId: profileIdValue(),
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

  function columnWidth(columnName) {
    return columnWidths.value[currentColumnWidthKey.value]?.[columnName] || 150
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
    const profileId = profileIdValue()
    const values = mutationValuesFrom(insertValues.value, insertNulls.value)
    addLog('info', 'Insert row', logContext({
      profileId,
      columns: Object.keys(values).length,
      sql: insertRowLogSql(selectedDatabase.value, selectedTable.value, values)
    }))
    busy.value = true
    try {
      await InsertTableRow({
        profileId,
        database: selectedDatabase.value,
        table: selectedTable.value,
        keyValues: {},
        values
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
    const profileId = profileIdValue()
    const values = mutationValuesFrom(editValues.value, editNulls.value)
    addLog('info', 'Update row', logContext({
      profileId,
      keys: Object.entries(editKeys.value).map(([key, value]) => `${key}=${value}`).join(', '),
      sql: updateRowLogSql(selectedDatabase.value, selectedTable.value, values, editKeys.value)
    }))
    busy.value = true
    try {
      await UpdateTableRow({
        profileId,
        database: selectedDatabase.value,
        table: selectedTable.value,
        keyValues: editKeys.value,
        values
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
    const profileId = profileIdValue()
    const keyValues = Object.fromEntries(tableData.value.primaryKeys.map((key) => [key, row[key]]))
    if (!canMutateRows.value || !await askConfirm('删除行', '确定删除选中的一行数据？这个操作会直接写入数据库。', '删除')) return
    addLog('warn', 'Delete row', logContext({
      profileId,
      keys: tableData.value.primaryKeys.map((key) => `${key}=${row[key]}`).join(', '),
      sql: deleteRowLogSql(selectedDatabase.value, selectedTable.value, keyValues)
    }))
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

  function setColumnWidth(columnName, width) {
    columnWidths.value = {
      ...columnWidths.value,
      [currentColumnWidthKey.value]: {
        ...(columnWidths.value[currentColumnWidthKey.value] || {}),
        [columnName]: Math.max(80, Math.min(520, width))
      }
    }
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

  function tableRowsToCsv(rows) {
    const headers = tableData.value.columns.map((column) => column.name)
    const lines = [headers.map(csvEscape).join(',')]
    for (const row of rows) {
      lines.push(headers.map((name) => csvEscape(row[name])).join(','))
    }
    return lines.join('\n')
  }

  function importRowsFromPreview() {
    const tableColumns = new Set(tableData.value.columns.map((column) => column.name))
    const importColumns = importPreview.value.columns.filter((column) => tableColumns.has(column))
    return (importPreview.value.rows || []).map((row) => Object.fromEntries(importColumns.map((column) => [column, row[importPreview.value.columns.indexOf(column)] ?? null])))
  }
}

export function demoTableData(page = 1, pageSize = 50) {
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

function quoteIdentifier(name) {
  return `\`${String(name).replace(/`/g, '``')}\``
}

function quoteSqlIdentifier(value) {
  return `\`${String(value || '').replace(/`/g, '``')}\``
}

function sqlLiteral(value, column) {
  const text = String(value)
  const type = String(column?.type || '').toLowerCase()
  if (/^(tinyint|smallint|mediumint|int|bigint|decimal|float|double|real|bit)/.test(type) && /^-?\d+(\.\d+)?$/.test(text.trim())) {
    return text.trim()
  }
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
}

function logSqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
}

function placeholderList(count) {
  return Array.from({length: count}, () => '?').join(', ')
}

function tablePageLogSql({database, table, columns = [], where = '', orderBy = '', orderDir = 'ASC', page = 1, pageSize = 50}) {
  const selectedColumns = columns.length ? columns.map((column) => quoteSqlIdentifier(column.name || column)).join(', ') : '*'
  const safeOrderDir = orderDir === 'DESC' ? 'DESC' : 'ASC'
  const offset = (Number(page) - 1) * Number(pageSize)
  const whereClause = where ? ` WHERE ${where}` : ''
  const orderClause = orderBy ? ` ORDER BY ${quoteSqlIdentifier(orderBy)} ${safeOrderDir}` : ''
  return `SELECT ${selectedColumns} FROM ${quoteSqlIdentifier(database)}.${quoteSqlIdentifier(table)}${whereClause}${orderClause} LIMIT ${Number(pageSize)} OFFSET ${offset}`
}

function insertRowLogSql(database, table, values) {
  const columns = Object.keys(values || {})
  return `INSERT INTO ${quoteSqlIdentifier(database)}.${quoteSqlIdentifier(table)} (${columns.map(quoteSqlIdentifier).join(', ')}) VALUES (${placeholderList(columns.length)})`
}

function updateRowLogSql(database, table, values, keyValues) {
  const setColumns = Object.keys(values || {}).filter((column) => !Object.prototype.hasOwnProperty.call(keyValues || {}, column))
  const whereColumns = Object.keys(keyValues || {})
  const setClause = setColumns.map((column) => `${quoteSqlIdentifier(column)} = ?`).join(', ')
  const whereClause = whereColumns.map((column) => `${quoteSqlIdentifier(column)} = ${logSqlLiteral(keyValues[column])}`).join(' AND ')
  return `UPDATE ${quoteSqlIdentifier(database)}.${quoteSqlIdentifier(table)} SET ${setClause} WHERE ${whereClause} LIMIT 1`
}

function deleteRowLogSql(database, table, keyValues) {
  const whereClause = Object.keys(keyValues || {})
    .map((column) => `${quoteSqlIdentifier(column)} = ${logSqlLiteral(keyValues[column])}`)
    .join(' AND ')
  return `DELETE FROM ${quoteSqlIdentifier(database)}.${quoteSqlIdentifier(table)} WHERE ${whereClause} LIMIT 1`
}

function tableCellText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function isNullableColumn(column) {
  return column?.nullable === 'YES'
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
