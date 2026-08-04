export interface ProgressInfo {
  percent: number
  speed: string
  eta: string
}

const PROGRESS_REGEX =
  /\[download\]\s+(\d+(?:\.\d+)?)%\s+of.*?at\s+(\S+(?:\/s)?)\s+ETA\s+([0-9:]+|Unknown)/

export function parseProgress(text: string): ProgressInfo | null {
  const lines = text.split(/\r?\n/)

  for (const line of lines) {
    const match = line.match(PROGRESS_REGEX)

    if (match) {
      return {
        percent: parseFloat(match[1]),
        speed: match[2],
        eta: match[3]
      }
    }
  }

  return null
}
