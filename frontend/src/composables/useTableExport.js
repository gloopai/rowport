import {csvEscape} from './tableDataUtils'

export function useTableExport({addLog, copyText, downloadText, logContext, selectedDatabase, selectedRow, selectedTable, tableData}) {
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

  function tableRowsToCsv(rows) {
    const headers = tableData.value.columns.map((column) => column.name)
    const lines = [headers.map(csvEscape).join(',')]
    for (const row of rows) {
      lines.push(headers.map((name) => csvEscape(row[name])).join(','))
    }
    return lines.join('\n')
  }

  return {
    copySelectedRow,
    copyVisibleRows,
    exportVisibleCsv,
    exportVisibleJson
  }
}
