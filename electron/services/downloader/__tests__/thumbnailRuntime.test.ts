import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { installThumbnailFsTrace, traceCommand } from '../thumbnailTracer'

const LOG_PATH = path.join(process.cwd(), 'logs', 'thumbnail-runtime.log')

let tmpDir: string

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thumbnail-trace-'))
  installThumbnailFsTrace()
})

afterAll(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    // best-effort cleanup
  }
})

describe('thumbnail runtime tracer', () => {
  it('logs every fs write whose destination matches thumbnail/.jpg/.webp/.png', () => {
    // Do NOT delete the log here — it still holds the TRACER_ARMED line from
    // beforeAll. This test appends matching + non-matching writes on top.

    // Matching destinations — must be traced.
    fs.writeFileSync(path.join(tmpDir, 'video.mp4.thumbnail.jpg'), 'x')
    fs.writeFileSync(path.join(tmpDir, 'cover.png'), 'x')
    fs.writeFileSync(path.join(tmpDir, 'thumb.webp'), 'x')

    // The trace fires synchronously at createWriteStream() call time; destroy
    // the stream immediately so its async open can't outlive the test.
    const posterWs = fs.createWriteStream(path.join(tmpDir, 'poster.jpg'))
    posterWs.on('error', () => {})
    posterWs.destroy()

    fs.renameSync(path.join(tmpDir, 'cover.png'), path.join(tmpDir, 'renamed.png'))

    // Non-matching destinations — must NOT be traced.
    fs.writeFileSync(path.join(tmpDir, 'video.mp4'), 'x')
    fs.writeFileSync(path.join(tmpDir, 'audio.mp3'), 'x')
    fs.writeFileSync(path.join(tmpDir, 'file.part0'), 'x')
    fs.writeFileSync(path.join(tmpDir, 'file.partinfo'), 'x')

    const log = fs.readFileSync(LOG_PATH, 'utf8')

    expect(log).toContain('TRACER_ARMED')
    expect(log).toContain('video.mp4.thumbnail.jpg')
    expect(log).toContain('cover.png')
    expect(log).toContain('thumb.webp')
    expect(log).toContain('poster.jpg')
    expect(log).toContain('renamed.png')

    // Non-matching destinations never appear in the log. Entries are
    // formatted '<ts> [<op>] <abs-path>\n', so check the absolute path
    // followed by a newline. This is unambiguous: the matching entry for
    // video.mp4.thumbnail.jpg ends 'video.mp4.thumbnail.jpg\n', not
    // 'video.mp4\n'.
    expect(log).not.toContain(path.join(tmpDir, 'video.mp4') + '\n')
    expect(log).not.toContain(path.join(tmpDir, 'audio.mp3') + '\n')
    expect(log).not.toContain(path.join(tmpDir, 'file.part0') + '\n')
    expect(log).not.toContain(path.join(tmpDir, 'file.partinfo') + '\n')

    // Exactly the matching ops were traced: 3 writeFileSync (thumbnail.jpg,
    // cover.png, thumb.webp), 1 createWriteStream (poster.jpg), 1 renameSync
    // (renamed.png).
    const count = (re: RegExp) => (log.match(re) ?? []).length
    expect(count(/\[writeFileSync\]/g)).toBe(3)
    expect(count(/\[createWriteStream\]/g)).toBe(1)
    expect(count(/\[renameSync\]/g)).toBe(1)
  })

  it('records timestamp, absolute path, caller, and stack for each event', () => {
    fs.rmSync(LOG_PATH, { force: true })
    fs.writeFileSync(path.join(tmpDir, 'video.mp4.thumbnail.jpg'), 'x')

    const log = fs.readFileSync(LOG_PATH, 'utf8')
    expect(log).toContain('video.mp4.thumbnail.jpg')
    // The log was reset, so the first line is exactly our one trace entry:
    // `<ts> [writeFileSync] <abs path>` followed by caller + stack lines.
    const firstLine = log.split('\n')[0]
    expect(firstLine).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[writeFileSync\] /)
    expect(log).toMatch(/caller: .+thumbnailRuntime/)
    expect(log).toContain('at ')
  })

  it('traces child-process commands (yt-dlp / ffmpeg) at the spawn site', () => {
    traceCommand('yt-dlp', 'yt-dlp.exe --newline --progress -o "C:\\dl\\%(title)s.%(ext)s" https://x', 'outputTemplate=C:\\dl\\%(title)s.%(ext)s')
    traceCommand('ffmpeg', 'ffmpeg.exe -i video.mp4 -ss 00:00:10 -vframes 1 C:\\temp\\novafetch-thumbnails\\abc.jpg')

    const log = fs.readFileSync(LOG_PATH, 'utf8')
    expect(log).toContain('[yt-dlp] yt-dlp.exe')
    expect(log).toContain('outputTemplate=C:\\dl\\%(title)s.%(ext)s')
    expect(log).toContain('[ffmpeg] ffmpeg.exe')
    expect(log).toContain('abc.jpg')
  })
})
