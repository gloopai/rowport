# Performance Baseline

RowPort's differentiator is speed, so the app measures the core interactions and keeps a running baseline you can read at a glance. This is intentionally lightweight: there is no external profiler, just timing samples collected from the operations users perform most.

## What is measured

Each timed operation already records an `elapsedMs` in the operation log. Logs that also carry a `perf` category tag are folded into a per-category baseline:

| Category | Tag | Measures |
| --- | --- | --- |
| Startup | `startup` | App boot until "Application ready" |
| Connect | `connect` | Opening a connection (incl. SSH tunnel and TLS handshake) and listing databases |
| Schema | `schema` | Loading the table list for a database |
| Table data | `tableLoad` | Fetching and applying a page of table rows |
| Query | `query` | Running SQL in the console (total wall time across statements) |

The tags are attached where the timings are produced (`App.vue` startup, `useConnections`, `useSchemaExplorer`, `useTableData`, `useSqlConsole`) and aggregated centrally in `useOperationLogs` via `recordPerfSample`.

## Where to read it

- Status bar: a compact `⏱ 启动 12ms · 查询 34ms …` readout shows the most recent time per category. Hover it for a tooltip with the average, peak, and sample count.
- Operation logs: every sample is still a normal log line with its `elapsedMs`, so you can search or export the raw numbers (CSV/JSON) for deeper analysis.

Each category tracks last, average, peak, and count. Clearing the operation log also resets the baseline.

## How to use it

- Watch the averages while working against a representative database; large jumps point at slow schema loads, heavy pages, or expensive queries.
- Before a release, sanity-check that startup, schema expand, table page, and query render times are in a comfortable range on a real dataset.
- For regressions, export the logs and compare `elapsedMs` distributions across builds.

## Not covered yet

- Frame-level render profiling and virtualized-grid scroll cost.
- Automated performance regression tests in CI.
- Persisted historical baselines across sessions.
