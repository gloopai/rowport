import {ref} from 'vue'
import {DeleteTableRow, InsertTableRow, UpdateTableRow} from '../../wailsjs/go/main/App'
import {
  deleteRowLogSql,
  insertRowLogSql,
  isNullableColumn,
  mutationValuesFrom,
  updateRowLogSql
} from './tableDataUtils'

export function useTableRowMutation({
  askConfirm,
  busy,
  canMutateRows,
  errorMessage,
  loadTablePage,
  logContext,
  profileIdValue,
  selectedDatabase,
  selectedTable,
  setMessage,
  tableData,
  addLog
}) {
  const editDialogOpen = ref(false)
  const editValues = ref({})
  const editNulls = ref({})
  const editKeys = ref({})
  const insertDialogOpen = ref(false)
  const insertValues = ref({})
  const insertNulls = ref({})

  function openEditRow(row) {
    if (!canMutateRows.value) return
    addLog('info', 'Open row editor', logContext({keys: tableData.value.primaryKeys.map((key) => `${key}=${row[key]}`).join(', ')}))
    editKeys.value = Object.fromEntries(tableData.value.primaryKeys.map((key) => [key, row[key]]))
    editValues.value = {...row}
    editNulls.value = Object.fromEntries(tableData.value.columns.map((column) => [column.name, row[column.name] === null || row[column.name] === undefined]))
    editDialogOpen.value = true
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

  return {
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
  }
}
