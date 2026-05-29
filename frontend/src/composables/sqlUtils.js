export function compactSql(sql) {
  return String(sql || '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeResultSql(sql) {
  return String(sql || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .replace(/;+\s*$/g, '')
    .trim()
    .toLowerCase()
}

export function explainSql(sql) {
  const trimmed = sql.trim().replace(/;+\s*$/, '')
  if (/^EXPLAIN\b/i.test(trimmed)) return trimmed
  return `EXPLAIN ${trimmed}`
}

export function splitSqlStatements(sql) {
  const spans = statementSpans(sql)
  return spans.map((span) => sql.slice(span.start, span.end).trim()).filter(Boolean)
}

export function currentStatementAt(sql, cursorIndex = 0) {
  const spans = statementSpans(sql)
  const cursor = Math.max(0, Math.min(cursorIndex, sql.length))
  const containing = spans.find((span) => cursor >= span.start && cursor <= span.end)
  if (containing) return sql.slice(containing.start, containing.end).trim()
  const next = spans.find((span) => span.start > cursor)
  return next ? sql.slice(next.start, next.end).trim() : ''
}

export function statementSpans(sql) {
  const spans = []
  let statementStart = 0
  let quote = ''
  let lineComment = false
  let blockComment = false

  const closeStatement = (end) => {
    const raw = sql.slice(statementStart, end)
    const offset = raw.search(/\S/)
    if (offset !== -1) {
      const start = statementStart + offset
      let trimmedEnd = end
      while (trimmedEnd > start && /\s/.test(sql[trimmedEnd - 1])) trimmedEnd -= 1
      spans.push({start, end: trimmedEnd})
    }
    statementStart = end + 1
  }

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    const next = sql[index + 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (char === '\\') {
        index += 1
      } else if (char === quote) {
        if (next === quote) {
          index += 1
        } else {
          quote = ''
        }
      }
      continue
    }
    if ((char === '-' && next === '-') || char === '#') {
      lineComment = true
      if (char === '-') index += 1
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char
      continue
    }
    if (char === ';') closeStatement(index)
  }
  closeStatement(sql.length)
  return spans
}

export function isDangerousSql(sql) {
  const normalized = stripSqlComments(sql).trim().toUpperCase()
  return /^(UPDATE|DELETE)\b/.test(normalized) && !/\bWHERE\b/.test(normalized)
}

export function isSchemaChangingSql(sql) {
  const normalized = stripSqlComments(sql).trim().toUpperCase()
  return /^(ALTER|CREATE|DROP|RENAME|TRUNCATE)\b/.test(normalized)
}

function stripSqlComments(sql) {
  return String(sql || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .replace(/\s+/g, ' ')
}
