import {BulkInsertRows, OpenCSVFile} from '../../wailsjs/go/main/App'
import {parseCsv} from './tableDataUtils'
import {ref} from 'vue'

export function useTableCsvImport({
  askConfirm,
  busy,
  errorMessage,
  hasRuntime,
  loadTablePage,
  logContext,
  profileIdValue,
  selectedDatabase,
  selectedTable,
  setMessage,
  tableData,
  addLog
}) {
  const importDialogOpen = ref(false)
  const importPreview = ref({columns: [], rows: [], total: 0})

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
    if (
      !(await askConfirm(
        '导入 CSV',
        `将向 ${selectedDatabase.value}.${selectedTable.value} 导入 ${importPreview.value.total} 行，匹配字段：${importColumns.join(', ')}。确定继续？`,
        '导入'
      ))
    )
      return
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

  function importRowsFromPreview() {
    const tableColumns = new Set(tableData.value.columns.map((column) => column.name))
    const importColumns = importPreview.value.columns.filter((column) => tableColumns.has(column))
    return (importPreview.value.rows || []).map((row) =>
      Object.fromEntries(importColumns.map((column) => [column, row[importPreview.value.columns.indexOf(column)] ?? null]))
    )
  }

  return {
    importDialogOpen,
    importPreview,
    openCsvImportPreview,
    confirmCsvImport
  }
}
