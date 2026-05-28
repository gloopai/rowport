package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/go-sql-driver/mysql"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/crypto/ssh"
)

type App struct {
	ctx             context.Context
	mu              sync.Mutex
	sessions        map[string]*ConnectionSession
	activeProfileID string
	queryCancels    map[string]context.CancelFunc
}

type ConnectionSession struct {
	db        *sql.DB
	tunnel    *SSHTunnel
	config    ConnectionConfig
	mysqlAddr string
}

type ConnectionConfig struct {
	ID               string         `json:"id"`
	Name             string         `json:"name"`
	Host             string         `json:"host"`
	Port             string         `json:"port"`
	User             string         `json:"user"`
	Password         string         `json:"password"`
	RememberPassword bool           `json:"rememberPassword"`
	Database         string         `json:"database"`
	SSH              SSHConfig      `json:"ssh"`
	Advanced         AdvancedConfig `json:"advanced"`
}

type AdvancedConfig struct {
	ConnectTimeoutSeconds int `json:"connectTimeoutSeconds"`
	MaxOpenConns          int `json:"maxOpenConns"`
	MaxIdleConns          int `json:"maxIdleConns"`
}

type SSHConfig struct {
	Enabled            bool   `json:"enabled"`
	Host               string `json:"host"`
	Port               string `json:"port"`
	User               string `json:"user"`
	Password           string `json:"password"`
	RememberPassword   bool   `json:"rememberPassword"`
	PrivateKey         string `json:"privateKey"`
	PrivateKeyPath     string `json:"privateKeyPath"`
	Passphrase         string `json:"passphrase"`
	RememberPassphrase bool   `json:"rememberPassphrase"`
}

type ConnectionStatus struct {
	Connected bool   `json:"connected"`
	Database  string `json:"database"`
	Server    string `json:"server"`
	User      string `json:"user"`
	ViaSSH    bool   `json:"viaSsh"`
}

type DatabaseInfo struct {
	Name string `json:"name"`
}

type TableInfo struct {
	Name   string `json:"name"`
	Type   string `json:"type"`
	Rows   any    `json:"rows"`
	Engine string `json:"engine"`
}

type ColumnInfo struct {
	Name       string `json:"name"`
	Type       string `json:"type"`
	Nullable   string `json:"nullable"`
	Key        string `json:"key"`
	Default    any    `json:"default"`
	Extra      string `json:"extra"`
	Comment    string `json:"comment"`
	OrdinalPos int    `json:"ordinalPos"`
}

type IndexInfo struct {
	IndexName   string `json:"indexName"`
	ColumnName  string `json:"columnName"`
	NonUnique   bool   `json:"nonUnique"`
	SeqInIndex  int    `json:"seqInIndex"`
	IndexType   string `json:"indexType"`
	Cardinality any    `json:"cardinality"`
	SubPart     any    `json:"subPart"`
	Nullable    string `json:"nullable"`
}

type QueryResult struct {
	Columns      []string `json:"columns"`
	Rows         [][]any  `json:"rows"`
	RowsAffected int64    `json:"rowsAffected"`
	ElapsedMs    int64    `json:"elapsedMs"`
	Message      string   `json:"message"`
	Truncated    bool     `json:"truncated"`
}

type TableDataRequest struct {
	ProfileID string `json:"profileId"`
	Database  string `json:"database"`
	Table     string `json:"table"`
	Page      int    `json:"page"`
	PageSize  int    `json:"pageSize"`
	Where     string `json:"where"`
	OrderBy   string `json:"orderBy"`
	OrderDir  string `json:"orderDir"`
}

type TableDataResult struct {
	Columns     []ColumnInfo     `json:"columns"`
	PrimaryKeys []string         `json:"primaryKeys"`
	Rows        []map[string]any `json:"rows"`
	Total       int64            `json:"total"`
	Page        int              `json:"page"`
	PageSize    int              `json:"pageSize"`
}

type RowMutation struct {
	ProfileID string         `json:"profileId"`
	Database  string         `json:"database"`
	Table     string         `json:"table"`
	KeyValues map[string]any `json:"keyValues"`
	Values    map[string]any `json:"values"`
}

type BulkInsertRequest struct {
	ProfileID string           `json:"profileId"`
	Database  string           `json:"database"`
	Table     string           `json:"table"`
	Rows      []map[string]any `json:"rows"`
}

type StoredCredentials struct {
	MySQLPassword         string `json:"mysqlPassword"`
	RememberMySQLPassword bool   `json:"rememberMysqlPassword"`
	SSHPassword           string `json:"sshPassword"`
	RememberSSHPassword   bool   `json:"rememberSshPassword"`
	SSHPassphrase         string `json:"sshPassphrase"`
	RememberSSHPassphrase bool   `json:"rememberSshPassphrase"`
}

type SSHTunnel struct {
	client   *ssh.Client
	listener net.Listener
	remote   string
	done     chan struct{}
}

func NewApp() *App {
	return &App{
		sessions:     make(map[string]*ConnectionSession),
		queryCancels: make(map[string]context.CancelFunc),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) shutdown(ctx context.Context) {
	_ = a.DisconnectAll()
}

func (a *App) Connect(config ConnectionConfig) (ConnectionStatus, error) {
	config = normalizeConfig(config)
	if config.ID == "" {
		config.ID = defaultProfileID(config)
	}
	session, err := a.openConnection(config)
	if err != nil {
		return ConnectionStatus{}, err
	}

	a.mu.Lock()
	if a.sessions == nil {
		a.sessions = make(map[string]*ConnectionSession)
	}
	old := a.sessions[config.ID]
	a.sessions[config.ID] = session
	a.activeProfileID = config.ID
	a.mu.Unlock()

	if old != nil {
		_ = old.Close()
	}

	return a.StatusForProfile(config.ID), nil
}

func (a *App) TestConnection(config ConnectionConfig) (ConnectionStatus, error) {
	config = normalizeConfig(config)
	if config.ID == "" {
		config.ID = defaultProfileID(config)
	}
	session, err := a.openConnection(config)
	if err != nil {
		return ConnectionStatus{}, err
	}
	defer session.Close()
	return ConnectionStatus{
		Connected: true,
		Database:  session.config.Database,
		Server:    net.JoinHostPort(session.config.Host, session.config.Port),
		User:      session.config.User,
		ViaSSH:    session.config.SSH.Enabled,
	}, nil
}

func (a *App) openConnection(config ConnectionConfig) (*ConnectionSession, error) {
	if err := hydrateRememberedCredentials(&config); err != nil {
		return nil, err
	}
	if config.Host == "" || config.Port == "" || config.User == "" {
		return nil, errors.New("host, port, and user are required")
	}

	mysqlAddr := net.JoinHostPort(config.Host, config.Port)
	var tunnel *SSHTunnel
	if config.SSH.Enabled {
		nextTunnel, localAddr, err := startSSHTunnel(config.SSH, mysqlAddr)
		if err != nil {
			return nil, err
		}
		tunnel = nextTunnel
		mysqlAddr = localAddr
	}

	db, err := sql.Open("mysql", buildDSN(config, mysqlAddr))
	if err != nil {
		if tunnel != nil {
			_ = tunnel.Close()
		}
		return nil, err
	}
	db.SetMaxOpenConns(config.Advanced.MaxOpenConns)
	db.SetMaxIdleConns(config.Advanced.MaxIdleConns)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(a.ctx, time.Duration(config.Advanced.ConnectTimeoutSeconds)*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		if tunnel != nil {
			_ = tunnel.Close()
		}
		return nil, err
	}

	return &ConnectionSession{db: db, tunnel: tunnel, config: config, mysqlAddr: mysqlAddr}, nil
}

func (a *App) LoadCredentials(profileID string) (StoredCredentials, error) {
	profileID = strings.TrimSpace(profileID)
	if profileID == "" {
		return StoredCredentials{}, nil
	}
	return StoredCredentials{
		MySQLPassword: readKeychainSecret(profileID, "mysql-password"),
		SSHPassword:   readKeychainSecret(profileID, "ssh-password"),
		SSHPassphrase: readKeychainSecret(profileID, "ssh-passphrase"),
	}, nil
}

func (a *App) SaveCredentials(profileID string, credentials StoredCredentials) error {
	profileID = strings.TrimSpace(profileID)
	if profileID == "" {
		return errors.New("profile id is required")
	}

	if !credentials.RememberMySQLPassword {
		deleteKeychainSecret(profileID, "mysql-password")
	} else if credentials.MySQLPassword != "" {
		if err := writeKeychainSecret(profileID, "mysql-password", credentials.MySQLPassword); err != nil {
			return err
		}
	}
	if !credentials.RememberSSHPassword {
		deleteKeychainSecret(profileID, "ssh-password")
	} else if credentials.SSHPassword != "" {
		if err := writeKeychainSecret(profileID, "ssh-password", credentials.SSHPassword); err != nil {
			return err
		}
	}
	if !credentials.RememberSSHPassphrase {
		deleteKeychainSecret(profileID, "ssh-passphrase")
	} else if credentials.SSHPassphrase != "" {
		if err := writeKeychainSecret(profileID, "ssh-passphrase", credentials.SSHPassphrase); err != nil {
			return err
		}
	}
	return nil
}

func (a *App) DeleteCredentials(profileID string) error {
	profileID = strings.TrimSpace(profileID)
	if profileID == "" {
		return nil
	}
	deleteKeychainSecret(profileID, "mysql-password")
	deleteKeychainSecret(profileID, "ssh-password")
	deleteKeychainSecret(profileID, "ssh-passphrase")
	return nil
}

func (a *App) ChoosePrivateKeyPath() (string, error) {
	return wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Select SSH private key",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "Private keys", Pattern: "*"},
		},
	})
}

func (a *App) OpenSQLFile() (string, error) {
	path, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Open SQL file",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "SQL files", Pattern: "*.sql"},
			{DisplayName: "Text files", Pattern: "*.txt"},
			{DisplayName: "All files", Pattern: "*"},
		},
	})
	if err != nil || strings.TrimSpace(path) == "" {
		return "", err
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

func (a *App) OpenCSVFile() (string, error) {
	path, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Open CSV file",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "CSV files", Pattern: "*.csv"},
			{DisplayName: "Text files", Pattern: "*.txt"},
			{DisplayName: "All files", Pattern: "*"},
		},
	})
	if err != nil || strings.TrimSpace(path) == "" {
		return "", err
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

func (a *App) Disconnect() error {
	a.mu.Lock()
	profileID := a.activeProfileID
	a.mu.Unlock()
	if profileID == "" {
		return nil
	}
	return a.DisconnectProfile(profileID)
}

func (a *App) DisconnectProfile(profileID string) error {
	profileID = strings.TrimSpace(profileID)
	if profileID == "" {
		return errors.New("profile id is required")
	}

	a.mu.Lock()
	session := a.sessions[profileID]
	delete(a.sessions, profileID)
	if a.activeProfileID == profileID {
		a.activeProfileID = ""
		for nextID := range a.sessions {
			a.activeProfileID = nextID
			break
		}
	}
	a.mu.Unlock()

	if session == nil {
		return nil
	}
	return session.Close()
}

func (a *App) DisconnectAll() error {
	a.mu.Lock()
	sessions := a.sessions
	a.sessions = make(map[string]*ConnectionSession)
	a.activeProfileID = ""
	a.mu.Unlock()

	var closeErr error
	for _, session := range sessions {
		if err := session.Close(); err != nil && closeErr == nil {
			closeErr = err
		}
	}
	return closeErr
}

func (a *App) Status() ConnectionStatus {
	a.mu.Lock()
	profileID := a.activeProfileID
	a.mu.Unlock()
	if profileID == "" {
		return ConnectionStatus{}
	}
	return a.StatusForProfile(profileID)
}

func (a *App) StatusForProfile(profileID string) ConnectionStatus {
	session, err := a.currentSession(profileID)
	if err != nil {
		return ConnectionStatus{}
	}
	return ConnectionStatus{
		Connected: true,
		Database:  session.config.Database,
		Server:    net.JoinHostPort(session.config.Host, session.config.Port),
		User:      session.config.User,
		ViaSSH:    session.config.SSH.Enabled,
	}
}

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

func (a *App) GetTableData(request TableDataRequest) (TableDataResult, error) {
	request.Database = strings.TrimSpace(request.Database)
	request.Table = strings.TrimSpace(request.Table)
	request.Where = strings.TrimSpace(request.Where)
	request.OrderBy = strings.TrimSpace(request.OrderBy)
	request.OrderDir = strings.ToUpper(strings.TrimSpace(request.OrderDir))
	if request.Database == "" || request.Table == "" {
		return TableDataResult{}, errors.New("database and table are required")
	}
	if strings.Contains(request.Where, ";") || strings.Contains(request.Where, "--") || strings.Contains(request.Where, "/*") {
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

func (a *App) Execute(profileID string, query string, database string) (QueryResult, error) {
	return a.ExecuteWithID("", profileID, query, database)
}

func (a *App) ExecuteWithID(queryID string, profileID string, query string, database string) (QueryResult, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return QueryResult{}, errors.New("query is empty")
	}
	db, err := a.currentDB(profileID)
	if err != nil {
		return QueryResult{}, err
	}

	ctx, cancel := context.WithTimeout(a.ctx, 2*time.Minute)
	defer cancel()
	if queryID != "" {
		a.registerQueryCancel(queryID, cancel)
		defer a.unregisterQueryCancel(queryID)
	}

	conn, err := db.Conn(ctx)
	if err != nil {
		return QueryResult{}, err
	}
	defer conn.Close()

	if database != "" {
		if _, err := conn.ExecContext(ctx, "USE "+quoteIdentifier(database)); err != nil {
			return QueryResult{}, err
		}
	}

	start := time.Now()
	if returnsRows(query) {
		result, err := runQuery(ctx, conn, query, 1000)
		result.ElapsedMs = time.Since(start).Milliseconds()
		return result, err
	}

	execResult, err := conn.ExecContext(ctx, query)
	elapsed := time.Since(start).Milliseconds()
	if err != nil {
		return QueryResult{}, err
	}
	affected, _ := execResult.RowsAffected()
	return QueryResult{
		RowsAffected: affected,
		ElapsedMs:    elapsed,
		Message:      "Query executed successfully",
	}, nil
}

func (a *App) CancelQuery(queryID string) bool {
	queryID = strings.TrimSpace(queryID)
	if queryID == "" {
		return false
	}
	a.mu.Lock()
	cancel := a.queryCancels[queryID]
	delete(a.queryCancels, queryID)
	a.mu.Unlock()
	if cancel == nil {
		return false
	}
	cancel()
	return true
}

func (a *App) registerQueryCancel(queryID string, cancel context.CancelFunc) {
	a.mu.Lock()
	if a.queryCancels == nil {
		a.queryCancels = make(map[string]context.CancelFunc)
	}
	a.queryCancels[queryID] = cancel
	a.mu.Unlock()
}

func (a *App) unregisterQueryCancel(queryID string) {
	a.mu.Lock()
	delete(a.queryCancels, queryID)
	a.mu.Unlock()
}

func (a *App) currentDB(profileID string) (*sql.DB, error) {
	session, err := a.currentSession(profileID)
	if err != nil {
		return nil, err
	}
	return session.db, nil
}

func (a *App) currentSession(profileID string) (*ConnectionSession, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	profileID = strings.TrimSpace(profileID)
	if profileID == "" {
		profileID = a.activeProfileID
	}
	session := a.sessions[profileID]
	if session == nil || session.db == nil {
		return nil, errors.New("not connected")
	}
	return session, nil
}

func (s *ConnectionSession) Close() error {
	var closeErr error
	if s.db != nil {
		closeErr = s.db.Close()
	}
	if s.tunnel != nil {
		if err := s.tunnel.Close(); err != nil && closeErr == nil {
			closeErr = err
		}
	}
	return closeErr
}

func normalizeConfig(config ConnectionConfig) ConnectionConfig {
	config.ID = strings.TrimSpace(config.ID)
	config.Host = strings.TrimSpace(config.Host)
	config.Port = strings.TrimSpace(config.Port)
	config.User = strings.TrimSpace(config.User)
	config.Database = strings.TrimSpace(config.Database)
	config.SSH.Host = strings.TrimSpace(config.SSH.Host)
	config.SSH.Port = strings.TrimSpace(config.SSH.Port)
	config.SSH.User = strings.TrimSpace(config.SSH.User)
	config.SSH.PrivateKeyPath = strings.TrimSpace(config.SSH.PrivateKeyPath)
	if config.Host == "" {
		config.Host = "127.0.0.1"
	}
	if config.Port == "" {
		config.Port = "3306"
	}
	if config.SSH.Enabled && config.SSH.Port == "" {
		config.SSH.Port = "22"
	}
	if config.Advanced.ConnectTimeoutSeconds <= 0 {
		config.Advanced.ConnectTimeoutSeconds = 8
	}
	if config.Advanced.MaxOpenConns <= 0 {
		config.Advanced.MaxOpenConns = 8
	}
	if config.Advanced.MaxIdleConns <= 0 {
		config.Advanced.MaxIdleConns = 2
	}
	if config.Advanced.MaxIdleConns > config.Advanced.MaxOpenConns {
		config.Advanced.MaxIdleConns = config.Advanced.MaxOpenConns
	}
	return config
}

func defaultProfileID(config ConnectionConfig) string {
	parts := []string{config.Name, config.User, config.Host, config.Port}
	return strings.Trim(strings.Join(parts, "@"), "@")
}

func hydrateRememberedCredentials(config *ConnectionConfig) error {
	if config.ID == "" {
		return nil
	}
	if config.RememberPassword && config.Password == "" {
		config.Password = readKeychainSecret(config.ID, "mysql-password")
	}
	if config.SSH.RememberPassword && config.SSH.Password == "" {
		config.SSH.Password = readKeychainSecret(config.ID, "ssh-password")
	}
	if config.SSH.RememberPassphrase && config.SSH.Passphrase == "" {
		config.SSH.Passphrase = readKeychainSecret(config.ID, "ssh-passphrase")
	}
	return nil
}

func buildDSN(config ConnectionConfig, addr string) string {
	mysqlConfig := mysql.NewConfig()
	mysqlConfig.User = config.User
	mysqlConfig.Passwd = config.Password
	mysqlConfig.Net = "tcp"
	mysqlConfig.Addr = addr
	mysqlConfig.DBName = config.Database
	mysqlConfig.ParseTime = true
	mysqlConfig.Timeout = time.Duration(config.Advanced.ConnectTimeoutSeconds) * time.Second
	mysqlConfig.ReadTimeout = 2 * time.Minute
	mysqlConfig.WriteTimeout = 2 * time.Minute
	mysqlConfig.AllowNativePasswords = true
	mysqlConfig.Params = map[string]string{
		"charset": "utf8mb4",
	}
	return mysqlConfig.FormatDSN()
}

func startSSHTunnel(config SSHConfig, remoteAddr string) (*SSHTunnel, string, error) {
	if config.Host == "" || config.User == "" {
		return nil, "", errors.New("ssh host and user are required")
	}

	authMethods, err := sshAuthMethods(config)
	if err != nil {
		return nil, "", err
	}
	if len(authMethods) == 0 {
		return nil, "", errors.New("ssh password or private key is required")
	}

	sshConfig := &ssh.ClientConfig{
		User:            config.User,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         12 * time.Second,
	}

	client, err := ssh.Dial("tcp", net.JoinHostPort(config.Host, config.Port), sshConfig)
	if err != nil {
		return nil, "", fmt.Errorf("ssh connect failed: %w", err)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		_ = client.Close()
		return nil, "", err
	}

	tunnel := &SSHTunnel{
		client:   client,
		listener: listener,
		remote:   remoteAddr,
		done:     make(chan struct{}),
	}
	go tunnel.accept()
	return tunnel, listener.Addr().String(), nil
}

func sshAuthMethods(config SSHConfig) ([]ssh.AuthMethod, error) {
	var methods []ssh.AuthMethod
	if config.Password != "" {
		methods = append(methods, ssh.Password(config.Password))
	}

	key := strings.TrimSpace(config.PrivateKey)
	if key == "" && config.PrivateKeyPath != "" {
		content, err := os.ReadFile(config.PrivateKeyPath)
		if err != nil {
			return nil, fmt.Errorf("read ssh private key: %w", err)
		}
		key = string(content)
	}
	if key != "" {
		var signer ssh.Signer
		var err error
		if config.Passphrase != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase([]byte(key), []byte(config.Passphrase))
		} else {
			signer, err = ssh.ParsePrivateKey([]byte(key))
		}
		if err != nil {
			return nil, fmt.Errorf("parse ssh private key: %w", err)
		}
		methods = append(methods, ssh.PublicKeys(signer))
	}

	return methods, nil
}

func (t *SSHTunnel) accept() {
	defer close(t.done)
	for {
		localConn, err := t.listener.Accept()
		if err != nil {
			return
		}
		go t.forward(localConn)
	}
}

func (t *SSHTunnel) forward(localConn net.Conn) {
	defer localConn.Close()

	remoteConn, err := t.client.Dial("tcp", t.remote)
	if err != nil {
		return
	}
	defer remoteConn.Close()

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		_, _ = io.Copy(remoteConn, localConn)
	}()
	go func() {
		defer wg.Done()
		_, _ = io.Copy(localConn, remoteConn)
	}()
	wg.Wait()
}

func (t *SSHTunnel) Close() error {
	var closeErr error
	if t.listener != nil {
		closeErr = t.listener.Close()
	}
	if t.client != nil {
		if err := t.client.Close(); err != nil && closeErr == nil {
			closeErr = err
		}
	}
	select {
	case <-t.done:
	case <-time.After(500 * time.Millisecond):
	}
	return closeErr
}

func returnsRows(query string) bool {
	first := strings.ToLower(strings.Fields(query)[0])
	switch first {
	case "select", "show", "describe", "desc", "explain", "with", "call":
		return true
	default:
		return false
	}
}

func runQuery(ctx context.Context, conn *sql.Conn, query string, limit int) (QueryResult, error) {
	rows, err := conn.QueryContext(ctx, query)
	if err != nil {
		return QueryResult{}, err
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return QueryResult{}, err
	}

	result := QueryResult{Columns: columns}
	for rows.Next() {
		values := make([]sql.RawBytes, len(columns))
		scanArgs := make([]any, len(columns))
		for i := range values {
			scanArgs[i] = &values[i]
		}
		if err := rows.Scan(scanArgs...); err != nil {
			return QueryResult{}, err
		}

		row := make([]any, len(columns))
		for i, value := range values {
			if value == nil {
				row[i] = nil
				continue
			}
			row[i] = string(value)
		}
		result.Rows = append(result.Rows, row)
		if len(result.Rows) >= limit {
			result.Truncated = true
			break
		}
	}
	if err := rows.Err(); err != nil {
		return QueryResult{}, err
	}

	result.RowsAffected = int64(len(result.Rows))
	if result.Truncated {
		result.Message = "Showing first 1000 rows"
	} else {
		result.Message = "Query returned rows"
	}
	return result, nil
}

func scanRowsAsMaps(rows *sql.Rows) ([]map[string]any, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var result []map[string]any
	for rows.Next() {
		values := make([]sql.RawBytes, len(columns))
		scanArgs := make([]any, len(columns))
		for i := range values {
			scanArgs[i] = &values[i]
		}
		if err := rows.Scan(scanArgs...); err != nil {
			return nil, err
		}

		row := make(map[string]any, len(columns))
		for i, value := range values {
			if value == nil {
				row[columns[i]] = nil
			} else {
				row[columns[i]] = string(value)
			}
		}
		result = append(result, row)
	}
	return result, rows.Err()
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

func quoteIdentifier(value string) string {
	return "`" + strings.ReplaceAll(value, "`", "``") + "`"
}

func keychainAccount(profileID string, key string) string {
	return profileID + ":" + key
}

func readKeychainSecret(profileID string, key string) string {
	out, err := exec.Command("security", "find-generic-password", "-s", "mysql-gui", "-a", keychainAccount(profileID, key), "-w").Output()
	if err != nil {
		return ""
	}
	return strings.TrimRight(string(out), "\r\n")
}

func writeKeychainSecret(profileID string, key string, value string) error {
	if value == "" {
		return nil
	}
	cmd := exec.Command("security", "add-generic-password", "-s", "mysql-gui", "-a", keychainAccount(profileID, key), "-w", value, "-U")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("save credential to keychain: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func deleteKeychainSecret(profileID string, key string) {
	_ = exec.Command("security", "delete-generic-password", "-s", "mysql-gui", "-a", keychainAccount(profileID, key)).Run()
}
