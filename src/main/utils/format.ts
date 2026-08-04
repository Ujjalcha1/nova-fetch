export function formatBytes(bytes: number): string {
  if (!bytes) return 'Unknown'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']

  let value = bytes
  let index = 0

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }

  return `${value.toFixed(2)} ${units[index]}`
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds)) return '-'

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return `${m}:${String(s).padStart(2, '0')}`
}
