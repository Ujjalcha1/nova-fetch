interface SpeedSample {
  time: number
  speed: number
}

const samplesByDownload = new Map<string, SpeedSample[]>()
const lastStoreUpdate = new Map<string, number>()
const lastETAUpdate = new Map<string, number>()

const WINDOW_MS = 5000
const THROTTLE_MS = 500
const ETA_THROTTLE_MS = 1000

export function pushSpeedSample(id: string, speed: number): void {
  const now = Date.now()
  let samples = samplesByDownload.get(id)
  if (!samples) {
    samples = []
    samplesByDownload.set(id, samples)
  }
  samples.push({ time: now, speed })
}

export function shouldUpdateStore(id: string): boolean {
  const now = Date.now()
  const last = lastStoreUpdate.get(id) ?? 0
  return now - last >= THROTTLE_MS
}

export function getSmoothedSpeed(id: string): number {
  const now = Date.now()
  const samples = samplesByDownload.get(id)
  if (!samples || samples.length === 0) return 0

  const cutoff = now - WINDOW_MS
  while (samples.length > 0 && samples[0].time < cutoff) {
    samples.shift()
  }

  if (samples.length === 0) return 0

  // Exclude zero-speed samples: they are pushed while the download is paused,
  // so including them would drag the displayed speed toward 0 B/s for up to
  // WINDOW_MS after a resume. Paused time must not count toward throughput.
  let sum = 0
  let count = 0
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].speed <= 0) continue
    sum += samples[i].speed
    count++
  }
  return count > 0 ? sum / count : 0
}

export function markStoreUpdated(id: string): void {
  lastStoreUpdate.set(id, Date.now())
}

export function shouldUpdateEta(id: string): boolean {
  const now = Date.now()
  const last = lastETAUpdate.get(id) ?? 0
  return now - last >= ETA_THROTTLE_MS
}

export function markEtaUpdated(id: string): void {
  lastETAUpdate.set(id, Date.now())
}

/**
 * Estimate remaining seconds using the SAME smoothed speed that is displayed
 * (see getSmoothedSpeed). Using the smoothed instantaneous speed instead of a
 * lifetime average keeps ETA consistent with the shown speed and naturally
 * excludes paused/queued time, since no speed samples are produced while the
 * download is paused.
 */
export function computeEta(id: string, downloaded: number, totalSize: number): number {
  const remaining = totalSize - downloaded
  if (downloaded <= 0 || totalSize <= 0 || remaining <= 0) return 0
  const speed = getSmoothedSpeed(id)
  if (speed <= 0) return 0
  return Math.round(remaining / speed)
}

export function clearSamples(id: string): void {
  samplesByDownload.delete(id)
  lastStoreUpdate.delete(id)
  lastETAUpdate.delete(id)
}
