import {computed, nextTick} from 'vue'

export const VIRTUAL_ROW_HEIGHT = 27
export const VIRTUAL_VISIBLE_ROWS = 80
export const VIRTUAL_OVERSCAN = 12

export function virtualRows(rows, scrollTop, {
  rowHeight = VIRTUAL_ROW_HEIGHT,
  visibleRows = VIRTUAL_VISIBLE_ROWS,
  overscan = VIRTUAL_OVERSCAN
} = {}) {
  const total = rows.length
  if (total <= visibleRows + overscan * 2) {
    return {items: rows.map((row, index) => ({row, index})), start: 0, end: total}
  }
  const firstVisible = Math.floor(scrollTop / rowHeight)
  const start = Math.max(0, firstVisible - overscan)
  const end = Math.min(total, start + visibleRows + overscan * 2)
  return {
    items: rows.slice(start, end).map((row, offset) => ({row, index: start + offset})),
    start,
    end
  }
}

export function useVirtualGrid({
  dataGridScrollTop,
  dataTableViewRef,
  resetResultGridScroll,
  tableData
}) {
  const virtualDataRows = computed(() => virtualRows(tableData.value.rows || [], dataGridScrollTop.value))
  const dataTopSpacerHeight = computed(() => virtualDataRows.value.start * VIRTUAL_ROW_HEIGHT)
  const dataBottomSpacerHeight = computed(() => Math.max(0, ((tableData.value.rows || []).length - virtualDataRows.value.end) * VIRTUAL_ROW_HEIGHT))
  const dataGridColspan = computed(() => tableData.value.columns.length + 2)

  function handleDataGridScroll(event) {
    dataGridScrollTop.value = event.target.scrollTop
  }

  function resetGridScroll(kind) {
    if (kind === 'result') {
      resetResultGridScroll()
    }
    if (kind === 'data') {
      dataGridScrollTop.value = 0
      nextTick(() => {
        dataTableViewRef.value?.scrollToTop()
      })
    }
  }

  return {
    virtualDataRows,
    dataTopSpacerHeight,
    dataBottomSpacerHeight,
    dataGridColspan,
    handleDataGridScroll,
    resetGridScroll
  }
}
