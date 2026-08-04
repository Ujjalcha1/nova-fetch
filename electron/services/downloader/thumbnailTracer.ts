import fs from 'node:fs'
import path from 'node:path'

/**
 * ThumbnailTracer — runtime file-write instrumentation for thumbnail-related
 * destinations.
 *
 * Wraps fs.writeFile / writeFileSync / createWriteStream / rename /
 * renameSync (log-only, behaviour unchanged) and logs every call whose
 * destination filename contains "thumbnail", ".jpg", ".webp" or ".png" to
 * `logs/thumbnail-runtime.log` with a timestamp, the absolute path, the call
 * stack, and the caller file/function.
 *
 * Also exposes traceCommand() so the yt-dlp command builder (output template)
 * and the ffmpeg output path can be traced from their call sites — those
 * write inside child processes (yt-dlp.exe / ffmpeg.exe) and cannot be seen
 * by the fs patch, so they must be logged at the spawn site.
 *
 * Instrumentation only — never changes logic. See THUMBNAIL_RUNTIME_REPORT.md.
 */

const LOG_FILE = path.join(process.cwd(), 'logs', 'thumbnail-runtime.log')

/** Destination filenames we care about. */
const MATCH_RE = /thumbnail|\.jpg|\.webp|\.png/i

/**
 * The original appendFileSync, captured before any patching. Logging must
 * never re-enter the traced fs functions (Node's appendFileSync routes
 * through writeFileSync internally, which would otherwise recurse).
 */
const origAppendFileSync = fs.appendFileSync.bind(fs)

function ensureLogFile(): void {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
  } catch {
    // best-effort
  }
}

function isTraceableDest(dest: unknown): boolean {
  if (typeof dest !== 'string') return false
  try {
    // Never trace our own log file (its name contains "thumbnail").
    if (path.resolve(dest) === path.resolve(LOG_FILE)) return false
  } catch {
    // fall through to the regex check
  }
  return MATCH_RE.test(dest)
}

/** Extract the first user-frame (caller) from a stack string. */
function callerInfo(stack: string | undefined): { file: string; fn: string } {
  const frames = (stack ?? '').split('\n').slice(2) // skip Error + our helper
  for (const raw of frames) {
    const line = raw.trim()
    if (!line.startsWith('at ')) continue
    const m = /^at\s+(?:(.+?)\s+\()?(.+?)\)?\s*$/.exec(line)
    if (!m) continue
    const fn = (m[1] ?? '').trim() || '<anonymous>'
    const file = (m[2] ?? '').trim()
    if (!file) continue
    if (/node:|thumbnailTracer|node_modules|vite_ssr|__vite_ssr|electron\.js/.test(file)) continue
    return { file, fn }
  }
  return { file: 'unknown', fn: 'unknown' }
}

function appendLine(line: string): void {
  try {
    ensureLogFile()
    origAppendFileSync(LOG_FILE, line + '\n')
  } catch {
    // best-effort — instrumentation must never break the pipeline
  }
}

/** Log a file write whose destination looks like a thumbnail/image. */
function traceWrite(op: string, dest: unknown): void {
  if (!isTraceableDest(dest)) return
  const err = new Error('trace')
  const { file, fn } = callerInfo(err.stack)
  const timestamp = new Date().toISOString()
  const abs = path.resolve(String(dest))
  appendLine(
    `${timestamp} [${op}] ${abs}\n` +
      `  caller: ${file} ${fn}\n` +
      `  stack:\n${err.stack ?? '(no stack)'}\n`
  )
}

/** Log a child-process command (yt-dlp / ffmpeg) that may write images. */
export function traceCommand(kind: string, command: string, extra = ''): void {
  const err = new Error('trace')
  const { file, fn } = callerInfo(err.stack)
  const timestamp = new Date().toISOString()
  appendLine(
    `${timestamp} [${kind}] ${command}${extra ? ` (${extra})` : ''}\n` +
      `  caller: ${file} ${fn}\n` +
      `  stack:\n${err.stack ?? '(no stack)'}\n`
  )
}

/** Log a one-time line proving the tracer is installed at app startup. */
export function traceArmed(): void {
  appendLine(`${new Date().toISOString()} [TRACER_ARMED] thumbnail fs tracing installed`)
}

const installedKey = '__thumbnailTracerInstalled'

/**
 * Wrap the fs write/rename methods (log-only). Idempotent. Only logs when the
 * destination matches thumbnail/.jpg/.webp/.png (and is not our own log).
 */
export function installThumbnailFsTrace(): void {
  const fsAny = fs as typeof fs & { [installedKey]?: boolean }
  if (fsAny[installedKey]) return
  fsAny[installedKey] = true

  // Widen the bound originals so the wrappers stay compatible with the
  // overloaded node:fs methods regardless of which overload the caller used.
  const asFn = (fn: unknown): (...args: unknown[]) => unknown => fn as (...args: unknown[]) => unknown
  const original: Record<string, (...args: unknown[]) => unknown> = {
    writeFile: asFn(fs.writeFile.bind(fs)),
    writeFileSync: asFn(fs.writeFileSync.bind(fs)),
    createWriteStream: asFn(fs.createWriteStream.bind(fs)),
    rename: asFn(fs.rename.bind(fs)),
    renameSync: asFn(fs.renameSync.bind(fs))
  }

  fs.writeFile = function (file: fs.PathOrFileDescriptor, ...rest: unknown[]) {
    traceWrite('writeFile', file)
    return original.writeFile(file, ...rest)
  } as typeof fs.writeFile

  fs.writeFileSync = function (file: fs.PathOrFileDescriptor, ...rest: unknown[]) {
    traceWrite('writeFileSync', file)
    return original.writeFileSync(file, ...rest)
  } as typeof fs.writeFileSync

  fs.createWriteStream = function (pathArg: fs.PathLike, ...rest: unknown[]) {
    traceWrite('createWriteStream', pathArg)
    return original.createWriteStream(pathArg, ...rest)
  } as typeof fs.createWriteStream

  fs.rename = function (oldPath: fs.PathLike, newPath: fs.PathLike, ...rest: unknown[]) {
    traceWrite('rename', newPath)
    return original.rename(oldPath, newPath, ...rest)
  } as typeof fs.rename

  fs.renameSync = function (oldPath: fs.PathLike, newPath: fs.PathLike) {
    traceWrite('renameSync', newPath)
    return original.renameSync(oldPath, newPath)
  } as typeof fs.renameSync

  traceArmed()
}
