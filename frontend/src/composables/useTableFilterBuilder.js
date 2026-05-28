import {computed, ref} from 'vue'
import {quoteIdentifier, sqlLiteral} from './tableDataUtils'

export function useTableFilterBuilder({
  addLog,
  loadTablePage,
  logContext,
  selectedTable,
  setMessage,
  tableData,
  tableWhere
}) {
  const filterDialogOpen = ref(false)
  const filterDraft = ref({column: '', operator: '=', value: '', value2: ''})
  const filterColumnOptions = computed(() => tableData.value.columns.map((column) => ({label: `${column.name}  ${column.type}`, value: column.name})))

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

  return {
    filterDialogOpen,
    filterDraft,
    filterColumnOptions,
    openFilterDialog,
    chooseFilterColumn,
    chooseFilterOperator,
    applyFilterBuilder,
    buildFilterCondition
  }
}
