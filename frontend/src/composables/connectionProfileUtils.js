import {readStoredRaw} from './storage'

const STORAGE_KEY = 'rowport.profiles'
const LEGACY_STORAGE_KEY = 'mysql-gui.profiles'

export function loadProfiles(newId) {
  try {
    const parsed = JSON.parse(readStoredRaw(STORAGE_KEY, LEGACY_STORAGE_KEY) || '[]')
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

export const tlsModeOptions = [
  {value: 'disabled', label: '禁用'},
  {value: 'preferred', label: '优先（不校验）'},
  {value: 'required', label: '必需（不校验）'},
  {value: 'verify-ca', label: '校验 CA'},
  {value: 'verify-identity', label: '校验 CA 与主机名'}
]

function emptyTls() {
  return {
    mode: 'disabled',
    serverName: '',
    caCertPath: '',
    clientCertPath: '',
    clientKeyPath: ''
  }
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
    tls: emptyTls(),
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
      rememberPassphrase: false,
      knownHostKey: ''
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
    tls: {
      ...base.tls,
      ...(profile.tls || {}),
      mode: (profile.tls && profile.tls.mode) || base.tls.mode
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
