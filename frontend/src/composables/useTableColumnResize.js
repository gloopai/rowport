import {computed, ref} from 'vue'

export function useTableColumnResize({
  activeProfileId,
  addLog,
  logContext,
  selectedDatabase,
  selectedTable
}) {
  const columnWidths = ref({})
  const profileIdValue = () => typeof activeProfileId === 'function' ? activeProfileId() : activeProfileId.value
  const currentColumnWidthKey = computed(() => `${profileIdValue()}.${selectedDatabase.value}.${selectedTable.value}`)
  let columnResizeState = null

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

  return {
    columnWidths,
    currentColumnWidthKey,
    columnWidth,
    beginColumnResize
  }
}
