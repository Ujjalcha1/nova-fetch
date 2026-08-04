import { describe, it, expect } from 'vitest'
import { parseYoutubeUrl, detectUrlType } from '../url-parser'

const ID = 'dQw4w9WgXcQ'
const PLAYLIST_ID = 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf'
const SHORT_ID = 'abc123_def'

function assertVideo(result: ReturnType<typeof parseYoutubeUrl>) {
  expect(result.supported).toBe(true)
  return result as Extract<typeof result, { supported: true }>
}

// --- Valid URLs ---

describe('youtube.com/watch', () => {
  it('extracts video ID from basic watch URL', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtube.com/watch?v=${ID}`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(result.playlistId).toBeUndefined()
  })

  it('strips list parameter from watch URL', () => {
    const result = assertVideo(parseYoutubeUrl(
      `https://www.youtube.com/watch?v=${ID}&list=${PLAYLIST_ID}`
    ))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(result.playlistId).toBe(PLAYLIST_ID)
  })

  it('strips index parameter', () => {
    const result = assertVideo(parseYoutubeUrl(
      `https://www.youtube.com/watch?v=${ID}&list=${PLAYLIST_ID}&index=2`
    ))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(result.playlistId).toBe(PLAYLIST_ID)
  })

  it('strips timestamp parameter', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtube.com/watch?v=${ID}&t=120`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('strips feature parameter', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtube.com/watch?v=${ID}&feature=share`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('strips si tracking parameter', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtube.com/watch?v=${ID}&si=abc123def456`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('strips app parameter', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtube.com/watch?v=${ID}&app=desktop`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('strips start_radio parameter', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtube.com/watch?v=${ID}&start_radio=1`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('strips pp parameter', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtube.com/watch?v=${ID}&pp=8AUB`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('strips rel parameter', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtube.com/watch?v=${ID}&rel=0`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('strips shuffle parameter', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtube.com/watch?v=${ID}&shuffle=1`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('strips playnext parameter', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtube.com/watch?v=${ID}&playnext=1`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('strips multiple tracking parameters', () => {
    const result = assertVideo(parseYoutubeUrl(
      `https://www.youtube.com/watch?v=${ID}&feature=share&si=abc&t=30&rel=0&app=desktop&start_radio=1&pp=8AUB`
    ))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('strips list with extra params together', () => {
    const result = assertVideo(parseYoutubeUrl(
      `https://www.youtube.com/watch?v=${ID}&list=${PLAYLIST_ID}&feature=share&t=30`
    ))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(result.playlistId).toBe(PLAYLIST_ID)
  })

  it('handles the exact failing URL from the bug report', () => {
    const result = assertVideo(parseYoutubeUrl(
      `https://www.youtube.com/watch?v=b68HETiNO98&list=RDP7yRYiBiV3g&index=2`
    ))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=b68HETiNO98`)
    expect(result.playlistId).toBe('RDP7yRYiBiV3g')
  })

  it('uses no www subdomain', () => {
    const result = assertVideo(parseYoutubeUrl(`https://youtube.com/watch?v=${ID}`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })
})

describe('m.youtube.com', () => {
  it('normalizes mobile URL', () => {
    const result = assertVideo(parseYoutubeUrl(`https://m.youtube.com/watch?v=${ID}`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('strips params from mobile URL', () => {
    const result = assertVideo(parseYoutubeUrl(`https://m.youtube.com/watch?v=${ID}&feature=share&t=30`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })
})

describe('youtu.be', () => {
  it('extracts video ID from short URL', () => {
    const result = assertVideo(parseYoutubeUrl(`https://youtu.be/${ID}`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(result.playlistId).toBeUndefined()
  })

  it('strips timestamp from short URL', () => {
    const result = assertVideo(parseYoutubeUrl(`https://youtu.be/${ID}?t=10`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('extracts playlist ID from short URL', () => {
    const result = assertVideo(parseYoutubeUrl(`https://youtu.be/${ID}?list=${PLAYLIST_ID}`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(result.playlistId).toBe(PLAYLIST_ID)
  })

  it('handles www.youtu.be', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtu.be/${ID}`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('handles short URL with trailing slash', () => {
    const result = assertVideo(parseYoutubeUrl(`https://youtu.be/${ID}/`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })
})

describe('youtube.com/shorts', () => {
  it('extracts video ID from shorts URL', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtube.com/shorts/${ID}`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('strips tracking params from shorts URL', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtube.com/shorts/${ID}?si=abc123&t=30`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('extracts playlist from shorts URL', () => {
    const result = assertVideo(parseYoutubeUrl(
      `https://www.youtube.com/shorts/${ID}?list=${PLAYLIST_ID}`
    ))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(result.playlistId).toBe(PLAYLIST_ID)
  })

  it('handles short video IDs in shorts path', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtube.com/shorts/${SHORT_ID}`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${SHORT_ID}`)
  })
})

describe('youtube.com/live', () => {
  it('extracts video ID from live URL', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtube.com/live/${ID}`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('extracts playlist from live URL', () => {
    const result = assertVideo(parseYoutubeUrl(
      `https://www.youtube.com/live/${ID}?list=${PLAYLIST_ID}`
    ))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(result.playlistId).toBe(PLAYLIST_ID)
  })
})

describe('youtube.com/embed', () => {
  it('extracts video ID from embed URL', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtube.com/embed/${ID}`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })

  it('extracts playlist from embed URL', () => {
    const result = assertVideo(parseYoutubeUrl(
      `https://www.youtube.com/embed/${ID}?list=${PLAYLIST_ID}`
    ))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(result.playlistId).toBe(PLAYLIST_ID)
  })
})

describe('youtube.com/v/', () => {
  it('extracts video ID from /v/ URL', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtube.com/v/${ID}`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })
})

describe('youtube.com/e/', () => {
  it('extracts video ID from /e/ URL', () => {
    const result = assertVideo(parseYoutubeUrl(`https://www.youtube.com/e/${ID}`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })
})

describe('youtube-nocookie.com/embed', () => {
  it('extracts video ID from nocookie embed URL', () => {
    const result = assertVideo(parseYoutubeUrl(
      `https://www.youtube-nocookie.com/embed/${ID}`
    ))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })
})

describe('playlist URLs', () => {
  it('accepts pure playlist URL and returns kind playlist', () => {
    const result = assertVideo(parseYoutubeUrl(
      `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`
    ))
    expect(result.kind).toBe('playlist')
    expect(result.playlistId).toBe(PLAYLIST_ID)
    expect(result.url).toBe(`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`)
  })

  it('accepts playlist URL with extra params', () => {
    const result = assertVideo(parseYoutubeUrl(
      `https://www.youtube.com/playlist?list=${PLAYLIST_ID}&feature=share`
    ))
    expect(result.kind).toBe('playlist')
    expect(result.playlistId).toBe(PLAYLIST_ID)
  })

  it('watch+list video is still treated as single video', () => {
    const result = assertVideo(parseYoutubeUrl(
      `https://www.youtube.com/watch?v=${ID}&list=${PLAYLIST_ID}`
    ))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(result.playlistId).toBe(PLAYLIST_ID)
  })

  it('shorts+list video is still treated as single video', () => {
    const result = assertVideo(parseYoutubeUrl(
      `https://www.youtube.com/shorts/${ID}?list=${PLAYLIST_ID}`
    ))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(result.playlistId).toBe(PLAYLIST_ID)
  })

  it('live+list video is still treated as single video', () => {
    const result = assertVideo(parseYoutubeUrl(
      `https://www.youtube.com/live/${ID}?list=${PLAYLIST_ID}`
    ))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(result.playlistId).toBe(PLAYLIST_ID)
  })
})

describe('attribution_link URLs', () => {
  it('extracts video ID and playlist from attribution link', () => {
    const result = assertVideo(parseYoutubeUrl(
      `https://www.youtube.com/attribution_link?a=Jg&u=/watch%3Fv%3D${ID}%26list%3D${PLAYLIST_ID}`
    ))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(result.playlistId).toBe(PLAYLIST_ID)
  })
})

describe('oembed URLs', () => {
  it('extracts video ID from oembed URL', () => {
    const encodedUrl = encodeURIComponent(
      `https://www.youtube.com/watch?v=${ID}`
    )
    const result = assertVideo(parseYoutubeUrl(
      `https://www.youtube.com/oembed?url=${encodedUrl}`
    ))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })
})

describe('music.youtube.com', () => {
  it('normalizes music subdomain URL', () => {
    const result = assertVideo(parseYoutubeUrl(`https://music.youtube.com/watch?v=${ID}`))
    expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })
})

// --- Invalid URLs ---

describe('invalid URLs', () => {
  it('rejects empty string', () => {
    expect(() => parseYoutubeUrl('')).toThrow('URL is required')
  })

  it('rejects whitespace-only string', () => {
    expect(() => parseYoutubeUrl('   ')).toThrow('URL is required')
  })

  it('rejects non-URL text', () => {
    expect(() => parseYoutubeUrl('not-a-url')).toThrow('Invalid URL format')
  })

  it('rejects unsupported host', () => {
    expect(() =>
      parseYoutubeUrl('https://vimeo.com/watch?v=abc123')
    ).toThrow('Unsupported host')
  })

  it('rejects non-http protocol', () => {
    expect(() =>
      parseYoutubeUrl('ftp://youtube.com/watch?v=abc123')
    ).toThrow('URL must start with http:// or https://')
  })

  it('rejects watch URL missing video ID', () => {
    expect(() =>
      parseYoutubeUrl('https://www.youtube.com/watch')
    ).toThrow('Missing video ID')
  })

  it('rejects watch URL with empty v param', () => {
    expect(() =>
      parseYoutubeUrl('https://www.youtube.com/watch?v=')
    ).toThrow('Missing video ID')
  })

  it('rejects shorts URL without ID', () => {
    expect(() =>
      parseYoutubeUrl('https://www.youtube.com/shorts/')
    ).toThrow('Invalid shorts URL')
  })

  it('rejects live URL without ID', () => {
    expect(() =>
      parseYoutubeUrl('https://www.youtube.com/live/')
    ).toThrow('Invalid live URL')
  })

  it('rejects embed URL without ID', () => {
    expect(() =>
      parseYoutubeUrl('https://www.youtube.com/embed/')
    ).toThrow('Invalid YouTube URL')
  })

  it('rejects v/ URL without ID', () => {
    expect(() => parseYoutubeUrl('https://www.youtube.com/v/')).toThrow(
      'Invalid YouTube URL'
    )
  })

  it('rejects e/ URL without ID', () => {
    expect(() => parseYoutubeUrl('https://www.youtube.com/e/')).toThrow(
      'Invalid YouTube URL'
    )
  })

  it('rejects playlist URL without list ID', () => {
    expect(() =>
      parseYoutubeUrl('https://www.youtube.com/playlist')
    ).toThrow('Invalid playlist ID')
  })

  it('rejects playlist URL with empty list param', () => {
    expect(() =>
      parseYoutubeUrl('https://www.youtube.com/playlist?list=')
    ).toThrow('Invalid playlist ID')
  })

  it('rejects youtu.be without ID', () => {
    expect(() => parseYoutubeUrl('https://youtu.be/')).toThrow(
      'Invalid YouTube URL'
    )
  })

  it('rejects attribution link without u param', () => {
    expect(() =>
      parseYoutubeUrl('https://www.youtube.com/attribution_link?a=Jg')
    ).toThrow('Invalid YouTube URL')
  })

  it('rejects oembed without url param', () => {
    expect(() =>
      parseYoutubeUrl('https://www.youtube.com/oembed')
    ).toThrow('Invalid YouTube URL')
  })

  it('rejects unrecognized YouTube path', () => {
    expect(() =>
      parseYoutubeUrl('https://www.youtube.com/some/random/path')
    ).toThrow('Invalid YouTube URL')
  })

  it('rejects URL with very short video ID', () => {
    expect(() =>
      parseYoutubeUrl('https://www.youtube.com/watch?v=ab')
    ).toThrow('Invalid YouTube URL')
  })
})

// --- detectUrlType ---

describe('detectUrlType', () => {
  describe('youtube detection', () => {
    it('detects standard watch URL', () => {
      const result = detectUrlType(`https://www.youtube.com/watch?v=${ID}`)
      expect(result).toEqual({
        type: 'youtube',
        url: `https://www.youtube.com/watch?v=${ID}`,
        kind: 'video'
      })
    })

    it('detects shorts URL', () => {
      const result = detectUrlType(`https://www.youtube.com/shorts/${ID}`)
      expect(result.type).toBe('youtube')
      if (result.type === 'youtube') {
        expect(result.kind).toBe('video')
      }
    })

    it('detects youtu.be URL', () => {
      const result = detectUrlType(`https://youtu.be/${ID}`)
      expect(result.type).toBe('youtube')
    })

    it('detects playlist URL', () => {
      const result = detectUrlType(`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`)
      expect(result).toEqual({
        type: 'youtube',
        url: `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`,
        kind: 'playlist'
      })
    })

    it('detects live URL', () => {
      const result = detectUrlType(`https://www.youtube.com/live/${ID}`)
      expect(result.type).toBe('youtube')
      if (result.type === 'youtube') {
        expect(result.kind).toBe('video')
      }
    })

    it('detects embed URL', () => {
      const result = detectUrlType(`https://www.youtube.com/embed/${ID}`)
      expect(result.type).toBe('youtube')
    })

    it('detects mobile YouTube URL', () => {
      const result = detectUrlType(`https://m.youtube.com/watch?v=${ID}`)
      expect(result.type).toBe('youtube')
    })

    it('detects music.youtube.com URL', () => {
      const result = detectUrlType(`https://music.youtube.com/watch?v=${ID}`)
      expect(result.type).toBe('youtube')
    })
  })

  describe('direct-file detection', () => {
    it('detects .mp4 file URL', () => {
      const result = detectUrlType('https://example.com/video.mp4')
      expect(result).toEqual({
        type: 'direct-file',
        url: 'https://example.com/video.mp4',
        extension: 'mp4'
      })
    })

    it('detects .mkv file URL', () => {
      const result = detectUrlType('https://cdn.example.org/movie.mkv')
      expect(result.type).toBe('direct-file')
      if (result.type === 'direct-file') {
        expect(result.extension).toBe('mkv')
      }
    })

    it('detects .zip archive URL', () => {
      const result = detectUrlType('https://files.example.com/data.zip')
      expect(result).toEqual({
        type: 'direct-file',
        url: 'https://files.example.com/data.zip',
        extension: 'zip'
      })
    })

    it('detects .mp3 audio URL', () => {
      const result = detectUrlType('https://audio.example.com/song.mp3')
      expect(result.type).toBe('direct-file')
      if (result.type === 'direct-file') {
        expect(result.extension).toBe('mp3')
      }
    })

    it('detects .pdf document URL', () => {
      const result = detectUrlType('https://docs.example.com/report.pdf')
      expect(result.type).toBe('direct-file')
    })

    it('detects file URL with path segments', () => {
      const result = detectUrlType('https://example.com/videos/2024/tutorial.mp4')
      expect(result.type).toBe('direct-file')
      if (result.type === 'direct-file') {
        expect(result.extension).toBe('mp4')
      }
    })

    it('detects file URL with query parameters', () => {
      const result = detectUrlType('https://example.com/video.mp4?token=abc&expires=123')
      expect(result).toEqual({
        type: 'direct-file',
        url: 'https://example.com/video.mp4?token=abc&expires=123',
        extension: 'mp4'
      })
    })

    it('does not treat YouTube watch URL as direct file', () => {
      const result = detectUrlType(`https://www.youtube.com/watch?v=${ID}`)
      expect(result.type).toBe('youtube')
    })
  })

  describe('magnet detection', () => {
    const INFO_HASH = '1234567890abcdef1234567890abcdef12345678'

    it('detects basic magnet URL', () => {
      const result = detectUrlType(`magnet:?xt=urn:btih:${INFO_HASH}&dn=file&tr=udp://tracker.org`)
      expect(result.type).toBe('magnet')
      if (result.type === 'magnet') {
        expect(result.infoHash).toBe(INFO_HASH)
      }
    })

    it('detects magnet URL without info hash', () => {
      const result = detectUrlType('magnet:?dn=file&tr=udp://tracker.org')
      expect(result.type).toBe('magnet')
      if (result.type === 'magnet') {
        expect(result.infoHash).toBeUndefined()
      }
    })

    it('detects magnet URL with trailing spaces', () => {
      const result = detectUrlType(`  magnet:?xt=urn:btih:${INFO_HASH}  `)
      expect(result.type).toBe('magnet')
    })

    it('detects uppercase MAGNET prefix', () => {
      const result = detectUrlType(`MAGNET:?xt=urn:btih:${INFO_HASH}`)
      expect(result.type).toBe('magnet')
      if (result.type === 'magnet') {
        // Original case preserved in the url field
        expect(result.url).toBe(`MAGNET:?xt=urn:btih:${INFO_HASH}`)
      }
    })

    it('does not treat magnet as YouTube or file', () => {
      const result = detectUrlType(`magnet:?xt=urn:btih:${INFO_HASH}`)
      expect(result.type).toBe('magnet')
    })
  })

  describe('unknown detection', () => {
    it('returns unknown for empty string', () => {
      const result = detectUrlType('')
      expect(result).toEqual({ type: 'unknown', url: '' })
    })

    it('returns unknown for whitespace-only input', () => {
      const result = detectUrlType('   ')
      expect(result).toEqual({ type: 'unknown', url: '   ' })
    })

    it('returns unknown for a plain HTTP URL without file extension', () => {
      const result = detectUrlType('https://example.com/page')
      expect(result.type).toBe('unknown')
    })

    it('returns unknown for non-YouTube, non-file HTTP URL', () => {
      const result = detectUrlType('https://github.com/user/repo')
      expect(result.type).toBe('unknown')
    })

    it('returns unknown for non-URL text', () => {
      const result = detectUrlType('random text here')
      expect(result.type).toBe('unknown')
    })

    it('returns unknown for unsupported protocol', () => {
      const result = detectUrlType('ftp://files.example.com/file.mp4')
      expect(result.type).toBe('unknown')
    })
  })
})
