const STORAGE_KEY = 'mysql-gui.profiles'

export function loadProfiles(newId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map((profile) => normalizeProfile(profile, newId)) : []
  } catch {
    return []
  }
}

export function persistProfiles(profiles) {
  const safeProfiles = profiles.map((profile) => ({
    ...profile,
    password: '',
    ssh: {
      ...profile.ssh,
      password: '',
      privateKey: '',
      passphrase: ''
    }
  }))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeProfiles))
}

export function cloneProfile(profile) {
  return JSON.parse(JSON.stringify(profile))
}

export function emptyProfile(newId) {
  return {
    id: newId(),
    name: 'Local MySQL',
    host: '127.0.0.1',
    port: '3306',
    user: 'root',
    password: '',
    rememberPassword: false,
    database: '',
    advanced: {
      connectTimeoutSeconds: 8,
      maxOpenConns: 8,
      maxIdleConns: 2
    },
    ssh: {
      enabled: false,
      host: '',
      port: '22',
      user: '',
      password: '',
      rememberPassword: false,
      privateKey: '',
      privateKeyPath: '',
      passphrase: '',
      rememberPassphrase: false
    }
  }
}

export function normalizeProfile(profile, newId) {
  const base = emptyProfile(newId)
  const advanced = {...base.advanced, ...(profile.advanced || {})}
  return {
    ...base,
    ...profile,
    password: '',
    advanced: {
      connectTimeoutSeconds: clamp(Number(advanced.connectTimeoutSeconds) || 8, 1, 120),
      maxOpenConns: clamp(Number(advanced.maxOpenConns) || 8, 1, 128),
      maxIdleConns: clamp(Number(advanced.maxIdleConns) || 2, 0, Math.max(1, Number(advanced.maxOpenConns) || 8))
    },
    ssh: {
      ...base.ssh,
      ...(profile.ssh || {}),
      password: '',
      privateKey: '',
      passphrase: ''
    }
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
