const SQL_KEYWORDS = new Set([
  'select',
  'from',
  'where',
  'insert',
  'into',
  'values',
  'update',
  'set',
  'delete',
  'join',
  'inner',
  'left',
  'right',
  'outer',
  'cross',
  'on',
  'as',
  'and',
  'or',
  'not',
  'null',
  'is',
  'in',
  'like',
  'between',
  'exists',
  'order',
  'by',
  'group',
  'having',
  'limit',
  'offset',
  'distinct',
  'union',
  'all',
  'with',
  'case',
  'when',
  'then',
  'else',
  'end',
  'create',
  'alter',
  'drop',
  'table',
  'index',
  'view',
  'database',
  'use',
  'show',
  'describe',
  'desc',
  'explain',
  'primary',
  'key',
  'foreign',
  'references',
  'default',
  'auto_increment',
  'true',
  'false',
  'count',
  'sum',
  'avg',
  'min',
  'max'
])

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function wrap(className, text) {
  return `<span class="${className}">${escapeHtml(text)}</span>`
}

function highlightToken(token) {
  const lower = token.toLowerCase()
  if (SQL_KEYWORDS.has(lower)) return wrap('sql-kw', token)
  if (/^'(?:''|[^'])*'$/.test(token) || /^"(?:\\.|[^"\\])*"$/.test(token)) return wrap('sql-str', token)
  if (/^`(?:``|[^`])*`$/.test(token)) return wrap('sql-id', token)
  if (/^\d+(?:\.\d+)?$/.test(token)) return wrap('sql-num', token)
  return escapeHtml(token)
}

// Lightweight SQL highlighter for the editor backdrop. Not a full parser; good
// enough for keywords, quoted identifiers, strings, numbers, and comments.
export function highlightSql(sql) {
  if (!sql) return '\n'

  let html = ''
  let i = 0
  while (i < sql.length) {
    const rest = sql.slice(i)

    if (rest.startsWith('--')) {
      const end = rest.indexOf('\n')
      const chunk = end === -1 ? rest : rest.slice(0, end)
      html += wrap('sql-cmt', chunk)
      i += chunk.length
      continue
    }

    if (rest.startsWith('/*')) {
      const end = rest.indexOf('*/')
      const chunk = end === -1 ? rest : rest.slice(0, end + 2)
      html += wrap('sql-cmt', chunk)
      i += chunk.length
      continue
    }

    if (rest[0] === "'" || rest[0] === '"' || rest[0] === '`') {
      const quote = rest[0]
      let j = 1
      while (j < rest.length) {
        if (rest[j] === quote) {
          if (quote === "'" && rest[j + 1] === "'") {
            j += 2
            continue
          }
          if (quote === '`' && rest[j + 1] === '`') {
            j += 2
            continue
          }
          j += 1
          break
        }
        if (quote === '"' && rest[j] === '\\') {
          j += 2
          continue
        }
        j += 1
      }
      const token = rest.slice(0, j)
      html += highlightToken(token)
      i += token.length
      continue
    }

    const match = rest.match(/^[\w$]+/)
    if (match) {
      html += highlightToken(match[0])
      i += match[0].length
      continue
    }

    html += escapeHtml(rest[0])
    i += 1
  }

  return html + '\n'
}
