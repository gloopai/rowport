# Changelog

All notable changes to RowPort will be documented in this file.

The format loosely follows Keep a Changelog, and this project is preparing for its first public pre-release.

## Unreleased

### Added

- Multiple saved MySQL server profiles.
- Optional SSH tunneling with password, private key text, or private key path authentication.
- macOS Keychain storage for remembered database and SSH secrets.
- Database, table, column, index, primary key, and DDL browsing.
- Paginated table data browsing with filtering, ordering, row copy, CSV import, and CSV/JSON export.
- Insert, update, and delete workflows for tables with primary keys.
- SQL console with result tabs, query cancellation, query history, file open, templates, and visible executed SQL logs.
- Resizable desktop layout with schema explorer, editor/results area, and operation logs.
- GitHub issue templates, pull request template, and CI for frontend build plus Go tests.
- SSH host key verification using `~/.ssh/known_hosts` plus per-profile trust-on-first-use pinning; a changed key blocks the connection.
- MySQL SSL/TLS connection modes (preferred, required, verify-ca, verify-identity) with CA, client certificate, and server name options, surfaced in the connection status.
- Friendly connection error classification (timeout, refused, host not found, authentication, permission, TLS, SSH).
- Go unit tests covering config normalization, DSN/TLS building, identifier quoting, where filtering, error classification, and SSH auth/host key handling.

### Changed

- Renamed persisted identifiers from `mysql-gui` to `rowport` (Keychain service and local storage keys) with automatic migration of existing data.

### Fixed

- Result truncation no longer reports "showing first N rows" when the result has exactly N rows.

### Known Gaps

- Prebuilt releases are not published yet.
- SSH host key verification has no interactive first-time fingerprint confirmation dialog yet (trust-on-first-use is automatic).
- Credential persistence is currently macOS-focused.
