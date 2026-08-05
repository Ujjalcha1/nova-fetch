import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { app } from 'electron'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

/** Firestore collection holding one document per device, keyed by deviceId. */
const DEVICES_COLLECTION = 'devices'

/** Locally persisted payload used to keep the device UUID stable across restarts. */
interface StoredDeviceIdentity {
  deviceId: string
}

/** Static device attributes collected from the machine and the app. */
export interface DeviceInfo {
  hostname: string
  username: string
  os: string
  osVersion: string
  architecture: string
  cpuModel: string
  cpuCores: number
  totalRam: number
  appVersion: string
  language: string
  timezone: string
}

function deviceIdPath(): string {
  return path.join(app.getPath('userData'), 'device-id.json')
}

/** Cached once resolved so every call returns the same ID for the process lifetime. */
let cachedDeviceId: string | null = null

/**
 * Upserts the device document in the `devices` collection. The document ID is
 * the persistent deviceId; `merge` keeps createdAt stable on re-registration.
 */
export async function registerDevice(): Promise<void> {
  console.log('REGISTER DEVICE START')

  const deviceId = getDeviceId()
  console.log('Device ID:', deviceId)

  const data = {
    deviceId,
    ...collectDeviceInfo(),
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp()
  }

  console.log('Data:', data)

  await setDoc(doc(db, DEVICES_COLLECTION, deviceId), data, { merge: true })

  console.log('REGISTER DEVICE DONE')
}

/**
 * Returns the persistent device UUID, generating and storing a fresh one on
 * first use. Never throws: a read/write failure falls back to a new ID that is
 * still memoized for the remainder of the session.
 */
export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId

  try {
    const p = deviceIdPath()
    if (fs.existsSync(p)) {
      const stored = JSON.parse(fs.readFileSync(p, 'utf8')) as StoredDeviceIdentity
      if (stored.deviceId) {
        cachedDeviceId = stored.deviceId
        return cachedDeviceId
      }
    }
  } catch {
    // Corrupt or unreadable identity file — generate a new ID below.
  }

  cachedDeviceId = crypto.randomUUID()
  try {
    const p = deviceIdPath()
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(p, JSON.stringify({ deviceId: cachedDeviceId }, null, 2), 'utf8')
  } catch {
    // Persistence is best-effort; the in-memory ID still works for this session.
  }
  return cachedDeviceId
}

/** Best-effort Windows user name; some environments do not expose one. */
function safeUsername(): string {
  try {
    return os.userInfo().username
  } catch {
    return ''
  }
}

/** Collects the static device attributes reported to analytics. */
export function collectDeviceInfo(): DeviceInfo {
  const cpus = os.cpus()
  return {
    hostname: os.hostname(),
    username: safeUsername(),
    os: os.platform(),
    osVersion: os.release(),
    architecture: os.arch(),
    cpuModel: cpus.length > 0 ? cpus[0].model : '',
    cpuCores: cpus.length,
    totalRam: os.totalmem(),
    appVersion: app.getVersion(),
    language: app.getLocale(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  }
}

/**
 * Records activity on the device document. Uses an upsert so it never rejects
 * if the document has not been registered yet (creates a minimal one).
 */
export async function updateLastActive(): Promise<void> {
  const deviceId = getDeviceId()
  await setDoc(
    doc(db, DEVICES_COLLECTION, deviceId),
    { lastActive: serverTimestamp() },
    { merge: true }
  )
}
