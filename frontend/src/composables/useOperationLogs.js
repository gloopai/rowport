import {computed, nextTick, ref} from 'vue'

export const logLevelOptions = [
  {label: 'All', value: 'all'},
  {label: 'Info', value: 'info'},
  {label: 'Success', value: 'success'},
  {label: 'Warn', value: 'warn'},
  {label: 'Error', value: 'error'},
  {label: 'Debug', value: 'debug'}
]

export function useOperationLogs({
  copyText,
  downloadText,
  formatLogTime,
  logContext,
  newId
}) {
  const operationLogs = ref([])
  const servicesPanelRef = ref(null)
  const logLevelFilter = ref('all')
  const logSearch = ref('')

  const latestLog = computed(() => operationLogs.value[operationLogs.value.length - 1])
  const visibleLogs = computed(() => {
    const query = logSearch.value.trim().toLowerCase()
    return operationLogs.value.filter((log) => {
      if (logLevelFilter.value !== 'all' && log.level !== logLevelFilter.value) return false
      if (!query) return true
      return `${log.time} ${log.level} ${log.text} ${logContextSummary(log.context)} ${logSql(log.context)}`.toLowerCase().includes(query)
    })
  })

  function addLog(level, text, context = {}) {
    const entry = {
      id: newId(),
      level,
      text,
      time: formatLogTime(new Date()),
      context
    }
    operationLogs.value = [...operationLogs.value.slice(-499), entry]
    nextTick(() => {
      servicesPanelRef.value?.scrollToBottom()
    })
  }

  function clearLogs() {
    operationLogs.value = []
    addLog('info', 'Operation log cleared')
  }

  function copyVisibleLogs() {
    const lines = visibleLogs.value.map((log) => {
      const summary = logContextSummary(log.context)
      const sql = logSql(log.context)
      return [
        `[${log.time}] ${log.level.toUpperCase()} ${log.text} ${summary}`.trim(),
        sql ? `SQL: ${sql}` : ''
      ].filter(Boolean).join('\n')
    })
    copyText(lines.join('\n'), '操作日志')
  }

  function exportVisibleLogsJson() {
    if (!visibleLogs.value.length) return
    downloadText(`rowport-logs-${Date.now()}.json`, JSON.stringify(visibleLogs.value, null, 2), 'application/json;charset=utf-8')
    addLog('success', 'Export visible logs JSON', logContext({rows: visibleLogs.value.length}))
  }

  function exportVisibleLogsCsv() {
    if (!visibleLogs.value.length) return
    const headers = ['time', 'level', 'text', 'context']
    const lines = [
      headers.join(','),
      ...visibleLogs.value.map((log) => [
        csvValue(log.time),
        csvValue(log.level),
        csvValue(log.text),
        csvValue(logContextSummary(log.context))
      ].join(','))
    ]
    downloadText(`rowport-logs-${Date.now()}.csv`, lines.join('\n'), 'text/csv;charset=utf-8')
    addLog('success', 'Export visible logs CSV', logContext({rows: visibleLogs.value.length}))
  }

  return {
    operationLogs,
    servicesPanelRef,
    logLevelFilter,
    logSearch,
    latestLog,
    visibleLogs,
    addLog,
    clearLogs,
    copyVisibleLogs,
    exportVisibleLogsJson,
    exportVisibleLogsCsv,
    logContextSummary,
    logSql
  }
}

function csvValue(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function logContextSummary(context) {
  return Object.entries(context || {})
    .filter(([key, value]) => key !== 'sql' && value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join('  ')
}

function logSql(context) {
  return String(context?.sql || '').trim()
}
