# Contributing to RowPort

Thanks for helping improve RowPort. The project is still early, so focused changes with clear verification notes are the easiest to review.

## Development Setup

Requirements:

- Go 1.24 or newer.
- Node.js 20 or newer and npm.
- Wails CLI v2.
- A reachable MySQL server for manual connection testing.
- macOS for the current Keychain-backed credential persistence path.

Install frontend dependencies:

```sh
cd frontend
npm ci
```

Run the app in development mode:

```sh
cd ..
GOCACHE="$PWD/.gocache" \
GOMODCACHE="$PWD/.gomodcache" \
wails dev -compiler "$PWD/scripts/go-wails"
```

## Verification

Before opening a pull request, run:

```sh
cd frontend
npm run build
```

```sh
cd ..
GOCACHE="$PWD/.gocache" \
GOMODCACHE="$PWD/.gomodcache" \
go test ./...
```

For release-oriented changes, also verify the production executable:

```sh
GOCACHE="$PWD/.gocache" \
GOMODCACHE="$PWD/.gomodcache" \
"$PWD/scripts/go-wails" build \
  -buildvcs=false \
  -tags desktop,wv2runtime.download,production \
  -ldflags "-w -s" \
  -o "$PWD/build/bin/rowport"
```

## Pull Request Guidelines

- Keep each PR focused on one feature, fix, or cleanup.
- Include screenshots or short screen recordings for UI changes.
- Include the commands you ran to verify the change.
- Do not commit local build outputs, dependency folders, database dumps, or secrets.
- Do not store database passwords, SSH passwords, private keys, or passphrases in local storage, logs, test fixtures, or the repository.
- Keep the Vue + Wails + Go architecture intact unless the change is explicitly about architecture.

## UI Guidelines

RowPort should feel like a modern desktop database tool:

- Keep the dark desktop style consistent across windows, panels, and dialogs.
- Keep dialogs modal; clicking the backdrop should not close them.
- Use the existing custom select controls instead of native `select` elements.
- Preserve the main layout patterns: left schema tree, right result tabs, bottom log panel, and draggable split panes.
- Avoid browser-like text selection and native context menus outside input/editing areas.

## Reporting Bugs

Please include:

- Operating system and version.
- RowPort version or commit SHA.
- Database type and version.
- Whether SSH tunneling is enabled.
- Steps to reproduce.
- Expected and actual behavior.
- Relevant exported logs with secrets removed.
