import {computed, nextTick, ref} from 'vue'

export function useAppSurface({
  closeContextMenu,
  closeCustomSelect,
  queryToolbarRef
}) {
  const queryToolbarHeight = ref(40)
  const queryRows = computed(() => `${queryToolbarHeight.value}px minmax(0, 1fr)`)
  let queryToolbarObserver = null

  function closeSurfaceOverlays() {
    closeContextMenu()
    closeCustomSelect()
  }

  function preventNativeContextMenu(event) {
    const target = event.target
    if (target?.closest?.('[data-native-context]')) return
    event.preventDefault()
  }

  function preventChromeTextSelection(event) {
    const target = event.target
    if (target?.closest?.('input, textarea, [contenteditable="true"], [data-native-context], [data-allow-select], .ddl-view, .console-output')) return
    event.preventDefault()
  }

  function observeQueryToolbar() {
    syncQueryToolbarHeight()
    queryToolbarObserver?.disconnect()
    nextTick(() => {
      const toolbarElement = queryToolbarRef.value?.getElement?.()
      if (!toolbarElement || typeof ResizeObserver === 'undefined') return
      queryToolbarObserver = new ResizeObserver(syncQueryToolbarHeight)
      queryToolbarObserver.observe(toolbarElement)
    })
  }

  function syncQueryToolbarHeight() {
    nextTick(() => {
      const height = queryToolbarRef.value?.getElement?.()?.getBoundingClientRect?.().height || 40
      queryToolbarHeight.value = Math.max(40, Math.ceil(height))
    })
  }

  function bindSurfaceEvents() {
    window.addEventListener('contextmenu', preventNativeContextMenu)
    window.addEventListener('selectstart', preventChromeTextSelection)
    window.addEventListener('resize', syncQueryToolbarHeight)
  }

  function unbindSurfaceEvents() {
    window.removeEventListener('contextmenu', preventNativeContextMenu)
    window.removeEventListener('selectstart', preventChromeTextSelection)
    window.removeEventListener('resize', syncQueryToolbarHeight)
    queryToolbarObserver?.disconnect()
    queryToolbarObserver = null
  }

  return {
    queryRows,
    closeSurfaceOverlays,
    observeQueryToolbar,
    bindSurfaceEvents,
    unbindSurfaceEvents
  }
}
