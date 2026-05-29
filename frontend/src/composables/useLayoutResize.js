import {computed, ref} from 'vue'
import {readStoredRaw} from './storage'

const LAYOUT_KEY = 'rowport.layout'
const LEGACY_LAYOUT_KEY = 'mysql-gui.layout'

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function useLayoutResize() {
  const explorerWidth = ref(360)
  const servicesHeight = ref(240)
  const servicesTreeWidth = ref(240)
  const queryResultHeight = ref(240)
  let resizeState = null

  const shellColumns = computed(() => `${explorerWidth.value}px 6px minmax(0, 1fr)`)
  const mainRows = computed(() => `37px 34px minmax(0, 1fr) ${servicesHeight.value}px 24px`)
  const servicesColumns = computed(() => `${servicesTreeWidth.value}px 6px minmax(0, 1fr)`)
  const queryMainRows = computed(() => `minmax(120px, 1fr) 6px ${queryResultHeight.value}px`)

  function loadLayout() {
    try {
      const layout = JSON.parse(readStoredRaw(LAYOUT_KEY, LEGACY_LAYOUT_KEY) || '{}')
      explorerWidth.value = clamp(Number(layout.explorerWidth) || 360, 240, 620)
      servicesHeight.value = clamp(Number(layout.servicesHeight) || 240, 150, 520)
      servicesTreeWidth.value = clamp(Number(layout.servicesTreeWidth) || 240, 160, 520)
      queryResultHeight.value = clamp(Number(layout.queryResultHeight) || 240, 120, 560)
    } catch {
      persistLayout()
    }
  }

  function persistLayout() {
    localStorage.setItem(
      LAYOUT_KEY,
      JSON.stringify({
        explorerWidth: explorerWidth.value,
        servicesHeight: servicesHeight.value,
        servicesTreeWidth: servicesTreeWidth.value,
        queryResultHeight: queryResultHeight.value
      })
    )
  }

  function beginResize(kind, event) {
    event.preventDefault()
    resizeState = {
      kind,
      startX: event.clientX,
      startY: event.clientY,
      explorerWidth: explorerWidth.value,
      servicesHeight: servicesHeight.value,
      servicesTreeWidth: servicesTreeWidth.value,
      queryResultHeight: queryResultHeight.value
    }
    document.body.classList.add('is-resizing')
    document.body.style.cursor = kind === 'services' || kind === 'queryResult' ? 'row-resize' : 'col-resize'
    window.addEventListener('mousemove', resizePane)
    window.addEventListener('mouseup', stopResize)
  }

  function resizePane(event) {
    if (!resizeState) return
    if (resizeState.kind === 'explorer') {
      explorerWidth.value = clamp(resizeState.explorerWidth + event.clientX - resizeState.startX, 240, 620)
    }
    if (resizeState.kind === 'services') {
      servicesHeight.value = clamp(resizeState.servicesHeight - (event.clientY - resizeState.startY), 150, 520)
    }
    if (resizeState.kind === 'servicesTree') {
      servicesTreeWidth.value = clamp(resizeState.servicesTreeWidth + event.clientX - resizeState.startX, 160, 520)
    }
    if (resizeState.kind === 'queryResult') {
      queryResultHeight.value = clamp(resizeState.queryResultHeight - (event.clientY - resizeState.startY), 120, 560)
    }
  }

  function stopResize() {
    if (!resizeState) return
    resizeState = null
    document.body.classList.remove('is-resizing')
    document.body.style.cursor = ''
    window.removeEventListener('mousemove', resizePane)
    window.removeEventListener('mouseup', stopResize)
    persistLayout()
  }

  function resetPaneSize(kind) {
    if (kind === 'explorer') explorerWidth.value = 360
    if (kind === 'services') servicesHeight.value = 240
    if (kind === 'servicesTree') servicesTreeWidth.value = 240
    if (kind === 'queryResult') queryResultHeight.value = 240
    persistLayout()
  }

  return {
    explorerWidth,
    servicesHeight,
    servicesTreeWidth,
    queryResultHeight,
    shellColumns,
    mainRows,
    servicesColumns,
    queryMainRows,
    loadLayout,
    persistLayout,
    beginResize,
    resetPaneSize
  }
}
