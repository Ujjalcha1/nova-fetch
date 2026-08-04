import { analyzeYoutube } from './youtube'
import { analyzeFile } from './file-downloader'
import { normalizeYoutubeUrl } from '../utils/normalizeYoutubeUrl'
import { isYoutubeUrl } from '../utils/youtube'

import type { AnalyzeResponse } from '../../shared/types'

export async function analyze(url: string): Promise<AnalyzeResponse> {
  url = normalizeYoutubeUrl(url)
  try {
    // YouTube (Video / Shorts / Playlist)
    if (isYoutubeUrl(url)) {
      const result = await analyzeYoutube(url)

      if (!result.success) {
        return {
          success: false,
          error: result.message
        }
      }

      return {
        success: true,
        type: 'youtube',
        data: result.data
      }
    }

    // Direct File
    const file = await analyzeFile(url)

    return {
      success: true,
      type: 'file',
      data: file
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Analyze failed'
    }
  }
}
