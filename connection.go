package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"database/sql"
	"errors"
	"fmt"
	"net"
	"os"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

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
		TLS:       tlsModeLabel(session.config.TLS.Mode),
		HostKey:   session.hostKey,
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
	var hostKey string
	if config.SSH.Enabled {
		nextTunnel, localAddr, observedHostKey, err := startSSHTunnel(config.SSH, mysqlAddr)
		if err != nil {
			return nil, classifyConnectionError(err)
		}
		tunnel = nextTunnel
		mysqlAddr = localAddr
		hostKey = observedHostKey
	}

	dsn, err := buildDSN(config, mysqlAddr)
	if err != nil {
		if tunnel != nil {
			_ = tunnel.Close()
		}
		return nil, err
	}

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		if tunnel != nil {
			_ = tunnel.Close()
		}
		return nil, classifyConnectionError(err)
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
		return nil, classifyConnectionError(err)
	}

	return &ConnectionSession{db: db, tunnel: tunnel, config: config, mysqlAddr: mysqlAddr, hostKey: hostKey}, nil
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
		TLS:       tlsModeLabel(session.config.TLS.Mode),
		HostKey:   session.hostKey,
	}
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
	config.SSH.KnownHostKey = strings.TrimSpace(config.SSH.KnownHostKey)
	config.TLS.Mode = strings.ToLower(strings.TrimSpace(config.TLS.Mode))
	config.TLS.ServerName = strings.TrimSpace(config.TLS.ServerName)
	config.TLS.CACertPath = strings.TrimSpace(config.TLS.CACertPath)
	config.TLS.ClientCertPath = strings.TrimSpace(config.TLS.ClientCertPath)
	config.TLS.ClientKeyPath = strings.TrimSpace(config.TLS.ClientKeyPath)
	if config.TLS.Mode == "" {
		config.TLS.Mode = "disabled"
	}
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

func buildDSN(config ConnectionConfig, addr string) (string, error) {
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

	tlsParam, err := resolveTLSParam(config)
	if err != nil {
		return "", err
	}
	if tlsParam != "" {
		mysqlConfig.TLSConfig = tlsParam
	}
	return mysqlConfig.FormatDSN(), nil
}

// resolveTLSParam maps the profile TLS mode to a go-sql-driver `tls=` value.
// Built-in modes use the driver's reserved names; verify-ca and
// verify-identity register a custom *tls.Config and return its name.
func resolveTLSParam(config ConnectionConfig) (string, error) {
	mode := strings.ToLower(strings.TrimSpace(config.TLS.Mode))
	switch mode {
	case "", "disabled":
		return "", nil
	case "preferred":
		return "preferred", nil
	case "required":
		return "skip-verify", nil
	case "verify-ca", "verify-identity":
		tlsConf, err := buildTLSClientConfig(config, mode)
		if err != nil {
			return "", err
		}
		name := "rowport-tls-" + tlsConfigName(config)
		if err := mysql.RegisterTLSConfig(name, tlsConf); err != nil {
			return "", fmt.Errorf("register tls config: %w", err)
		}
		return name, nil
	default:
		return "", fmt.Errorf("unknown tls mode %q", config.TLS.Mode)
	}
}

func buildTLSClientConfig(config ConnectionConfig, mode string) (*tls.Config, error) {
	tlsConf := &tls.Config{
		MinVersion: tls.VersionTLS12,
		ServerName: config.TLS.ServerName,
	}
	if tlsConf.ServerName == "" {
		tlsConf.ServerName = config.Host
	}

	if config.TLS.CACertPath != "" {
		pem, err := os.ReadFile(config.TLS.CACertPath)
		if err != nil {
			return nil, fmt.Errorf("read CA certificate: %w", err)
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(pem) {
			return nil, errors.New("failed to parse CA certificate")
		}
		tlsConf.RootCAs = pool
	}

	if config.TLS.ClientCertPath != "" || config.TLS.ClientKeyPath != "" {
		cert, err := tls.LoadX509KeyPair(config.TLS.ClientCertPath, config.TLS.ClientKeyPath)
		if err != nil {
			return nil, fmt.Errorf("load client certificate: %w", err)
		}
		tlsConf.Certificates = []tls.Certificate{cert}
	}

	if mode == "verify-ca" {
		// Verify the certificate chain but not the server host name.
		rootCAs := tlsConf.RootCAs
		tlsConf.InsecureSkipVerify = true
		tlsConf.VerifyConnection = func(state tls.ConnectionState) error {
			if len(state.PeerCertificates) == 0 {
				return errors.New("server presented no certificate")
			}
			opts := x509.VerifyOptions{Roots: rootCAs, Intermediates: x509.NewCertPool()}
			for _, cert := range state.PeerCertificates[1:] {
				opts.Intermediates.AddCert(cert)
			}
			_, err := state.PeerCertificates[0].Verify(opts)
			return err
		}
	}

	return tlsConf, nil
}

func tlsConfigName(config ConnectionConfig) string {
	id := config.ID
	if id == "" {
		id = defaultProfileID(config)
	}
	if id == "" {
		id = config.Host
	}
	return strings.NewReplacer(" ", "_", ":", "_", "@", "_").Replace(id)
}

func tlsModeLabel(mode string) string {
	mode = strings.ToLower(strings.TrimSpace(mode))
	if mode == "" {
		return "disabled"
	}
	return mode
}

// classifyConnectionError turns low-level connection failures into messages
// that are actionable for the user while preserving the original error.
func classifyConnectionError(err error) error {
	if err == nil {
		return nil
	}

	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) {
		switch mysqlErr.Number {
		case 1045:
			return fmt.Errorf("authentication failed: check the user name and password (%w)", err)
		case 1049:
			return fmt.Errorf("unknown database: the default database does not exist (%w)", err)
		case 1044, 1142:
			return fmt.Errorf("permission denied: this MySQL user lacks access (%w)", err)
		}
	}

	msg := strings.ToLower(err.Error())
	switch {
	case errors.Is(err, context.DeadlineExceeded) || strings.Contains(msg, "i/o timeout") || strings.Contains(msg, "timeout"):
		return fmt.Errorf("connection timed out: the server is unreachable or blocked by a firewall (%w)", err)
	case strings.Contains(msg, "connection refused"):
		return fmt.Errorf("connection refused: nothing is listening on that host and port (%w)", err)
	case strings.Contains(msg, "no such host") || strings.Contains(msg, "lookup"):
		return fmt.Errorf("host not found: check the host name (%w)", err)
	case strings.Contains(msg, "x509") || strings.Contains(msg, "certificate") || strings.Contains(msg, "tls"):
		return fmt.Errorf("TLS error: %w", err)
	case strings.Contains(msg, "ssh"):
		return fmt.Errorf("SSH tunnel error: %w", err)
	}
	return err
}
