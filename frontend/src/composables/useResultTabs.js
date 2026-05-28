import {computed, nextTick, ref} from 'vue'

export function useResultTabs({
  newId,
  resultTabKey,
  formatLogTime,
  virtualRows,
  rowHeight,
  resultPaneRef
}) {
  const resultGridScrollTop = ref(0)
  const resultTabs = ref([])
  const activeResultTabId = ref('')

  const activeResultTab = computed(() => resultTabs.value.find((tab) => tab.id === activeResultTabId.value) || null)
  const activeResultRows = computed(() => activeResultTab.value?.rows || [])
  const virtualResultRows = computed(() => virtualRows(activeResultRows.value, resultGridScrollTop.value))
  const resultTopSpacerHeight = computed(() => virtualResultRows.value.start * rowHeight)
  const resultBottomSpacerHeight = computed(() => Math.max(0, (activeResultRows.value.length - virtualResultRows.value.end) * rowHeight))
  const resultGridColspan = computed(() => (activeResultTab.value?.columns?.length || 0) + 1)

  function handleResultGridScroll(event) {
    resultGridScrollTop.value = event.target.scrollTop
  }

  function resetResultGridScroll() {
    resultGridScrollTop.value = 0
    nextTick(() => {
      resultPaneRef.value?.scrollToTop()
    })
  }

  function appendResultTab({mode, sql, result, scope = 'statement', statementIndex = 0}) {
    const tabKey = resultTabKey({mode, sql, scope, statementIndex})
    const existingIndex = resultTabs.value.findIndex((tab) => tab.key === tabKey)
    const title = existingIndex >= 0
      ? resultTabs.value[existingIndex].title
      : `${mode === 'explain' ? 'Explain' : 'Result'} ${resultTabs.value.length + 1}`
    const tab = {
      id: existingIndex >= 0 ? resultTabs.value[existingIndex].id : newId(),
      key: tabKey,
      mode,
      title,
      scope,
      statementIndex,
      sql,
      columns: result.columns || [],
      rows: result.rows || [],
      rowsAffected: result.rowsAffected || 0,
      elapsedMs: result.elapsedMs || 0,
      message: result.message || '',
      truncated: Boolean(result.truncated),
      createdAt: formatLogTime(new Date())
    }
    if (existingIndex >= 0) {
      const nextTabs = [...resultTabs.value]
      nextTabs[existingIndex] = tab
      resultTabs.value = nextTabs
    } else {
      resultTabs.value = [...resultTabs.value.slice(-9), tab]
    }
    activeResultTabId.value = tab.id
    resetResultGridScroll()
  }

  function closeResultTab(tabId, event) {
    event?.stopPropagation()
    const index = resultTabs.value.findIndex((tab) => tab.id === tabId)
    if (index === -1) return
    const wasActive = activeResultTabId.value === tabId
    const nextTabs = resultTabs.value.filter((tab) => tab.id !== tabId)
    resultTabs.value = nextTabs
    if (wasActive) {
      activeResultTabId.value = (nextTabs[index] || nextTabs[index - 1])?.id || ''
    }
  }

  return {
    resultGridScrollTop,
    resultTabs,
    activeResultTabId,
    activeResultTab,
    activeResultRows,
    virtualResultRows,
    resultTopSpacerHeight,
    resultBottomSpacerHeight,
    resultGridColspan,
    handleResultGridScroll,
    resetResultGridScroll,
    appendResultTab,
    closeResultTab
  }
}
