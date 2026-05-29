package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
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
	hostKey   string
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
	TLS              TLSConfig      `json:"tls"`
	Advanced         AdvancedConfig `json:"advanced"`
}

// TLSConfig controls how the MySQL connection is encrypted.
//
// Mode values:
//   - "" / "disabled":  no TLS
//   - "preferred":      use TLS if the server supports it, no verification
//   - "required":       require TLS, no certificate verification (skip-verify)
//   - "verify-ca":      require TLS and verify the certificate chain (not host name)
//   - "verify-identity": require TLS and verify chain and server name
type TLSConfig struct {
	Mode           string `json:"mode"`
	ServerName     string `json:"serverName"`
	CACertPath     string `json:"caCertPath"`
	ClientCertPath string `json:"clientCertPath"`
	ClientKeyPath  string `json:"clientKeyPath"`
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
	KnownHostKey       string `json:"knownHostKey"`
}

type ConnectionStatus struct {
	Connected bool   `json:"connected"`
	Database  string `json:"database"`
	Server    string `json:"server"`
	User      string `json:"user"`
	ViaSSH    bool   `json:"viaSsh"`
	TLS       string `json:"tls"`
	HostKey   string `json:"hostKey"`
}

// HostKeyPrompt describes the SSH host key the frontend should ask the user to
// confirm before connecting. Required is false when the key is already trusted.
type HostKeyPrompt struct {
	Required    bool   `json:"required"`
	Changed     bool   `json:"changed"`
	Host        string `json:"host"`
	Fingerprint string `json:"fingerprint"`
	Key         string `json:"key"`
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
		// Read one extra row beyond the limit so truncation only triggers
		// when there genuinely are more rows than requested.
		if len(result.Rows) >= limit {
			result.Truncated = true
			break
		}
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
	}
	if err := rows.Err(); err != nil {
		return QueryResult{}, err
	}

	result.RowsAffected = int64(len(result.Rows))
	if result.Truncated {
		result.Message = fmt.Sprintf("Showing first %d rows", limit)
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

func quoteIdentifier(value string) string {
	return "`" + strings.ReplaceAll(value, "`", "``") + "`"
}
