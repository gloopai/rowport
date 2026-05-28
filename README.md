<p align="center">
  <img src="docs/assets/rowport-logo.svg" alt="RowPort" width="520">
</p>

# RowPort

[中文说明](README.zh-CN.md)

[Project plan and product TODO](docs/PROJECT_PLAN.zh-CN.md)

RowPort is a fast, restrained desktop MySQL client built with Wails, Go, and Vue. It focuses on the everyday database workflow: connecting to servers, browsing schemas, editing table rows, and running SQL without leaving a compact native app.

The project is early but usable. It is being prepared as an open source GitHub project, so the current goal is a clean local developer experience, clear security boundaries, and a small core feature set that can grow without becoming a heavy database IDE.

## Features

- Connect to MySQL with host, port, user, password, and an optional default database.
- Save and switch between multiple server profiles.
- Connect through an SSH tunnel with password auth, private key text, or a private key path.
- Store remembered MySQL passwords, SSH passwords, and SSH key passphrases in macOS Keychain.
- Browse databases, tables, columns, indexes, primary keys, and table DDL.
- Open tables with pagination, filtering, ordering, CSV/JSON export, and visible-row copy.
- Insert, edit, and delete rows for tables with primary keys.
- Run SQL against the selected database and inspect result sets in a scrollable grid.
- Open `.sql` files and generate common SELECT, INSERT, UPDATE, DELETE, and DDL templates.

## Tech Stack

- Wails v2 for the desktop shell and Go-to-frontend bindings.
- Go for MySQL connections, SSH tunneling, Keychain integration, and filesystem dialogs.
- Vue 3 and Vite for the frontend.
- `go-sql-driver/mysql` for database access.
- `golang.org/x/crypto/ssh` for SSH tunnel support.

## Project Status

RowPort is under active development. The core connection, schema browsing, table data, row mutation, SQL console, profile management, and SSH tunnel workflows are implemented. Packaging, release automation, cross-platform polish, SSL/TLS options, query cancellation, and richer result tools are still planned.

## Repository Layout

```text
.
├── app.go                  # Go backend methods exposed to the frontend
├── main.go                 # Wails app entrypoint
├── frontend/               # Vue/Vite frontend
├── build/                  # Wails build assets and platform metadata
├── docs/assets/            # Project logo and brand assets
└── scripts/go-wails        # Local Wails compiler wrapper
```

## Requirements

- Go 1.24 or newer.
- Node.js and npm.
- Wails CLI v2.
- A reachable MySQL server for manual testing.
- macOS for Keychain-backed credential storage. Other platforms can run the app, but credential persistence needs platform-specific implementation work.

## Development

Install frontend dependencies:

```sh
cd frontend
npm install
```

Start Wails development mode:

```sh
cd ..
GOCACHE="$PWD/.gocache" \
GOMODCACHE="$PWD/.gomodcache" \
wails dev -compiler "$PWD/scripts/go-wails"
```

## Build

The local macOS SDK used by this project needs `UniformTypeIdentifiers` linked for the current Wails version, so use the wrapper script:

```sh
GOCACHE="$PWD/.gocache" \
GOMODCACHE="$PWD/.gomodcache" \
wails build -compiler "$PWD/scripts/go-wails"
```

If Wails reports a generic compile error, this direct command verifies the production executable:

```sh
GOCACHE="$PWD/.gocache" \
GOMODCACHE="$PWD/.gomodcache" \
"$PWD/scripts/go-wails" build \
  -buildvcs=false \
  -tags desktop,wv2runtime.download,production \
  -ldflags "-w -s" \
  -o "$PWD/build/bin/rowport"
```

## Verification

Run the frontend build:

```sh
cd frontend
npm run build
```

Run Go tests:

```sh
cd ..
GOCACHE="$PWD/.gocache" \
GOMODCACHE="$PWD/.gomodcache" \
go test ./...
```

## Security Notes

- Pasted SSH private key text is treated as one-time input and is not persisted.
- Remembered MySQL passwords, SSH passwords, and SSH key passphrases are stored in macOS Keychain.
- Turning off a remember option removes that secret from Keychain when the profile is saved.
- Deleting a profile removes all remembered secrets for that profile.
- Non-secret profile fields are stored in browser local storage.

## Roadmap

- Add SSL/TLS options and host key verification.
- Add query cancellation and richer query history.
- Add saved snippets and more result export tools.
- Improve packaging metadata and release builds.
- Add screenshots, contribution guidelines, and a formal license before publishing.

## Contributing

Issues and pull requests are welcome once the repository is published. Please keep changes focused, include verification notes, and avoid persisting secrets outside the platform credential store.
