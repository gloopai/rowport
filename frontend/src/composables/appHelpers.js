// Small standalone helpers shared across the app shell. Kept dependency-free so
// they can be imported anywhere without pulling in reactive state.

export function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function hasRuntime() {
  return Boolean(window.go?.main?.App)
}

export function perfStart() {
  return performance.now()
}

export function elapsedSince(startedAt) {
  return Math.max(0, Math.round(performance.now() - startedAt))
}

export function formatLogTime(date) {
  return date.toLocaleTimeString([], {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'})
}
