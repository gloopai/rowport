import {computed, ref} from 'vue'

const MENU_WIDTH = 220
const MENU_MAX_HEIGHT = 420

export function useTableContextMenu({addLog, copyText, insertDdlTemplate, insertSqlTemplate, loadTableMetadata, logContext, selectTable, selectTableObject}) {
  const contextMenu = ref({open: false, x: 0, y: 0, profileId: '', database: '', table: ''})

  const contextMenuStyle = computed(() => ({
    left: `${contextMenu.value.x}px`,
    top: `${contextMenu.value.y}px`,
    width: `${MENU_WIDTH}px`,
    maxHeight: `${Math.max(160, Math.min(MENU_MAX_HEIGHT, window.innerHeight - 16))}px`
  }))

  function openTableContextMenu(profileId, database, table, event) {
    const viewportWidth = window.innerWidth || 0
    const viewportHeight = window.innerHeight || 0
    const menuHeight = Math.min(MENU_MAX_HEIGHT, viewportHeight - 16)
    let x = event.clientX
    let y = event.clientY
    if (x + MENU_WIDTH + 8 > viewportWidth) x = Math.max(8, event.clientX - MENU_WIDTH)
    if (y + menuHeight + 8 > viewportHeight) y = Math.max(8, viewportHeight - menuHeight - 8)
    contextMenu.value = {open: true, x, y, profileId, database, table}
    addLog('debug', 'Open table context menu', logContext({profileId, database, table}))
  }

  function closeContextMenu() {
    contextMenu.value.open = false
  }

  function contextTableInfo() {
    return {profileId: contextMenu.value.profileId, database: contextMenu.value.database, table: contextMenu.value.table}
  }

  function copyQualifiedTableName() {
    const {database, table} = contextTableInfo()
    copyText(`\`${database}\`.\`${table}\``, '表名')
    closeContextMenu()
  }

  function openContextTableData() {
    const {profileId, database, table} = contextTableInfo()
    selectTable(table, database, profileId)
    closeContextMenu()
  }

  function openContextTableStructure(type) {
    const {profileId, database, table} = contextTableInfo()
    selectTableObject(type, table, database, profileId)
    closeContextMenu()
  }

  async function insertContextSqlTemplate(type) {
    const {profileId, database, table} = contextTableInfo()
    await loadTableMetadata(profileId, database, table)
    insertSqlTemplate(type, database, table, profileId)
    closeContextMenu()
  }

  async function insertContextDdlTemplate(type) {
    const {profileId, database, table} = contextTableInfo()
    await loadTableMetadata(profileId, database, table)
    insertDdlTemplate(type, database, table, profileId)
    closeContextMenu()
  }

  return {
    contextMenu,
    contextMenuStyle,
    openTableContextMenu,
    closeContextMenu,
    copyQualifiedTableName,
    openContextTableData,
    openContextTableStructure,
    insertContextSqlTemplate,
    insertContextDdlTemplate
  }
}
