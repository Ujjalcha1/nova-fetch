import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export class DownloadStoreService {
  private static filePath(): string {
    return path.join(app.getPath('userData'), 'downloads.json')
  }

  static load(): unknown[] {
    try {
      const p = this.filePath()
      if (!fs.existsSync(p)) return []
      const raw = fs.readFileSync(p, 'utf8')
      return JSON.parse(raw)
    } catch {
      return []
    }
  }

  static save(downloads: unknown[]): void {
    try {
      const p = this.filePath()
      const dir = path.dirname(p)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(p, JSON.stringify(downloads, null, 2), 'utf8')
    } catch (err) {
      console.error('[DownloadStoreService] save failed:', err)
    }
  }
}
