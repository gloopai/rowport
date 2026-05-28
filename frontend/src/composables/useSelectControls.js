import {ref} from 'vue'

export function useSelectControls({
  chooseFilterColumnValue,
  chooseFilterOperatorValue,
  chooseQueryHistory,
  chooseTableOrderByValue,
  chooseTableOrderDirValue,
  chooseTablePageSize,
  logLevelFilter,
  selectedDatabase
}) {
  const openSelectId = ref('')

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

  function chooseFilterColumn(value) {
    chooseFilterColumnValue(value, closeCustomSelect)
  }

  function chooseFilterOperator(value) {
    chooseFilterOperatorValue(value, closeCustomSelect)
  }

  function chooseLogLevel(value) {
    logLevelFilter.value = value
    closeCustomSelect()
  }

  return {
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
  }
}
