package main

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

func (a *App) GetTableData(request TableDataRequest) (TableDataResult, error) {
	request.Database = strings.TrimSpace(request.Database)
	request.Table = strings.TrimSpace(request.Table)
	request.Where = strings.TrimSpace(request.Where)
	request.OrderBy = strings.TrimSpace(request.OrderBy)
	request.OrderDir = strings.ToUpper(strings.TrimSpace(request.OrderDir))
	if request.Database == "" || request.Table == "" {
		return TableDataResult{}, errors.New("database and table are required")
	}
	if hasUnsupportedWhereTokens(request.Where) {
		return TableDataResult{}, errors.New("where clause contains unsupported tokens")
	}
	if request.Page < 1 {
		request.Page = 1
	}
	if request.PageSize < 1 {
		request.PageSize = 50
	}
	if request.PageSize > 500 {
		request.PageSize = 500
	}

	db, err := a.currentDB(request.ProfileID)
	if err != nil {
		return TableDataResult{}, err
	}

	columns, err := a.ListColumns(request.ProfileID, request.Database, request.Table)
	if err != nil {
		return TableDataResult{}, err
	}
	primaryKeys := primaryKeysFromColumns(columns)
	columnSet := make(map[string]bool, len(columns))
	for _, column := range columns {
		columnSet[column.Name] = true
	}
	whereClause := ""
	if request.Where != "" {
		whereClause = " WHERE " + request.Where
	}
	orderClause := ""
	if request.OrderBy != "" {
		if !columnSet[request.OrderBy] {
			return TableDataResult{}, errors.New("order column is not in selected table")
		}
		if request.OrderDir != "DESC" {
			request.OrderDir = "ASC"
		}
		orderClause = " ORDER BY " + quoteIdentifier(request.OrderBy) + " " + request.OrderDir
	}

	ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
	defer cancel()

	var total int64
	countQuery := "SELECT COUNT(*) FROM " + quoteIdentifier(request.Database) + "." + quoteIdentifier(request.Table) + whereClause
	if err := db.QueryRowContext(ctx, countQuery).Scan(&total); err != nil {
		return TableDataResult{}, err
	}

	columnNames := make([]string, 0, len(columns))
	for _, column := range columns {
		columnNames = append(columnNames, quoteIdentifier(column.Name))
	}
	offset := (request.Page - 1) * request.PageSize
	query := "SELECT " + strings.Join(columnNames, ", ") + " FROM " + quoteIdentifier(request.Database) + "." + quoteIdentifier(request.Table) + whereClause + orderClause + " LIMIT ? OFFSET ?"
	rows, err := db.QueryContext(ctx, query, request.PageSize, offset)
	if err != nil {
		return TableDataResult{}, err
	}
	defer rows.Close()

	dataRows, err := scanRowsAsMaps(rows)
	if err != nil {
		return TableDataResult{}, err
	}

	return TableDataResult{
		Columns:     columns,
		PrimaryKeys: primaryKeys,
		Rows:        dataRows,
		Total:       total,
		Page:        request.Page,
		PageSize:    request.PageSize,
	}, nil
}

func (a *App) InsertTableRow(mutation RowMutation) (int64, error) {
	mutation.Database = strings.TrimSpace(mutation.Database)
	mutation.Table = strings.TrimSpace(mutation.Table)
	if mutation.Database == "" || mutation.Table == "" {
		return 0, errors.New("database and table are required")
	}
	if len(mutation.Values) == 0 {
		return 0, errors.New("no fields to insert")
	}

	db, err := a.currentDB(mutation.ProfileID)
	if err != nil {
		return 0, err
	}

	columns := make([]string, 0, len(mutation.Values))
	placeholders := make([]string, 0, len(mutation.Values))
	args := make([]any, 0, len(mutation.Values))
	for column, value := range mutation.Values {
		columns = append(columns, quoteIdentifier(column))
		placeholders = append(placeholders, "?")
		args = append(args, value)
	}
	if len(columns) == 0 {
		return 0, errors.New("no fields to insert")
	}

	query := "INSERT INTO " + quoteIdentifier(mutation.Database) + "." + quoteIdentifier(mutation.Table) + " (" + strings.Join(columns, ", ") + ") VALUES (" + strings.Join(placeholders, ", ") + ")"

	ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
	defer cancel()
	result, err := db.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	affected, _ := result.RowsAffected()
	return affected, nil
}

func (a *App) BulkInsertRows(request BulkInsertRequest) (int64, error) {
	request.Database = strings.TrimSpace(request.Database)
	request.Table = strings.TrimSpace(request.Table)
	if request.Database == "" || request.Table == "" {
		return 0, errors.New("database and table are required")
	}
	if len(request.Rows) == 0 {
		return 0, errors.New("no rows to insert")
	}
	if len(request.Rows) > 1000 {
		return 0, errors.New("cannot import more than 1000 rows at a time")
	}

	db, err := a.currentDB(request.ProfileID)
	if err != nil {
		return 0, err
	}

	columnsInfo, err := a.ListColumns(request.ProfileID, request.Database, request.Table)
	if err != nil {
		return 0, err
	}
	allowedColumns := make(map[string]bool, len(columnsInfo))
	for _, column := range columnsInfo {
		allowedColumns[column.Name] = true
	}

	columns := make([]string, 0)
	for column := range request.Rows[0] {
		if !allowedColumns[column] {
			return 0, fmt.Errorf("column %q is not in selected table", column)
		}
		columns = append(columns, column)
	}
	if len(columns) == 0 {
		return 0, errors.New("no import columns")
	}

	quotedColumns := make([]string, 0, len(columns))
	placeholders := make([]string, 0, len(columns))
	for _, column := range columns {
		quotedColumns = append(quotedColumns, quoteIdentifier(column))
		placeholders = append(placeholders, "?")
	}
	query := "INSERT INTO " + quoteIdentifier(request.Database) + "." + quoteIdentifier(request.Table) + " (" + strings.Join(quotedColumns, ", ") + ") VALUES (" + strings.Join(placeholders, ", ") + ")"

	ctx, cancel := context.WithTimeout(a.ctx, 2*time.Minute)
	defer cancel()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	stmt, err := tx.PrepareContext(ctx, query)
	if err != nil {
		_ = tx.Rollback()
		return 0, err
	}
	defer stmt.Close()

	var affected int64
	for _, row := range request.Rows {
		args := make([]any, 0, len(columns))
		for _, column := range columns {
			args = append(args, row[column])
		}
		result, err := stmt.ExecContext(ctx, args...)
		if err != nil {
			_ = tx.Rollback()
			return 0, err
		}
		rowAffected, _ := result.RowsAffected()
		affected += rowAffected
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return affected, nil
}

func (a *App) UpdateTableRow(mutation RowMutation) (int64, error) {
	mutation.Database = strings.TrimSpace(mutation.Database)
	mutation.Table = strings.TrimSpace(mutation.Table)
	if mutation.Database == "" || mutation.Table == "" {
		return 0, errors.New("database and table are required")
	}
	if len(mutation.KeyValues) == 0 {
		return 0, errors.New("primary key values are required")
	}
	if len(mutation.Values) == 0 {
		return 0, errors.New("no fields to update")
	}

	db, err := a.currentDB(mutation.ProfileID)
	if err != nil {
		return 0, err
	}

	setParts := make([]string, 0, len(mutation.Values))
	args := make([]any, 0, len(mutation.Values)+len(mutation.KeyValues))
	for column, value := range mutation.Values {
		if _, isKey := mutation.KeyValues[column]; isKey {
			continue
		}
		setParts = append(setParts, quoteIdentifier(column)+" = ?")
		args = append(args, value)
	}
	if len(setParts) == 0 {
		return 0, errors.New("no non-key fields to update")
	}

	whereParts, whereArgs := whereClauseFromKeys(mutation.KeyValues)
	args = append(args, whereArgs...)
	query := "UPDATE " + quoteIdentifier(mutation.Database) + "." + quoteIdentifier(mutation.Table) + " SET " + strings.Join(setParts, ", ") + " WHERE " + strings.Join(whereParts, " AND ") + " LIMIT 1"

	ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
	defer cancel()
	result, err := db.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	affected, _ := result.RowsAffected()
	return affected, nil
}

func (a *App) DeleteTableRow(mutation RowMutation) (int64, error) {
	mutation.Database = strings.TrimSpace(mutation.Database)
	mutation.Table = strings.TrimSpace(mutation.Table)
	if mutation.Database == "" || mutation.Table == "" {
		return 0, errors.New("database and table are required")
	}
	if len(mutation.KeyValues) == 0 {
		return 0, errors.New("primary key values are required")
	}

	db, err := a.currentDB(mutation.ProfileID)
	if err != nil {
		return 0, err
	}

	whereParts, args := whereClauseFromKeys(mutation.KeyValues)
	query := "DELETE FROM " + quoteIdentifier(mutation.Database) + "." + quoteIdentifier(mutation.Table) + " WHERE " + strings.Join(whereParts, " AND ") + " LIMIT 1"

	ctx, cancel := context.WithTimeout(a.ctx, 30*time.Second)
	defer cancel()
	result, err := db.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	affected, _ := result.RowsAffected()
	return affected, nil
}

func whereClauseFromKeys(keys map[string]any) ([]string, []any) {
	parts := make([]string, 0, len(keys))
	args := make([]any, 0, len(keys))
	for column, value := range keys {
		if value == nil {
			parts = append(parts, quoteIdentifier(column)+" IS NULL")
			continue
		}
		parts = append(parts, quoteIdentifier(column)+" = ?")
		args = append(args, value)
	}
	return parts, args
}

// hasUnsupportedWhereTokens rejects WHERE fragments that could be used to
// chain extra statements or smuggle SQL comments. This is a defensive guard,
// not a full parser: the fragment is still interpolated into the query, so it
// only blocks the obvious statement-breaking and comment tokens.
func hasUnsupportedWhereTokens(where string) bool {
	if strings.ContainsRune(where, '\x00') {
		return true
	}
	for _, token := range []string{";", "--", "/*", "*/", "#"} {
		if strings.Contains(where, token) {
			return true
		}
	}
	return false
}
