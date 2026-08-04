const ID_REGEX = /^[a-zA-Z0-9_-]{11,}$/

// --- URL type detection ---

export type DetectedUrlType =
  | { type: 'youtube'; url: string; kind: 'video' | 'playlist' }
  | { type: 'direct-file'; url: string; extension: string }
  | { type: 'magnet'; url: string; infoHash?: string }
  | { type: 'unknown'; url: string }

export type ParsedYoutubeUrl =
  | { supported: true; kind: 'video'; url: string; playlistId?: string }
  | { supported: true; kind: 'playlist'; url: string; playlistId: string }
  | { supported: false; type: string; message: string }

const SUPPORTED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com'
])

function isYouTubeHost(hostname: string): boolean {
  return SUPPORTED_HOSTS.has(hostname)
}

function buildCanonical(videoId: string): string {
  const url = new URL('https://www.youtube.com/watch')
  url.searchParams.set('v', videoId)
  return url.toString()
}

function extractPathId(pathname: string): string | null {
  const match = pathname.match(/^\/([a-zA-Z0-9_-]{11,})\/?$/)
  return match ? match[1] : null
}

function extractSegmentId(pathname: string, prefix: string): string | null {
  const match = pathname.match(new RegExp(`^/${prefix}/([a-zA-Z0-9_-]+)`))
  return match ? match[1] : null
}

export function parseYoutubeUrl(input: string): ParsedYoutubeUrl {
  if (!input || !input.trim()) {
    throw new Error('URL is required')
  }

  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new Error('Invalid URL format')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('URL must start with http:// or https://')
  }

  const hostname = url.hostname.toLowerCase()

  if (!isYouTubeHost(hostname)) {
    throw new Error('Unsupported host')
  }

  let videoId: string | null = null
  let playlistId: string | undefined

  // --- youtu.be ---
  if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
    videoId = extractPathId(url.pathname)
    if (!videoId) throw new Error('Invalid YouTube URL')

    playlistId = url.searchParams.get('list') ?? undefined
    return { supported: true, kind: 'video', url: buildCanonical(videoId), playlistId }
  }

  const pathname = url.pathname

  // --- attribution_link ---
  if (pathname === '/attribution_link') {
    const uParam = url.searchParams.get('u')
    if (!uParam) throw new Error('Invalid YouTube URL')

    const innerUrlStr = decodeURIComponent(uParam)
    const innerUrl = new URL(innerUrlStr.startsWith('http') ? innerUrlStr : `https://www.youtube.com${innerUrlStr}`)
    videoId = innerUrl.searchParams.get('v')
    if (!videoId) throw new Error('Invalid YouTube URL')

    playlistId = innerUrl.searchParams.get('list') ?? undefined
    return { supported: true, kind: 'video', url: buildCanonical(videoId), playlistId }
  }

  // --- oembed ---
  if (pathname === '/oembed') {
    const urlParam = url.searchParams.get('url')
    if (!urlParam) throw new Error('Invalid YouTube URL')
    return parseYoutubeUrl(urlParam)
  }

  // --- /playlist ---
  if (pathname === '/playlist') {
    const listId = url.searchParams.get('list')
    if (!listId) throw new Error('Invalid playlist ID')
    return {
      supported: true,
      kind: 'playlist',
      url: `https://www.youtube.com/playlist?list=${listId}`,
      playlistId: listId
    }
  }

  // --- /watch ---
  if (pathname === '/watch') {
    videoId = url.searchParams.get('v')
    if (!videoId) throw new Error('Missing video ID')
    if (!ID_REGEX.test(videoId)) throw new Error('Invalid YouTube URL')

    playlistId = url.searchParams.get('list') ?? undefined
    return { supported: true, kind: 'video', url: buildCanonical(videoId), playlistId }
  }

  // --- /shorts/ID ---
  if (pathname.startsWith('/shorts/')) {
    videoId = extractSegmentId(pathname, 'shorts')
    if (!videoId) throw new Error('Invalid shorts URL')

    playlistId = url.searchParams.get('list') ?? undefined
    return { supported: true, kind: 'video', url: buildCanonical(videoId), playlistId }
  }

  // --- /live/ID ---
  if (pathname.startsWith('/live/')) {
    videoId = extractSegmentId(pathname, 'live')
    if (!videoId) throw new Error('Invalid live URL')

    playlistId = url.searchParams.get('list') ?? undefined
    return { supported: true, kind: 'video', url: buildCanonical(videoId), playlistId }
  }

  // --- /embed/ID ---
  if (pathname.startsWith('/embed/')) {
    videoId = extractSegmentId(pathname, 'embed')
    if (!videoId) throw new Error('Invalid YouTube URL')

    playlistId = url.searchParams.get('list') ?? undefined
    return { supported: true, kind: 'video', url: buildCanonical(videoId), playlistId }
  }

  // --- /v/ID, /e/ID ---
  if (pathname.startsWith('/v/') || pathname.startsWith('/e/')) {
    const prefix = pathname.startsWith('/v/') ? 'v' : 'e'
    videoId = extractSegmentId(pathname, prefix)
    if (!videoId) throw new Error('Invalid YouTube URL')

    playlistId = url.searchParams.get('list') ?? undefined
    return { supported: true, kind: 'video', url: buildCanonical(videoId), playlistId }
  }

  throw new Error('Invalid YouTube URL')
}

// --- Helpers for magnet detection ---

function parseMagnetUrl(input: string): { url: string; infoHash?: string } | null {
  if (!input.trim().toLowerCase().startsWith('magnet:?')) return null
  try {
    const params = new URLSearchParams(input.slice(8))
    const xt = params.get('xt')
    let infoHash: string | undefined
    if (xt && xt.startsWith('urn:btih:')) {
      infoHash = xt.slice(9)
      if (infoHash.length < 32) infoHash = undefined
    }
    return { url: input.trim(), infoHash }
  } catch {
    return null
  }
}

// --- Public API ---

export function detectUrlType(input: string): DetectedUrlType {
  if (!input || !input.trim()) {
    return { type: 'unknown', url: input ?? '' }
  }

  const trimmed = input.trim()

  // Check magnet first (non-HTTP protocol)
  const magnet = parseMagnetUrl(trimmed)
  if (magnet) {
    return { type: 'magnet', ...magnet }
  }

  // Check YouTube
  try {
    const parsed = parseYoutubeUrl(trimmed)
    if (parsed.supported) {
      const kind = parsed.kind
      return { type: 'youtube', url: parsed.url, kind }
    }
  } catch {
    // Not a YouTube URL, continue
  }

  // Every other valid HTTP/HTTPS URL is a potential direct file.
  // A HEAD request (performed by the dialog after classification)
  // will confirm whether it's downloadable via Content-Type / Content-Disposition.
  try {
    const url = new URL(trimmed)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const ext = (url.pathname.match(/\.([a-zA-Z0-9]+)$/) || [])[1] || ''
      return { type: 'direct-file', url: trimmed, extension: ext }
    }
  } catch {
    // Not a valid URL – fall through to unknown
  }

  return { type: 'unknown', url: trimmed }
}
