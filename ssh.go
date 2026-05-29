package main

import (
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
)

type SSHTunnel struct {
	client   *ssh.Client
	listener net.Listener
	remote   string
	done     chan struct{}
}

var errHostKeyInspected = errors.New("host key inspected")

// InspectSSHHostKey performs an SSH handshake just far enough to read the
// server host key, then aborts before authentication (so no valid credentials
// are required). It reports whether the user must confirm the key before
// connecting. When SSH is disabled it returns an empty, non-required prompt.
func (a *App) InspectSSHHostKey(config ConnectionConfig) (HostKeyPrompt, error) {
	config = normalizeConfig(config)
	if !config.SSH.Enabled || config.SSH.Host == "" {
		return HostKeyPrompt{}, nil
	}

	var captured ssh.PublicKey
	var capturedRemote net.Addr
	sshConfig := &ssh.ClientConfig{
		User: config.SSH.User,
		HostKeyCallback: func(hostname string, remote net.Addr, key ssh.PublicKey) error {
			captured = key
			capturedRemote = remote
			return errHostKeyInspected
		},
		Timeout: 12 * time.Second,
	}

	client, err := ssh.Dial("tcp", net.JoinHostPort(config.SSH.Host, config.SSH.Port), sshConfig)
	if client != nil {
		_ = client.Close()
	}
	if captured == nil {
		if err == nil {
			return HostKeyPrompt{}, errors.New("ssh server did not present a host key")
		}
		return HostKeyPrompt{}, classifyConnectionError(err)
	}

	knownGood, changed := evaluateHostKey(config.SSH, net.JoinHostPort(config.SSH.Host, config.SSH.Port), capturedRemote, captured)
	return HostKeyPrompt{
		Required:    !knownGood,
		Changed:     changed,
		Host:        net.JoinHostPort(config.SSH.Host, config.SSH.Port),
		Fingerprint: ssh.FingerprintSHA256(captured),
		Key:         hostKeyString(captured),
	}, nil
}

func startSSHTunnel(config SSHConfig, remoteAddr string) (*SSHTunnel, string, string, error) {
	if config.Host == "" || config.User == "" {
		return nil, "", "", errors.New("ssh host and user are required")
	}

	authMethods, err := sshAuthMethods(config)
	if err != nil {
		return nil, "", "", err
	}
	if len(authMethods) == 0 {
		return nil, "", "", errors.New("ssh password or private key is required")
	}

	var observedHostKey string
	sshConfig := &ssh.ClientConfig{
		User:            config.User,
		Auth:            authMethods,
		HostKeyCallback: buildHostKeyCallback(config, &observedHostKey),
		Timeout:         12 * time.Second,
	}

	client, err := ssh.Dial("tcp", net.JoinHostPort(config.Host, config.Port), sshConfig)
	if err != nil {
		return nil, "", "", fmt.Errorf("ssh connect failed: %w", err)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		_ = client.Close()
		return nil, "", "", err
	}

	tunnel := &SSHTunnel{
		client:   client,
		listener: listener,
		remote:   remoteAddr,
		done:     make(chan struct{}),
	}
	go tunnel.accept()
	return tunnel, listener.Addr().String(), observedHostKey, nil
}

// buildHostKeyCallback verifies the SSH server host key. It first consults the
// user's ~/.ssh/known_hosts (a changed key there is a hard failure), then falls
// back to a per-profile pinned key using trust-on-first-use: an empty pin is
// accepted and recorded, a matching pin passes, and a mismatching pin fails.
func buildHostKeyCallback(config SSHConfig, observed *string) ssh.HostKeyCallback {
	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		if observed != nil {
			*observed = hostKeyString(key)
		}
		knownGood, changed := evaluateHostKey(config, hostname, remote, key)
		if changed {
			return fmt.Errorf("ssh host key mismatch for %s: the key changed since it was trusted (possible man-in-the-middle); fingerprint %s", hostname, ssh.FingerprintSHA256(key))
		}
		// knownGood or unknown first-use are both accepted here; the frontend
		// drives the interactive confirmation for unknown keys before connecting.
		_ = knownGood
		return nil
	}
}

// evaluateHostKey classifies a presented host key. knownGood is true when the
// key is already trusted (system known_hosts or the per-profile pin); changed
// is true when a previously trusted key no longer matches.
func evaluateHostKey(config SSHConfig, hostname string, remote net.Addr, key ssh.PublicKey) (knownGood bool, changed bool) {
	if systemCallback, err := systemKnownHostsCallback(); err == nil && systemCallback != nil {
		switch verifyErr := systemCallback(hostname, remote, key); {
		case verifyErr == nil:
			return true, false
		default:
			var keyErr *knownhosts.KeyError
			if errors.As(verifyErr, &keyErr) && len(keyErr.Want) > 0 {
				return false, true
			}
			// Host absent from known_hosts (or unreadable): fall back to the pin.
		}
	}

	pinned := strings.TrimSpace(config.KnownHostKey)
	if pinned == "" {
		return false, false
	}
	if hostKeysEqual(pinned, key) {
		return true, false
	}
	return false, true
}

func systemKnownHostsCallback() (ssh.HostKeyCallback, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(home, ".ssh", "known_hosts")
	if _, err := os.Stat(path); err != nil {
		return nil, nil
	}
	return knownhosts.New(path)
}

func hostKeyString(key ssh.PublicKey) string {
	return strings.TrimSpace(string(ssh.MarshalAuthorizedKey(key)))
}

func hostKeysEqual(pinned string, key ssh.PublicKey) bool {
	return strings.TrimSpace(pinned) == hostKeyString(key)
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
