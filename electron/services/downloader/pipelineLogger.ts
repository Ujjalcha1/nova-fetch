import fs from 'node:fs'
import path from 'node:path'

/**
 * Runtime pipeline instrumentation for the multipart downloader.
 *
 * Every stage of the download pipeline appends a timestamped line to
 * `logs/download-pipeline.log` (relative to the process working directory),
 * so a real download can be audited end-to-end after the fact — runtime
 * evidence rather than static analysis (see RUNTIME_PIPELINE_REPORT.md).
 *
 * This module intentionally imports nothing from Electron so it can also be
 * exercised from the vitest node environment.
 */

const LOG_DIR = path.join('logs')
const LOG_FILE_NAME = 'download-pipeline.log'

let resolvedLogFile: string | null = null
let warned = false

function resolveLogFile(): string | null {
  if (resolvedLogFile) return resolvedLogFile
  try {
    const dir = path.join(process.cwd(), LOG_DIR)
    fs.mkdirSync(dir, { recursive: true })
    resolvedLogFile = path.join(dir, LOG_FILE_NAME)
    return resolvedLogFile
  } catch {
    return null
  }
}

/**
 * Append one timestamped pipeline event to logs/download-pipeline.log.
 *
 * Format: `<ISO timestamp> [<STAGE>] <details>`
 *
 * Never throws — instrumentation must never be able to break the download it
 * is observing.
 */
export function pipelineLog(event: string, details = ''): void {
  try {
    const file = resolveLogFile()
    if (!file) {
      if (!warned) {
        warned = true
        console.warn(`[pipeline] cannot open ${path.join(LOG_DIR, LOG_FILE_NAME)} — pipeline logging disabled`)
      }
      return
    }
    const timestamp = new Date().toISOString()
    const line = `${timestamp} [${event}]${details ? ` ${details}` : ''}\n`
    fs.appendFileSync(file, line)
  } catch {
    // never break the pipeline because of logging
  }
}
