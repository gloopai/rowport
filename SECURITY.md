# Security Policy

RowPort is a desktop database client and may handle database credentials, SSH credentials, private key passphrases, SQL text, table data, and exported files. Please report security issues privately before opening a public issue.

## Reporting a Vulnerability

Email the maintainers or use GitHub's private vulnerability reporting if it is enabled for the repository.

Please include:

- A clear description of the issue.
- Steps to reproduce.
- Impact and affected platforms.
- Whether credentials, local files, or database contents can be exposed.
- Any relevant logs with secrets removed.

## Credential Handling

- Remembered MySQL passwords, SSH passwords, and SSH key passphrases are stored in macOS Keychain.
- Pasted SSH private key text is treated as one-time input and is not persisted.
- Non-secret profile fields may be stored in browser local storage.
- Secrets should not be written to logs, issue reports, screenshots, fixtures, or the repository.

## Supported Versions

RowPort has not published a stable release yet. Until the first public release, security fixes target the default branch.
