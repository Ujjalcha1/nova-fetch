import { app } from 'electron'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { traceCommand } from './thumbnailTracer'

/**
 * ThumbnailManager — generates UI-preview thumbnails for local video files.
 *
 * Previously the thumbnail was written as `<video>.thumbnail.jpg` NEXT TO the
 * video, inside the user's selected download folder — polluting it with files
 * the user never asked for (THUMBNAIL_HANDLING_REPORT.md).
 *
 * Now:
 *   - the ffmpeg frame is extracted into the application temp directory
 *     (app.getPath('temp') / novafetch-thumbnails), never the download folder;
 *   - it is immediately converted into a self-contained data URL and the temp
 *     file is deleted, so no thumbnail file ever lingers on disk;
 *   - the returned data URL is stored on the download item (used directly by
 *     the renderer's <img> preview) and survives app restarts;
 *   - any leftover temp file is removed on download completed / cancelled /
 *     removed, and the whole thumbnail temp directory is wiped on app exit.
 */

function getResource(file: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', file)
  }
  return path.join(process.cwd(), 'resources', file)
}

function thumbnailDir(): string {
  const dir = path.join(app.getPath('temp'), 'novafetch-thumbnails')
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch {
    // best-effort — generation will fail gracefully below
  }
  return dir
}

function thumbnailPath(downloadId: string): string {
  // Hash the id so arbitrary download ids can't produce invalid paths.
  const safeId = crypto.createHash('sha1').update(downloadId).digest('hex').slice(0, 16)
  return path.join(thumbnailDir(), `${safeId}.jpg`)
}

/**
 * Generate a thumbnail for a local video file. Returns a self-contained
 * data URL (for the UI preview) or null if ffmpeg is unavailable / fails.
 * The temporary file is deleted as soon as the data URL is produced.
 */
export function generateThumbnail(downloadId: string, videoPath: string): Promise<string | null> {
  const ffmpeg = getResource('ffmpeg.exe')
  if (!fs.existsSync(ffmpeg)) return Promise.resolve(null)

  const thumbPath = thumbnailPath(downloadId)

  const ffmpegArgs = [
    '-i', videoPath,
    '-ss', '00:00:10',
    '-vframes', '1',
    // Downscale so the persisted data URL stays small (~tens of KB).
    '-vf', 'scale=320:-1',
    '-q:v', '3',
    thumbPath
  ]

  // Runtime proof: log the exact ffmpeg output path for the thumbnail.
  traceCommand('ffmpeg', `"${ffmpeg}" ${ffmpegArgs.join(' ')}`)

  return new Promise<string | null>((resolve) => {
    const child = execFile(ffmpeg, ffmpegArgs, { timeout: 15000 })

    child.on('close', (code: number | null) => {
      if (code === 0 && fs.existsSync(thumbPath)) {
        try {
          const data = fs.readFileSync(thumbPath)
          const dataUrl = `data:image/jpeg;base64,${data.toString('base64')}`
          // Never leave the temp file behind — the data URL is self-contained.
          fs.unlinkSync(thumbPath)
          resolve(dataUrl)
        } catch {
          try {
            if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath)
          } catch {
            // best-effort
          }
          resolve(null)
        }
      } else {
        try {
          if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath)
        } catch {
          // best-effort
        }
        resolve(null)
      }
    })

    child.on('error', () => {
      try {
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath)
      } catch {
        // best-effort
      }
      resolve(null)
    })
  })
}

/**
 * Remove any leftover temp thumbnail for a download (completed / cancelled /
 * removed). Safe to call when nothing exists.
 */
export function cleanupThumbnail(downloadId: string): void {
  try {
    const p = thumbnailPath(downloadId)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  } catch {
    // best-effort
  }
}

/** Wipe the whole thumbnail temp directory (application exit). */
export function cleanupAllThumbnails(): void {
  try {
    fs.rmSync(thumbnailDir(), { recursive: true, force: true })
  } catch {
    // best-effort
  }
}
