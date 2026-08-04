export interface ParsedProgress {
  progress: number
  speedBytes: number
  eta: string
  totalBytes: number
  downloadedBytes: number
}

export class ProgressParser {
  private static readonly PROGRESS_REGEX =
    /\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+(.+?)\s+at\s+(.+?)\s+ETA\s+(.+)/i

  private static readonly SIZE_REGEX = /^[\s~]*([\d.]+)\s*([KMG]i?B)/i

  static parseSizeToBytes(sizeStr: string): number {
    const m = this.SIZE_REGEX.exec(sizeStr.trim())
    if (!m) return 0
    const value = parseFloat(m[1])
    const unit = m[2].toUpperCase()
    const multipliers: Record<string, number> = {
      'B': 1,
      'KIB': 1024,
      'MIB': 1024 * 1024,
      'GIB': 1024 * 1024 * 1024,
      'KB': 1000,
      'MB': 1000 * 1000,
      'GB': 1000 * 1000 * 1000
    }
    return Math.round(value * (multipliers[unit] ?? 1))
  }

  static parseSpeedToBytes(speedStr: string): number {
    return this.parseSizeToBytes(speedStr.replace(/\/s$/i, ''))
  }

  static parse(line: string): ParsedProgress | null {
    const text = line.trim()

    if (!text.startsWith('[download]')) {
      return null
    }

    const match = this.PROGRESS_REGEX.exec(text)

    if (!match) {
      return null
    }

    const totalBytes = this.parseSizeToBytes(match[2])
    const progress = Number(match[1])

    return {
      progress,
      speedBytes: this.parseSpeedToBytes(match[3]),
      eta: match[4].trim(),
      totalBytes,
      downloadedBytes: Math.round(totalBytes * progress / 100)
    }
  }

  static isCompleted(line: string): boolean {
    const text = line.toLowerCase()

    return text.includes('100%') || text.includes('has already been downloaded')
  }

  static isDestination(line: string): boolean {
    return line.includes('Destination:')
  }

  private static readonly DESTINATION_REGEX = /Destination:\s+(.+)/i

  static extractDestinationFilename(line: string): string | null {
    const match = this.DESTINATION_REGEX.exec(line.trim())
    return match ? match[1].trim() : null
  }

  static isMerging(line: string): boolean {
    return line.includes('Merging formats') || line.includes('Merger')
  }

  private static readonly MERGER_REGEX = /Merging formats into "(.+)"/i

  static extractMergedFilename(line: string): string | null {
    const match = this.MERGER_REGEX.exec(line.trim())
    return match ? match[1].trim() : null
  }

  static isError(line: string): boolean {
    return line.includes('ERROR:')
  }
}
