const YOUTUBE_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'music.youtube.com'
]

export function isYoutubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)

    return YOUTUBE_HOSTS.includes(parsed.hostname)
  } catch {
    return false
  }
}

export function normalizeYoutubeUrl(url: string): string {
  try {
    const parsed = new URL(url)

    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.replace('/', '')

      return `https://www.youtube.com/watch?v=${id}`
    }

    return parsed.toString()
  } catch {
    return url
  }
}
