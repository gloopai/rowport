export function demoTableData(page = 1, pageSize = 50) {
  return {
    columns: [
      {name: 'id', type: 'bigint', key: 'PRI'},
      {name: 'name', type: 'varchar(120)', key: ''},
      {name: 'email', type: 'varchar(160)', key: ''},
      {name: 'created_at', type: 'datetime', key: ''}
    ],
    primaryKeys: ['id'],
    rows: [
      {id: 1, name: 'Ada Lovelace', email: 'ada@example.com', created_at: '2026-05-28 10:20:00'},
      {id: 2, name: 'Grace Hopper', email: 'grace@example.com', created_at: '2026-05-28 10:21:00'}
    ],
    total: 2,
    page,
    pageSize
  }
}

export function quoteIdentifier(name) {
  return `\`${String(name).replace(/`/g, '``')}\``
}

export function quoteSqlIdentifier(value) {
  return `\`${String(value || '').replace(/`/g, '``')}\``
}

export function sqlLiteral(value, column) {
  const text = String(value)
  const type = String(column?.type || '').toLowerCase()
  if (/^(tinyint|smallint|mediumint|int|bigint|decimal|float|double|real|bit)/.test(type) && /^-?\d+(\.\d+)?$/.test(text.trim())) {
    return text.trim()
  }
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
}

export function logSqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
}

export function placeholderList(count) {
  return Array.from({length: count}, () => '?').join(', ')
}

export function tablePageLogSql({database, table, columns = [], where = '', orderBy = '', orderDir = 'ASC', page = 1, pageSize = 50}) {
  const selectedColumns = columns.length ? columns.map((column) => quoteSqlIdentifier(column.name || column)).join(', ') : '*'
  const safeOrderDir = orderDir === 'DESC' ? 'DESC' : 'ASC'
  const offset = (Number(page) - 1) * Number(pageSize)
  const whereClause = where ? ` WHERE ${where}` : ''
  const orderClause = orderBy ? ` ORDER BY ${quoteSqlIdentifier(orderBy)} ${safeOrderDir}` : ''
  return `SELECT ${selectedColumns} FROM ${quoteSqlIdentifier(database)}.${quoteSqlIdentifier(table)}${whereClause}${orderClause} LIMIT ${Number(pageSize)} OFFSET ${offset}`
}

export function insertRowLogSql(database, table, values) {
  const columns = Object.keys(values || {})
  return `INSERT INTO ${quoteSqlIdentifier(database)}.${quoteSqlIdentifier(table)} (${columns.map(quoteSqlIdentifier).join(', ')}) VALUES (${placeholderList(columns.length)})`
}

export function updateRowLogSql(database, table, values, keyValues) {
  const setColumns = Object.keys(values || {}).filter((column) => !Object.prototype.hasOwnProperty.call(keyValues || {}, column))
  const whereColumns = Object.keys(keyValues || {})
  const setClause = setColumns.map((column) => `${quoteSqlIdentifier(column)} = ?`).join(', ')
  const whereClause = whereColumns.map((column) => `${quoteSqlIdentifier(column)} = ${logSqlLiteral(keyValues[column])}`).join(' AND ')
  return `UPDATE ${quoteSqlIdentifier(database)}.${quoteSqlIdentifier(table)} SET ${setClause} WHERE ${whereClause} LIMIT 1`
}

export function deleteRowLogSql(database, table, keyValues) {
  const whereClause = Object.keys(keyValues || {})
    .map((column) => `${quoteSqlIdentifier(column)} = ${logSqlLiteral(keyValues[column])}`)
    .join(' AND ')
  return `DELETE FROM ${quoteSqlIdentifier(database)}.${quoteSqlIdentifier(table)} WHERE ${whereClause} LIMIT 1`
}

export function tableCellText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function isNullableColumn(column) {
  return column?.nullable === 'YES'
}

export function isLongTextColumn(column) {
  const type = String(column?.type || '').toLowerCase()
  return type.includes('text') || type.includes('json') || type.includes('blob') || type.includes('longvarchar')
}

export function mutationValuesFrom(values, nulls) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, nulls[key] ? null : value]))
}

export function csvEscape(value) {
  const text = tableCellText(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function parseCsv(content) {
  const rows = []
  let current = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    const next = content[index + 1]
    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      current.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      current.push(cell)
      if (current.some((value) => value !== '')) rows.push(current)
      current = []
      cell = ''
    } else {
      cell += char
    }
  }
  current.push(cell)
  if (current.some((value) => value !== '')) rows.push(current)
  const columns = rows[0] || []
  const dataRows = rows.slice(1)
  return {columns, rows: dataRows, previewRows: dataRows.slice(0, 20), total: dataRows.length}
}
