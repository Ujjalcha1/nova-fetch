const PLAYLIST_PREFIXES = ['PL', 'UU', 'OLAK', 'FL', 'WL', 'LL']

export function normalizeYoutubeUrl(input: string): string {
  try {
    const url = new URL(input)

    // Remove tracking parameters
    const removeParams = [
      'feature',
      'si',
      'pp',
      'app',
      'index',
      'shuffle',
      'playnext_from',
      'videos',
      'ab_channel',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'start_radio',
      'time_continue',
      't'
    ]

    removeParams.forEach((param) => {
      url.searchParams.delete(param)
    })

    // Remove timestamp hash (#t=...)
    url.hash = ''

    // Radio Mix → Single Video
    const list = url.searchParams.get('list')

    if (list && (list.startsWith('RD') || list.startsWith('RDMM'))) {
      url.searchParams.delete('list')
    }

    // Keep only real playlist ids
    if (list) {
      const isRealPlaylist = PLAYLIST_PREFIXES.some((prefix) => list.startsWith(prefix))

      if (!isRealPlaylist) {
        url.searchParams.delete('list')
      }
    }

    return url.toString()
  } catch {
    return input
  }
}
