package main

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"net"
	"sort"
	"strings"
	"testing"

	"github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/ssh"
)

func generateTestPrivateKeyPEM(t *testing.T) (string, error) {
	t.Helper()
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", err
	}
	der, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		return "", err
	}
	block := &pem.Block{Type: "PRIVATE KEY", Bytes: der}
	return string(pem.EncodeToMemory(block)), nil
}

func newTestSigner(t *testing.T) ssh.Signer {
	t.Helper()
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate ed25519 key: %v", err)
	}
	signer, err := ssh.NewSignerFromKey(priv)
	if err != nil {
		t.Fatalf("new signer: %v", err)
	}
	return signer
}

func TestQuoteIdentifier(t *testing.T) {
	cases := map[string]string{
		"users":      "`users`",
		"my table":   "`my table`",
		"we`ird":     "`we``ird`",
		"a`b`c":      "`a``b``c`",
		"":           "``",
		"`":          "````",
		"db.tbl":     "`db.tbl`",
		"DROP TABLE": "`DROP TABLE`",
	}
	for input, want := range cases {
		if got := quoteIdentifier(input); got != want {
			t.Errorf("quoteIdentifier(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestHasUnsupportedWhereTokens(t *testing.T) {
	blocked := []string{
		"id = 1; DROP TABLE users",
		"name = 'a' -- comment",
		"id = 1 /* hidden */",
		"id = 1 */",
		"id = 1 # trailing comment",
		"id = 1\x00",
	}
	for _, where := range blocked {
		if !hasUnsupportedWhereTokens(where) {
			t.Errorf("hasUnsupportedWhereTokens(%q) = false, want true", where)
		}
	}

	allowed := []string{
		"id = 1",
		"name = 'alice' AND age > 30",
		"status IN ('a', 'b')",
		"price BETWEEN 10 AND 20",
		"",
	}
	for _, where := range allowed {
		if hasUnsupportedWhereTokens(where) {
			t.Errorf("hasUnsupportedWhereTokens(%q) = true, want false", where)
		}
	}
}

func TestReturnsRows(t *testing.T) {
	rowReturning := []string{
		"SELECT * FROM t",
		"  select 1",
		"SHOW DATABASES",
		"describe users",
		"DESC users",
		"EXPLAIN SELECT 1",
		"WITH cte AS (SELECT 1) SELECT * FROM cte",
		"CALL my_proc()",
	}
	for _, query := range rowReturning {
		if !returnsRows(query) {
			t.Errorf("returnsRows(%q) = false, want true", query)
		}
	}

	noRows := []string{
		"INSERT INTO t VALUES (1)",
		"UPDATE t SET a = 1",
		"DELETE FROM t",
		"CREATE TABLE t (id INT)",
		"DROP TABLE t",
	}
	for _, query := range noRows {
		if returnsRows(query) {
			t.Errorf("returnsRows(%q) = true, want false", query)
		}
	}
}

func TestNormalizeConfigDefaults(t *testing.T) {
	got := normalizeConfig(ConnectionConfig{
		Host: "  example.com  ",
		User: " root ",
	})
	if got.Host != "example.com" {
		t.Errorf("Host = %q, want trimmed example.com", got.Host)
	}
	if got.User != "root" {
		t.Errorf("User = %q, want trimmed root", got.User)
	}
	if got.Port != "3306" {
		t.Errorf("Port = %q, want default 3306", got.Port)
	}
	if got.Advanced.ConnectTimeoutSeconds != 8 {
		t.Errorf("ConnectTimeoutSeconds = %d, want 8", got.Advanced.ConnectTimeoutSeconds)
	}
	if got.Advanced.MaxOpenConns != 8 {
		t.Errorf("MaxOpenConns = %d, want 8", got.Advanced.MaxOpenConns)
	}
	if got.Advanced.MaxIdleConns != 2 {
		t.Errorf("MaxIdleConns = %d, want 2", got.Advanced.MaxIdleConns)
	}
}

func TestNormalizeConfigDefaultsLocalHost(t *testing.T) {
	got := normalizeConfig(ConnectionConfig{})
	if got.Host != "127.0.0.1" {
		t.Errorf("Host = %q, want default 127.0.0.1", got.Host)
	}
}

func TestNormalizeConfigClampsIdleConns(t *testing.T) {
	got := normalizeConfig(ConnectionConfig{
		Advanced: AdvancedConfig{MaxOpenConns: 4, MaxIdleConns: 20},
	})
	if got.Advanced.MaxIdleConns != got.Advanced.MaxOpenConns {
		t.Errorf("MaxIdleConns = %d, want clamped to MaxOpenConns %d", got.Advanced.MaxIdleConns, got.Advanced.MaxOpenConns)
	}
}

func TestNormalizeConfigSSHDefaultPort(t *testing.T) {
	got := normalizeConfig(ConnectionConfig{
		SSH: SSHConfig{Enabled: true, Host: "bastion", User: "deploy"},
	})
	if got.SSH.Port != "22" {
		t.Errorf("SSH.Port = %q, want default 22", got.SSH.Port)
	}
}

func TestDefaultProfileID(t *testing.T) {
	got := defaultProfileID(ConnectionConfig{
		Name: "prod",
		User: "root",
		Host: "db",
		Port: "3306",
	})
	if got != "prod@root@db@3306" {
		t.Errorf("defaultProfileID = %q", got)
	}

	got = defaultProfileID(ConnectionConfig{User: "root", Host: "db", Port: "3306"})
	if got != "root@db@3306" {
		t.Errorf("defaultProfileID with empty name = %q, want no leading @", got)
	}
}

func TestPrimaryKeysFromColumns(t *testing.T) {
	columns := []ColumnInfo{
		{Name: "id", Key: "PRI"},
		{Name: "tenant_id", Key: "PRI"},
		{Name: "name", Key: ""},
		{Name: "email", Key: "UNI"},
	}
	got := primaryKeysFromColumns(columns)
	want := []string{"id", "tenant_id"}
	if len(got) != len(want) {
		t.Fatalf("primaryKeysFromColumns = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("primaryKeysFromColumns[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestWhereClauseFromKeys(t *testing.T) {
	parts, args := whereClauseFromKeys(map[string]any{
		"id":      5,
		"deleted": nil,
	})
	sort.Strings(parts)
	joined := strings.Join(parts, " AND ")
	if !strings.Contains(joined, "`deleted` IS NULL") {
		t.Errorf("expected IS NULL clause for nil value, got %q", joined)
	}
	if !strings.Contains(joined, "`id` = ?") {
		t.Errorf("expected placeholder clause for id, got %q", joined)
	}
	if len(args) != 1 {
		t.Errorf("args = %v, want exactly one (nil value should not produce an arg)", args)
	}
}

func TestKeychainAccount(t *testing.T) {
	if got := keychainAccount("prod@root@db", "mysql-password"); got != "prod@root@db:mysql-password" {
		t.Errorf("keychainAccount = %q", got)
	}
}

func TestBuildDSN(t *testing.T) {
	config := normalizeConfig(ConnectionConfig{
		User:     "root",
		Password: "secret",
		Host:     "db.internal",
		Port:     "3306",
		Database: "shop",
	})
	dsn, err := buildDSN(config, "127.0.0.1:55000")
	if err != nil {
		t.Fatalf("buildDSN returned error: %v", err)
	}

	for _, want := range []string{
		"root:secret@",
		"tcp(127.0.0.1:55000)",
		"/shop",
		"parseTime=true",
		"charset=utf8mb4",
	} {
		if !strings.Contains(dsn, want) {
			t.Errorf("DSN %q missing %q", dsn, want)
		}
	}
	if strings.Contains(dsn, "tls=") {
		t.Errorf("DSN %q should not set tls= when TLS is disabled", dsn)
	}
}

func TestBuildDSNTLS(t *testing.T) {
	cases := []struct {
		mode     string
		contains string
	}{
		{"disabled", ""},
		{"preferred", "tls=preferred"},
		{"required", "tls=skip-verify"},
		{"verify-identity", "tls=rowport-tls-"},
	}
	for _, tc := range cases {
		config := normalizeConfig(ConnectionConfig{
			ID:   "prod-db",
			User: "root",
			Host: "db.internal",
			Port: "3306",
			TLS:  TLSConfig{Mode: tc.mode, ServerName: "db.internal"},
		})
		dsn, err := buildDSN(config, "127.0.0.1:3306")
		if err != nil {
			t.Fatalf("buildDSN(%s) error: %v", tc.mode, err)
		}
		if tc.contains == "" {
			if strings.Contains(dsn, "tls=") {
				t.Errorf("mode %q: DSN %q should not contain tls=", tc.mode, dsn)
			}
			continue
		}
		if !strings.Contains(dsn, tc.contains) {
			t.Errorf("mode %q: DSN %q missing %q", tc.mode, dsn, tc.contains)
		}
	}
}

func TestResolveTLSParamUnknownMode(t *testing.T) {
	_, err := resolveTLSParam(ConnectionConfig{TLS: TLSConfig{Mode: "bogus"}})
	if err == nil {
		t.Error("resolveTLSParam should reject an unknown mode")
	}
}

func TestTLSModeLabel(t *testing.T) {
	if got := tlsModeLabel(""); got != "disabled" {
		t.Errorf("tlsModeLabel(\"\") = %q, want disabled", got)
	}
	if got := tlsModeLabel(" Required "); got != "required" {
		t.Errorf("tlsModeLabel = %q, want required", got)
	}
}

func TestClassifyConnectionError(t *testing.T) {
	cases := []struct {
		name     string
		err      error
		contains string
	}{
		{"auth", &mysql.MySQLError{Number: 1045, Message: "Access denied"}, "authentication failed"},
		{"unknown-db", &mysql.MySQLError{Number: 1049, Message: "Unknown database"}, "unknown database"},
		{"permission", &mysql.MySQLError{Number: 1044, Message: "Access denied for db"}, "permission denied"},
		{"timeout", context.DeadlineExceeded, "timed out"},
		{"refused", errors.New("dial tcp 127.0.0.1:3306: connection refused"), "connection refused"},
		{"no-host", errors.New("dial tcp: lookup nope.invalid: no such host"), "host not found"},
		{"tls", errors.New("x509: certificate signed by unknown authority"), "TLS error"},
		{"ssh", errors.New("ssh connect failed: handshake"), "SSH tunnel error"},
	}
	for _, tc := range cases {
		got := classifyConnectionError(tc.err)
		if got == nil || !strings.Contains(got.Error(), tc.contains) {
			t.Errorf("%s: classifyConnectionError = %v, want message containing %q", tc.name, got, tc.contains)
		}
		if !errors.Is(got, tc.err) {
			t.Errorf("%s: classified error should wrap the original", tc.name)
		}
	}
	if classifyConnectionError(nil) != nil {
		t.Error("classifyConnectionError(nil) should be nil")
	}
}

func TestSSHAuthMethods(t *testing.T) {
	passwordOnly, err := sshAuthMethods(SSHConfig{Password: "pw"})
	if err != nil {
		t.Fatalf("password auth error: %v", err)
	}
	if len(passwordOnly) != 1 {
		t.Errorf("password only: got %d methods, want 1", len(passwordOnly))
	}

	none, err := sshAuthMethods(SSHConfig{})
	if err != nil {
		t.Fatalf("empty auth error: %v", err)
	}
	if len(none) != 0 {
		t.Errorf("no credentials: got %d methods, want 0", len(none))
	}

	key, err := generateTestPrivateKeyPEM(t)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	keyMethods, err := sshAuthMethods(SSHConfig{PrivateKey: key})
	if err != nil {
		t.Fatalf("private key auth error: %v", err)
	}
	if len(keyMethods) != 1 {
		t.Errorf("private key: got %d methods, want 1", len(keyMethods))
	}

	if _, err := sshAuthMethods(SSHConfig{PrivateKey: "not a key"}); err == nil {
		t.Error("invalid private key should error")
	}
}

func TestHostKeyCallback(t *testing.T) {
	signer := newTestSigner(t)
	key := signer.PublicKey()
	addr := &net.TCPAddr{IP: net.IPv4(127, 0, 0, 1), Port: 22}

	var observedFirst string
	firstUse := buildHostKeyCallback(SSHConfig{}, &observedFirst)
	if err := firstUse("example.com:22", addr, key); err != nil {
		t.Fatalf("first use should be accepted (TOFU): %v", err)
	}
	if observedFirst == "" {
		t.Error("first use should record the observed host key")
	}

	matching := buildHostKeyCallback(SSHConfig{KnownHostKey: observedFirst}, nil)
	if err := matching("example.com:22", addr, key); err != nil {
		t.Errorf("matching pinned key should pass: %v", err)
	}

	other := newTestSigner(t)
	mismatch := buildHostKeyCallback(SSHConfig{KnownHostKey: hostKeyString(other.PublicKey())}, nil)
	if err := mismatch("example.com:22", addr, key); err == nil {
		t.Error("mismatching pinned key should be rejected")
	}
}

func TestEvaluateHostKey(t *testing.T) {
	signer := newTestSigner(t)
	key := signer.PublicKey()
	addr := &net.TCPAddr{IP: net.IPv4(127, 0, 0, 1), Port: 22}

	// No pin: unknown first use requires confirmation but is not a change.
	if good, changed := evaluateHostKey(SSHConfig{}, "example.com:22", addr, key); good || changed {
		t.Errorf("unknown key should be (false,false), got (%v,%v)", good, changed)
	}

	// Matching pin: trusted, no confirmation needed.
	if good, changed := evaluateHostKey(SSHConfig{KnownHostKey: hostKeyString(key)}, "example.com:22", addr, key); !good || changed {
		t.Errorf("matching pin should be (true,false), got (%v,%v)", good, changed)
	}

	// Mismatching pin: not trusted and flagged as changed.
	other := newTestSigner(t)
	if good, changed := evaluateHostKey(SSHConfig{KnownHostKey: hostKeyString(other.PublicKey())}, "example.com:22", addr, key); good || !changed {
		t.Errorf("mismatching pin should be (false,true), got (%v,%v)", good, changed)
	}
}
