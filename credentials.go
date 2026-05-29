package main

import (
	"errors"
	"fmt"
	"os/exec"
	"strings"
)

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

const keychainService = "rowport"

// legacyKeychainService is the service name used before the project was
// renamed. Reads fall back to it so secrets saved by older builds remain
// accessible until they are re-saved under the current service name.
const legacyKeychainService = "mysql-gui"

func keychainAccount(profileID string, key string) string {
	return profileID + ":" + key
}

func readKeychainSecret(profileID string, key string) string {
	if value, ok := readKeychainSecretForService(keychainService, profileID, key); ok {
		return value
	}
	value, _ := readKeychainSecretForService(legacyKeychainService, profileID, key)
	return value
}

func readKeychainSecretForService(service string, profileID string, key string) (string, bool) {
	out, err := exec.Command("security", "find-generic-password", "-s", service, "-a", keychainAccount(profileID, key), "-w").Output()
	if err != nil {
		return "", false
	}
	return strings.TrimRight(string(out), "\r\n"), true
}

func writeKeychainSecret(profileID string, key string, value string) error {
	if value == "" {
		return nil
	}
	cmd := exec.Command("security", "add-generic-password", "-s", keychainService, "-a", keychainAccount(profileID, key), "-w", value, "-U")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("save credential to keychain: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func deleteKeychainSecret(profileID string, key string) {
	_ = exec.Command("security", "delete-generic-password", "-s", keychainService, "-a", keychainAccount(profileID, key)).Run()
	_ = exec.Command("security", "delete-generic-password", "-s", legacyKeychainService, "-a", keychainAccount(profileID, key)).Run()
}
