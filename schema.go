package main

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"
)

func (a *App) ListDatabases(profileID string) ([]DatabaseInfo, error) {
	db, err := a.currentDB(profileID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel()
	rows, err := db.QueryContext(ctx, "SHOW DATABASES")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var databases []DatabaseInfo
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		databases = append(databases, DatabaseInfo{Name: name})
	}
	return databases, rows.Err()
}

func (a *App) ListTables(profileID string, database string) ([]TableInfo, error) {
	if database == "" {
		return nil, errors.New("database is required")
	}
	db, err := a.currentDB(profileID)
	if err != nil {
		return nil, err
	}

	const query = `
SELECT table_name, table_type, table_rows, COALESCE(engine, '')
FROM information_schema.tables
WHERE table_schema = ?
ORDER BY table_type, table_name`

	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel()
	rows, err := db.QueryContext(ctx, query, database)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []TableInfo
	for rows.Next() {
		var item TableInfo
		var rowCount sql.NullInt64
		if err := rows.Scan(&item.Name, &item.Type, &rowCount, &item.Engine); err != nil {
			return nil, err
		}
		if rowCount.Valid {
			item.Rows = rowCount.Int64
		}
		tables = append(tables, item)
	}
	return tables, rows.Err()
}

func (a *App) ListColumns(profileID string, database string, table string) ([]ColumnInfo, error) {
	if database == "" || table == "" {
		return nil, errors.New("database and table are required")
	}
	db, err := a.currentDB(profileID)
	if err != nil {
		return nil, err
	}

	const query = `
SELECT column_name, column_type, is_nullable, column_key, column_default, extra, column_comment, ordinal_position
FROM information_schema.columns
WHERE table_schema = ? AND table_name = ?
ORDER BY ordinal_position`

	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel()
	rows, err := db.QueryContext(ctx, query, database, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var columns []ColumnInfo
	for rows.Next() {
		var item ColumnInfo
		var def sql.NullString
		if err := rows.Scan(&item.Name, &item.Type, &item.Nullable, &item.Key, &def, &item.Extra, &item.Comment, &item.OrdinalPos); err != nil {
			return nil, err
		}
		if def.Valid {
			item.Default = def.String
		}
		columns = append(columns, item)
	}
	return columns, rows.Err()
}

func (a *App) ListIndexes(profileID string, database string, table string) ([]IndexInfo, error) {
	if database == "" || table == "" {
		return nil, errors.New("database and table are required")
	}
	db, err := a.currentDB(profileID)
	if err != nil {
		return nil, err
	}

	const query = `
SELECT index_name, column_name, non_unique, seq_in_index, index_type, cardinality, sub_part, nullable
FROM information_schema.statistics
WHERE table_schema = ? AND table_name = ?
ORDER BY index_name, seq_in_index`

	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel()
	rows, err := db.QueryContext(ctx, query, database, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var indexes []IndexInfo
	for rows.Next() {
		var item IndexInfo
		var nonUnique int
		var cardinality sql.NullInt64
		var subPart sql.NullInt64
		if err := rows.Scan(&item.IndexName, &item.ColumnName, &nonUnique, &item.SeqInIndex, &item.IndexType, &cardinality, &subPart, &item.Nullable); err != nil {
			return nil, err
		}
		item.NonUnique = nonUnique == 1
		if cardinality.Valid {
			item.Cardinality = cardinality.Int64
		}
		if subPart.Valid {
			item.SubPart = subPart.Int64
		}
		indexes = append(indexes, item)
	}
	return indexes, rows.Err()
}

func (a *App) ShowCreateTable(profileID string, database string, table string) (string, error) {
	database = strings.TrimSpace(database)
	table = strings.TrimSpace(table)
	if database == "" || table == "" {
		return "", errors.New("database and table are required")
	}
	db, err := a.currentDB(profileID)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(a.ctx, 15*time.Second)
	defer cancel()
	var tableName string
	var ddl string
	query := "SHOW CREATE TABLE " + quoteIdentifier(database) + "." + quoteIdentifier(table)
	if err := db.QueryRowContext(ctx, query).Scan(&tableName, &ddl); err != nil {
		return "", err
	}
	return ddl, nil
}

func primaryKeysFromColumns(columns []ColumnInfo) []string {
	var keys []string
	for _, column := range columns {
		if column.Key == "PRI" {
			keys = append(keys, column.Name)
		}
	}
	return keys
}
