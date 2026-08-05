const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
const SCALE = 1024

function formatValue(value: number, decimals: number, unit: string): string {
  return `${value.toFixed(decimals)} ${unit}`
}

export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return '0 B/s'
  let value = bytesPerSecond
  let unitIndex = 0
  const maxIndex = UNITS.length - 1
  while (value >= SCALE && unitIndex < maxIndex) {
    value /= SCALE
    unitIndex++
  }
  const decimals = unitIndex === 0 ? 0 : 2
  return formatValue(value, decimals, `${UNITS[unitIndex]}/s`)
}

/**
 * formatTime — canonical reusable time formatter.
 *
 * Converts a duration in seconds to a human-readable string showing the two
 * most significant non-zero units. Singular/plural handled for all units.
 *
 * Examples:
 *   25        → "25 sec"
 *   72        → "1 min 12 sec"
 *   900       → "15 min"
 *   7800      → "2 hr 10 min"
 *   259200    → "3 days"
 *   13140000  → "5 months"
 *   31536000  → "1 year"
 */
export function formatTime(seconds: number): string {
  if (seconds <= 0) return '0 sec'

  const MINUTE = 60
  const HOUR = 60 * MINUTE
  const DAY = 24 * HOUR
  const MONTH = 30 * DAY
  const YEAR = 12 * MONTH

  const years  = Math.floor(seconds / YEAR)
  let rem      = seconds % YEAR
  const months = Math.floor(rem / MONTH)
  rem          = rem % MONTH
  const days   = Math.floor(rem / DAY)
  rem          = rem % DAY
  const hours  = Math.floor(rem / HOUR)
  rem          = rem % HOUR
  const minutes = Math.floor(rem / MINUTE)
  const secs   = Math.floor(rem % MINUTE)

  type Part = { value: number; label: string }
  const all: Part[] = [
    { value: years,   label: years   === 1 ? 'year'  : 'years'  },
    { value: months,  label: months  === 1 ? 'month' : 'months' },
    { value: days,    label: days    === 1 ? 'day'   : 'days'   },
    { value: hours,   label: 'hr'                               },
    { value: minutes, label: 'min'                              },
    { value: secs,    label: 'sec'                              },
  ]

  const first = all.findIndex((p) => p.value > 0)
  if (first === -1) return '0 sec'

  const parts: string[] = [`${all[first].value} ${all[first].label}`]
  if (first + 1 < all.length && all[first + 1].value > 0) {
    parts.push(`${all[first + 1].value} ${all[first + 1].label}`)
  }
  return parts.join(' ')
}

/** @deprecated Use formatTime instead */
export const formatDuration = formatTime

export function formatEta(seconds: number, status?: string): string {
  if (status === 'completed') return 'Completed'
  if (seconds <= 0) return '--'
  return formatTime(seconds)
}


const ERROR_PATTERNS: [RegExp, string][] = [
  [/no space left on device/i, 'Disk full'],
  [/permission denied/i, 'Permission denied'],
  [/enotfound|eai_again/i, 'Network error — DNS resolution failed'],
  [/econnrefused/i, 'Network error — connection refused'],
  [/etimedout|timeout/i, 'Network error — connection timed out'],
  [/econnreset/i, 'Network error — connection reset'],
  [/enetunreach/i, 'Network error — network unreachable'],
  [/econnaborted/i, 'Network error — connection aborted'],
  [/sign in|login required|confirm your age/i, 'Authentication required'],
  [/private video|age.restrict|age verification/i, 'Age-restricted content'],
  [/removed by uploader|removed for violating/i, 'Content removed'],
  [/copyright|takedown/i, 'Content removed (copyright claim)'],
  [/not available in your country|blocked it in your country|not made this video available/i, 'Region blocked'],
  [/members.only|member.only/i, 'Members-only content'],
  [/ffmpeg|ffprobe/i, 'Required tool not found (FFmpeg)'],
  [/yt-dlp.*not found|enoent/i, 'Required tool not found'],
  [/unavailable|video unavailable|this video is not available/i, 'Content unavailable'],
  [/retry/i, 'Retry failed'],
  [/file exists/i, 'File already exists'],
]

export function formatErrorMessage(error: unknown): string {
  if (!error) return ''
  const raw = typeof error === 'string' ? error : error instanceof Error ? error.message : String(error)
  if (!raw || raw.trim() === '') return ''

  let clean = raw.replace(/[A-Z]:\\[^:\n]*\\?/gi, '').replace(/\/[\w.\-/]+[/\\]/g, '')

  for (const [pattern, friendly] of ERROR_PATTERNS) {
    if (pattern.test(clean)) return friendly
  }

  clean = clean.trim()
  if (clean.length > 150) clean = clean.slice(0, 150).trimEnd() + '...'
  return clean || 'Download failed'
}

/**
 * Format a progress percentage for display.
 * - Clamps between 0 and 100.
 * - Shows at most 1 decimal place.
 * - Hides trailing ".0" for integer values.
 */
export function formatProgress(value: number): string {
  const clamped = Math.min(100, Math.max(0, value))
  if (Number.isInteger(clamped)) {
    return `${clamped}%`
  }
  return `${clamped.toFixed(1)}%`
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  let value = bytes
  let unitIndex = 0
  const maxIndex = UNITS.length - 1
  while (value >= SCALE && unitIndex < maxIndex) {
    value /= SCALE
    unitIndex++
  }
  const decimals = unitIndex === 0 ? 0 : 2
  return formatValue(value, decimals, UNITS[unitIndex])
}
