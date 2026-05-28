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

### Known Gaps

- Prebuilt releases are not published yet.
- SSH host key verification is not implemented yet.
- MySQL SSL/TLS options are not implemented yet.
- Credential persistence is currently macOS-focused.
