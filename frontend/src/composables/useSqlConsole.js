import {ref} from 'vue'
import {
  CancelQuery,
  ExecuteWithID,
  OpenSQLFile
} from '../../wailsjs/go/main/App'
import {useQueryHistory} from './useQueryHistory'
import {useResultTabs} from './useResultTabs'
import {
  compactSql,
  currentStatementAt,
  explainSql,
  isDangerousSql,
  isSchemaChangingSql,
  normalizeResultSql,
  splitSqlStatements
} from './sqlUtils'

export function useSqlConsole({
  activeProfileId,
  activeProfileName,
  appendLog,
  askConfirm,
  busy,
  currentTab,
  elapsedSince,
  errorMessage,
  formatLogTime,
  hasRuntime,
  invalidateSchemaCache,
  loadTablePage,
  logContext,
  metadataKey,
  newId,
  openConsoleTab,
  perfStart,
  refreshTables,
  selectedDatabase,
  selectedTable,
  setMessage,
  tableData,
  tableMetadata,
  virtualRows,
  rowHeight
}) {
  const query = ref('SELECT 1;')
  const queryEditorRef = ref(null)
  const queryToolbarRef = ref(null)
  const querySelection = ref({start: 0, end: 0})
  const runningQueryId = ref('')
  const sqlResultPaneRef = ref(null)
  const resultDetailOpen = ref(false)
  const resultDetail = ref({title: '', fields: []})

  const resultTabsApi = useResultTabs({
    newId,
    resultTabKey,
    formatLogTime,
    virtualRows,
    rowHeight,
    resultPaneRef: sqlResultPaneRef
  })

  const historyApi = useQueryHistory({
    activeProfileId,
    selectedDatabase,
    query,
    normalizeResultSql,
    splitSqlStatements,
    currentSqlText,
    activeProfileName,
    compactSql,
    addLog: appendLog,
    logContext,
    newId
  })

  async function runQuery(target = 'smart') {
    await executeSql('query', target)
  }

  async function explainQuery(target = 'smart') {
    await executeSql('explain', target)
  }

  async function cancelRunningQuery() {
    if (!runningQueryId.value) return
    const queryID = runningQueryId.value
    appendLog('warn', 'Cancel SQL query', logContext({queryId: queryID}))
    if (!hasRuntime()) {
      runningQueryId.value = ''
      busy.value = false
      setMessage('Preview query cancelled', 'warn', logContext({queryId: queryID}))
      return
    }
    try {
      const cancelled = await CancelQuery(queryID)
      if (!cancelled) {
        setMessage('查询已结束，无法取消', 'warn', logContext({queryId: queryID}))
      }
    } catch (error) {
      setMessage(errorMessage(error), 'error', logContext({operation: 'cancelQuery', queryId: queryID}))
    }
  }

  async function executeSql(mode = 'query', target = 'smart') {
    syncQuerySelection()
    const execution = sqlExecutionTarget(target)
    if (!execution.statements.length) {
      setMessage('SQL 为空', 'warn', logContext())
      return
    }
    const dangerousSql = mode === 'query' ? execution.statements.find((statement) => isDangerousSql(statement)) : ''
    if (dangerousSql && !await askConfirm('确认执行 SQL', '检测到 UPDATE 或 DELETE 语句没有 WHERE 条件。这个操作可能影响整张表，确定继续执行？', '继续执行')) {
      appendLog('warn', 'SQL execution cancelled by safety guard', logContext({scope: execution.scope, sql: dangerousSql}))
      return
    }
    const profileId = activeProfileId.value
    const startedAt = perfStart()
    busy.value = true
    let completed = 0
    let lastResult = null
    try {
      for (let index = 0; index < execution.statements.length; index += 1) {
        const sourceSql = execution.statements[index]
        const executableSql = mode === 'explain' ? explainSql(sourceSql) : sourceSql
        const queryID = newId()
        runningQueryId.value = queryID
        appendLog('info', mode === 'explain' ? 'Explain SQL' : 'Execute SQL', logContext({
          profileId,
          database: selectedDatabase.value,
          queryId: queryID,
          scope: execution.scope,
          statement: execution.statements.length > 1 ? `${index + 1}/${execution.statements.length}` : '',
          sql: executableSql
        }))

        if (!hasRuntime()) {
          lastResult = {
            columns: mode === 'explain' ? ['id', 'select_type', 'table', 'type', 'rows', 'Extra'] : ['id', 'name'],
            rows: mode === 'explain' ? [[1, 'SIMPLE', 'users', 'ALL', 2, 'Using where']] : [[index + 1, 'preview']],
            rowsAffected: 1,
            elapsedMs: 1,
            message: 'Preview result'
          }
          resultTabsApi.appendResultTab({mode, sql: executableSql, result: lastResult, scope: execution.scope, statementIndex: index})
        } else {
          lastResult = await ExecuteWithID(queryID, profileId, executableSql, selectedDatabase.value)
          resultTabsApi.appendResultTab({mode, sql: executableSql, result: lastResult, scope: execution.scope, statementIndex: index})
          if (mode === 'query' && selectedDatabase.value && isSchemaChangingSql(executableSql)) {
            invalidateSchemaCache(profileId, selectedDatabase.value, '', {tableList: true})
            await refreshTables(profileId, selectedDatabase.value, true)
            appendLog('info', 'Schema cache invalidated after DDL', logContext({profileId, database: selectedDatabase.value}))
          }
        }
        completed += 1
      }
      const messageText = execution.statements.length > 1 ? `执行完成：${completed}/${execution.statements.length} 条 SQL` : (lastResult?.message || '执行完成')
      historyApi.recordQueryHistory(execution.historySql, {
        mode,
        scope: execution.scope,
        status: 'success',
        rows: lastResult?.rows?.length || 0,
        affected: lastResult?.rowsAffected || 0,
        elapsedMs: elapsedSince(startedAt),
        statements: completed
      })
      setMessage(messageText, 'success', logContext({
        scope: execution.scope,
        elapsedMs: lastResult?.elapsedMs || 0,
        totalElapsedMs: elapsedSince(startedAt),
        statements: completed,
        rows: lastResult?.rows?.length || 0,
        affected: lastResult?.rowsAffected || 0
      }))
      if (selectedTable.value) await loadTablePage(tableData.value.page)
    } catch (error) {
      const message = errorMessage(error)
      const wasCancelled = /context canceled|cancel/i.test(message)
      historyApi.recordQueryHistory(execution.historySql, {
        mode,
        scope: execution.scope,
        status: wasCancelled ? 'cancelled' : 'error',
        rows: 0,
        affected: 0,
        elapsedMs: elapsedSince(startedAt),
        statements: completed,
        error: message
      })
      setMessage(wasCancelled ? `查询已取消：已完成 ${completed}/${execution.statements.length} 条 SQL` : message, wasCancelled ? 'warn' : 'error', logContext({operation: mode === 'explain' ? 'explain' : 'execute', scope: execution.scope}))
    } finally {
      runningQueryId.value = ''
      busy.value = false
    }
  }

  function resultTabKey({mode, sql, scope, statementIndex}) {
    return [
      currentTab.value?.id || 'console',
      mode,
      scope,
      statementIndex,
      normalizeResultSql(sql)
    ].join('|')
  }

  function syncQuerySelection() {
    const editor = queryEditorRef.value?.getElement?.()
    if (!editor) return
    querySelection.value = {
      start: editor.selectionStart ?? 0,
      end: editor.selectionEnd ?? 0
    }
  }

  function sqlExecutionTarget(target = 'smart') {
    const editor = queryEditorRef.value?.getElement?.()
    const start = editor?.selectionStart ?? 0
    const end = editor?.selectionEnd ?? 0
    const selected = start !== end ? query.value.slice(start, end).trim() : ''
    if ((target === 'selection' || target === 'smart') && selected) {
      return {
        scope: 'selection',
        historySql: selected,
        statements: splitSqlStatements(selected)
      }
    }
    if (target === 'all') {
      return {
        scope: 'all',
        historySql: query.value.trim(),
        statements: splitSqlStatements(query.value)
      }
    }
    const statement = currentStatementAt(query.value, start) || query.value.trim()
    return {
      scope: 'current',
      historySql: statement,
      statements: splitSqlStatements(statement).slice(0, 1)
    }
  }

  function currentSqlText() {
    return sqlExecutionTarget('smart').statements[0] || ''
  }

  async function openSqlFile() {
    if (!hasRuntime()) {
      setMessage('当前是浏览器预览，打开 SQL 文件需要在 Wails 客户端中使用', 'warn')
      return
    }
    try {
      const content = await OpenSQLFile()
      if (!content) return
      query.value = content
      openConsoleTab()
      appendLog('success', 'SQL file opened', logContext({chars: content.length}))
      setMessage('SQL 文件已打开', 'success')
    } catch (error) {
      setMessage(errorMessage(error), 'error', logContext({operation: 'openSqlFile'}))
    }
  }

  function formatQuery() {
    const formatted = query.value
      .replace(/\s+/g, ' ')
      .replace(/\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|LEFT JOIN|RIGHT JOIN|INNER JOIN|JOIN|ON)\b/gi, '\n$1')
      .replace(/,\s*/g, ',\n  ')
      .replace(/^\n/, '')
      .trim()
    query.value = formatted
    appendLog('debug', 'Format SQL', logContext())
  }

  function insertSqlTemplate(type, database = selectedDatabase.value, tableName = selectedTable.value, profileId = activeProfileId.value) {
    if (!database || !tableName) return
    const table = `\`${database}\`.\`${tableName}\``
    const metadata = tableMetadata.value[metadataKey(profileId, database, tableName)]
    const sourceColumns = database === selectedDatabase.value && tableName === selectedTable.value && tableData.value.columns.length
      ? tableData.value.columns
      : (metadata?.columns || [])
    const primaryKeys = sourceColumns.filter((column) => column.key === 'PRI').map((column) => column.name)
    const columns = sourceColumns.map((column) => `\`${column.name}\``)
    const templateMap = {
      select: `SELECT ${columns.length ? columns.join(', ') : '*'}\nFROM ${table}\nLIMIT 100;`,
      insert: `INSERT INTO ${table} (${columns.join(', ')})\nVALUES (${columns.map(() => '?').join(', ')});`,
      update: `UPDATE ${table}\nSET ${columns[0] || '`column`'} = ?\nWHERE ${primaryKeys.map((key) => `\`${key}\` = ?`).join(' AND ') || '1 = 0'};`,
      delete: `DELETE FROM ${table}\nWHERE ${primaryKeys.map((key) => `\`${key}\` = ?`).join(' AND ') || '1 = 0'}\nLIMIT 1;`
    }
    query.value = templateMap[type] || query.value
    openConsoleTab()
    appendLog('info', 'Insert SQL template', logContext({type}))
  }

  function handleQueryKeydown(event) {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'Enter') {
      event.preventDefault()
      runQuery('all')
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      runQuery('smart')
    }
  }

  function resultRowsToCsv(resultTab = resultTabsApi.activeResultTab.value) {
    if (!resultTab?.columns?.length) return ''
    const lines = [resultTab.columns.map(csvEscape).join(',')]
    for (const row of resultTab.rows || []) {
      lines.push(resultTab.columns.map((_, index) => csvEscape(row[index])).join(','))
    }
    return lines.join('\n')
  }

  function copyResultRows(copyText) {
    if (!resultTabsApi.activeResultTab.value?.columns?.length) return
    copyText(resultRowsToCsv(), '查询结果')
  }

  function exportResultCsv(downloadText) {
    if (!resultTabsApi.activeResultTab.value?.columns?.length) return
    const csv = resultRowsToCsv()
    downloadText(`${resultTabsApi.activeResultTab.value.title.replace(/\s+/g, '_')}.csv`, csv, 'text/csv;charset=utf-8')
    appendLog('success', 'Export SQL result CSV', logContext({rows: resultTabsApi.activeResultTab.value.rows?.length || 0}))
  }

  function exportResultJson(downloadText) {
    if (!resultTabsApi.activeResultTab.value?.columns?.length) return
    const rows = (resultTabsApi.activeResultTab.value.rows || []).map((row) => Object.fromEntries(resultTabsApi.activeResultTab.value.columns.map((column, index) => [column, row[index]])))
    downloadText(`${resultTabsApi.activeResultTab.value.title.replace(/\s+/g, '_')}.json`, JSON.stringify(rows, null, 2), 'application/json;charset=utf-8')
    appendLog('success', 'Export SQL result JSON', logContext({rows: rows.length}))
  }

  function openResultDetail(row, rowIndex) {
    if (!resultTabsApi.activeResultTab.value?.columns?.length) return
    resultDetail.value = {
      title: `${resultTabsApi.activeResultTab.value.title} / row ${rowIndex + 1}`,
      fields: resultTabsApi.activeResultTab.value.columns.map((column, index) => ({
        column,
        value: formatDetailValue(row[index])
      }))
    }
    resultDetailOpen.value = true
    appendLog('debug', 'Open SQL result row detail', logContext({row: rowIndex + 1, columns: resultTabsApi.activeResultTab.value.columns.length}))
  }

  function chooseHistory(value, closeCustomSelect) {
    historyApi.chooseHistory(value)
    closeCustomSelect?.()
  }

  return {
    query,
    queryEditorRef,
    queryToolbarRef,
    querySelection,
    runningQueryId,
    sqlResultPaneRef,
    resultDetailOpen,
    resultDetail,
    ...resultTabsApi,
    ...historyApi,
    runQuery,
    explainQuery,
    cancelRunningQuery,
    executeSql,
    syncQuerySelection,
    sqlExecutionTarget,
    currentSqlText,
    openSqlFile,
    formatQuery,
    insertSqlTemplate,
    handleQueryKeydown,
    resultRowsToCsv,
    copyResultRows,
    exportResultCsv,
    exportResultJson,
    openResultDetail,
    chooseHistory
  }
}

function csvEscape(value) {
  const text = tableCellText(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function tableCellText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatDetailValue(value) {
  if (value === null || value === undefined) return '<null>'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}
