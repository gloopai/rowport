import {computed, ref} from 'vue'
import {readStoredRaw} from './storage'

const QUERY_HISTORY_KEY = 'rowport.queryHistory'
const LEGACY_QUERY_HISTORY_KEY = 'mysql-gui.queryHistory'

export function useQueryHistory({
  activeProfileId,
  selectedDatabase,
  query,
  normalizeResultSql,
  splitSqlStatements,
  currentSqlText,
  activeProfileName,
  compactSql,
  addLog,
  logContext,
  newId
}) {
  const queryHistory = ref([])
  const selectedHistoryId = ref('')
  const historySearch = ref('')

  const filteredQueryHistory = computed(() => {
    const search = historySearch.value.trim().toLowerCase()
    const profileId = activeProfileId.value
    const database = selectedDatabase.value || ''
    const scored = queryHistory.value.map((item) => {
      const sameContext = item.profileId === profileId && item.database === database
      return {...item, sameContext}
    })
    return scored
      .filter((item) => !search || `${item.sql} ${item.database} ${item.profileName} ${item.status}`.toLowerCase().includes(search))
      .sort(
        (a, b) =>
          Number(b.favorite) - Number(a.favorite) || Number(b.sameContext) - Number(a.sameContext) || String(b.executedAt).localeCompare(String(a.executedAt))
      )
      .slice(0, 60)
  })

  const savedQueryHistory = computed(() => filteredQueryHistory.value.filter((item) => item.favorite).slice(0, 30))
  const recentQueryHistory = computed(() => filteredQueryHistory.value.filter((item) => !item.favorite).slice(0, 60))
  const selectedHistoryItem = computed(() => queryHistory.value.find((item) => item.id === selectedHistoryId.value) || null)
  const currentHistoryItem = computed(() => {
    const normalizedSql = normalizeResultSql(currentSqlText() || query.value)
    if (!normalizedSql) return null
    return (
      queryHistory.value.find(
        (item) => item.normalizedSql === normalizedSql && item.profileId === activeProfileId.value && item.database === (selectedDatabase.value || '')
      ) || null
    )
  })
  const savedHistoryItem = computed(() => selectedHistoryItem.value || currentHistoryItem.value)

  function loadQueryHistory() {
    try {
      const parsed = JSON.parse(readStoredRaw(QUERY_HISTORY_KEY, LEGACY_QUERY_HISTORY_KEY) || '[]')
      if (!Array.isArray(parsed)) return []
      return parsed
        .map((item) => normalizeHistoryItem(item))
        .filter(Boolean)
        .slice(0, 200)
    } catch {
      return []
    }
  }

  function persistQueryHistory() {
    const favorites = queryHistory.value.filter((item) => item.favorite)
    const recent = queryHistory.value.filter((item) => !item.favorite).slice(0, 180)
    localStorage.setItem(QUERY_HISTORY_KEY, JSON.stringify([...favorites, ...recent].slice(0, 220)))
  }

  function normalizeHistoryItem(item) {
    if (typeof item === 'string') {
      const sql = item.trim()
      if (!sql) return null
      return {
        id: newId(),
        sql,
        normalizedSql: normalizeResultSql(sql),
        profileId: '',
        profileName: '',
        database: '',
        mode: 'query',
        scope: 'legacy',
        status: 'unknown',
        rows: 0,
        affected: 0,
        elapsedMs: 0,
        statements: splitSqlStatements(sql).length || 1,
        favorite: false,
        executedAt: new Date(0).toISOString(),
        error: ''
      }
    }
    if (!item || typeof item !== 'object' || typeof item.sql !== 'string' || !item.sql.trim()) return null
    const sql = item.sql.trim()
    return {
      id: item.id || newId(),
      sql,
      normalizedSql: item.normalizedSql || normalizeResultSql(sql),
      profileId: item.profileId || '',
      profileName: item.profileName || '',
      database: item.database || '',
      mode: item.mode || 'query',
      scope: item.scope || 'current',
      status: item.status || 'unknown',
      rows: Number(item.rows) || 0,
      affected: Number(item.affected) || 0,
      elapsedMs: Number(item.elapsedMs) || 0,
      statements: Number(item.statements) || 1,
      favorite: Boolean(item.favorite),
      executedAt: item.executedAt || new Date(0).toISOString(),
      error: item.error || ''
    }
  }

  function recordQueryHistory(sql, meta = {}) {
    const normalizedSql = normalizeResultSql(sql)
    if (!normalizedSql) return
    const profileId = activeProfileId.value
    const database = selectedDatabase.value || ''
    const mode = meta.mode || 'query'
    const scope = meta.scope || 'current'
    const existingIndex = queryHistory.value.findIndex(
      (item) => item.normalizedSql === normalizedSql && item.profileId === profileId && item.database === database && item.mode === mode && item.scope === scope
    )
    const existing = existingIndex >= 0 ? queryHistory.value[existingIndex] : null
    const item = {
      id: existing?.id || newId(),
      sql: String(sql || '').trim(),
      normalizedSql,
      profileId,
      profileName: activeProfileName(profileId),
      database,
      mode,
      scope,
      status: meta.status || 'success',
      rows: Number(meta.rows) || 0,
      affected: Number(meta.affected) || 0,
      elapsedMs: Number(meta.elapsedMs) || 0,
      statements: Number(meta.statements) || 1,
      favorite: Boolean(existing?.favorite),
      executedAt: new Date().toISOString(),
      error: meta.error || ''
    }
    queryHistory.value = [item, ...queryHistory.value.filter((_, index) => index !== existingIndex)]
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || String(b.executedAt).localeCompare(String(a.executedAt)))
      .slice(0, 220)
    selectedHistoryId.value = ''
    persistQueryHistory()
  }

  function historyOptionLabel(item) {
    const mark = item.favorite ? '★ ' : ''
    const status = item.status === 'success' ? 'ok' : item.status
    const context = item.database || item.profileName ? ` · ${[item.profileName, item.database].filter(Boolean).join('/')}` : ''
    const stats = item.status === 'success' ? ` · ${item.rows}r ${item.elapsedMs}ms` : item.error ? ` · ${item.error.slice(0, 32)}` : ''
    return `${mark}${compactSql(item.sql).slice(0, 72)} · ${status}${context}${stats}`
  }

  function toggleSavedHistory(item = savedHistoryItem.value) {
    const targetSql = currentSqlText() || query.value.trim()
    let target = item
    if (!target && targetSql) {
      recordQueryHistory(targetSql, {status: 'saved', mode: 'query', scope: 'favorite'})
      target = queryHistory.value[0]
    }
    if (!target) return
    queryHistory.value = queryHistory.value.map((entry) => (entry.id === target.id ? {...entry, favorite: !entry.favorite} : entry))
    selectedHistoryId.value = target.id
    persistQueryHistory()
  }

  function clearRecentHistory() {
    queryHistory.value = queryHistory.value.filter((item) => item.favorite)
    selectedHistoryId.value = ''
    persistQueryHistory()
    addLog('info', 'Clear recent SQL history', logContext({saved: queryHistory.value.length}))
  }

  function applyQueryHistory() {
    if (!selectedHistoryId.value) return
    const item = selectedHistoryItem.value
    if (item) {
      query.value = item.sql
      addLog('debug', 'Load SQL from history', logContext({historyId: item.id, status: item.status, elapsedMs: item.elapsedMs}))
    }
  }

  function chooseHistory(value) {
    selectedHistoryId.value = value
    applyQueryHistory()
  }

  function initializeQueryHistory() {
    queryHistory.value = loadQueryHistory()
  }

  return {
    queryHistory,
    selectedHistoryId,
    historySearch,
    filteredQueryHistory,
    savedQueryHistory,
    recentQueryHistory,
    selectedHistoryItem,
    currentHistoryItem,
    savedHistoryItem,
    initializeQueryHistory,
    loadQueryHistory,
    persistQueryHistory,
    normalizeHistoryItem,
    recordQueryHistory,
    historyOptionLabel,
    toggleSavedHistory,
    clearRecentHistory,
    applyQueryHistory,
    chooseHistory
  }
}
