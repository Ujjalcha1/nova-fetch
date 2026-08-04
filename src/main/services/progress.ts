export interface DownloadProgress {
  percent: number
  speed: string
  eta: string
}

export function parseProgress(line: string): DownloadProgress | null {
  const match = line.match(/\[download\]\s+([\d.]+)%.*?at\s+([^\s]+).*?ETA\s+([0-9:]+)/)

  if (!match) {
    return null
  }

  return {
    percent: parseFloat(match[1]),
    speed: match[2],
    eta: match[3]
  }
}
