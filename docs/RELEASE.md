# Building and Releasing RowPort

This document explains how RowPort is built, why the local Wails compiler wrapper exists, and the checklist for cutting a release. RowPort is pre-release software and there is no automated release pipeline yet; macOS is the primary build target.

## The `scripts/go-wails` wrapper

Wails v2.11 on the current macOS SDK fails to link unless the `UniformTypeIdentifiers` framework is passed to the Go linker. RowPort ships a tiny wrapper that injects that flag and then forwards every argument to the real `go` toolchain:

```sh
#!/bin/sh
export CGO_LDFLAGS="${CGO_LDFLAGS} -framework UniformTypeIdentifiers"
exec go "$@"
```

Use it by passing `-compiler "$PWD/scripts/go-wails"` to `wails dev` / `wails build`, or by invoking it directly in place of `go` for a build.

When the wrapper is needed:

- macOS builds with Wails v2.11 (dev and production). This is the common case.

When the wrapper is NOT needed:

- Plain Go work that does not link the desktop runtime: `go test ./...`, `go vet ./...`, `go build` of non-Wails code. These run with the standard `go` command.
- Future Wails versions or SDKs that no longer require the framework flag. If `wails build` links cleanly without it, the wrapper can be dropped.

All Go commands in this repo set `GOCACHE` and `GOMODCACHE` to repo-local folders so the build never depends on the developer's global cache.

## Prerequisites

- Go 1.24 or newer.
- Node.js 20 or newer and npm.
- Wails CLI v2.
- macOS (for Keychain-backed credentials and the primary build target).

## Development build

```sh
cd frontend && npm ci && cd ..
GOCACHE="$PWD/.gocache" \
GOMODCACHE="$PWD/.gomodcache" \
wails dev -compiler "$PWD/scripts/go-wails"
```

## macOS production build

Preferred path through the Wails CLI:

```sh
GOCACHE="$PWD/.gocache" \
GOMODCACHE="$PWD/.gomodcache" \
wails build -compiler "$PWD/scripts/go-wails"
```

If Wails reports a generic compile error, this direct command verifies the production executable without the CLI wrapper layer:

```sh
GOCACHE="$PWD/.gocache" \
GOMODCACHE="$PWD/.gomodcache" \
"$PWD/scripts/go-wails" build \
  -buildvcs=false \
  -tags desktop,wv2runtime.download,production \
  -ldflags "-w -s" \
  -o "$PWD/build/bin/rowport"
```

Build artifacts land in `build/bin/`:

- `build/bin/rowport` - the raw executable.
- `build/bin/rowport.app` - the macOS application bundle produced by `wails build`.

Neither is committed to git (`build/bin` is gitignored).

## Release checklist

Before tagging a release, confirm:

1. `cd frontend && npm run build` succeeds.
2. `go test ./...` passes (with the repo-local cache env vars).
3. `go vet ./...` is clean and `gofmt -l app.go app_test.go` reports nothing.
4. `CHANGELOG.md` has an entry describing new features, fixes, security-relevant changes, and known gaps.
5. The README status section and platform matrix still match reality.
6. Manual smoke test on macOS covers: create profile, test connection, plain MySQL connect, SSH tunnel connect, TLS connect, schema browse, paginated table read, `SELECT`, single-row insert/edit/delete, CSV/JSON export, disconnect.
7. Version is bumped following semver and the release is marked pre-release while the project is in early preview.

## Not yet automated

- GitHub Actions release workflow and uploaded artifacts.
- macOS code signing and notarization.
- Windows and Linux packaging and credential storage.

See [PROJECT_PLAN.zh-CN.md](PROJECT_PLAN.zh-CN.md) section 7.10 for the full packaging roadmap.
