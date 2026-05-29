// Reads a localStorage value, transparently migrating data saved under a
// legacy key (the project was renamed from "mysql-gui" to "rowport"). The
// legacy entry is copied to the new key and removed so existing user data
// (profiles, layout, query history) survives the rename.
export function readStoredRaw(key, legacyKey) {
  const current = localStorage.getItem(key)
  if (current !== null) return current
  if (legacyKey) {
    const legacy = localStorage.getItem(legacyKey)
    if (legacy !== null) {
      localStorage.setItem(key, legacy)
      localStorage.removeItem(legacyKey)
      return legacy
    }
  }
  return null
}
