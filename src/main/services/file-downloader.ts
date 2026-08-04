import { request } from 'undici'
import type { FileInfo } from '../../shared/types'
import { getExtension, getFilename } from '../utils/file'

export async function analyzeFile(url: string): Promise<FileInfo> {
  const { headers } = await request(url, {
    method: 'HEAD'
  })

  const filename =
    headers['content-disposition']?.toString()?.match(/filename="?(.+?)"?$/)?.[1] ||
    getFilename(url)

  const size = Number(headers['content-length'] ?? 0)

  const mimeType = String(headers['content-type'] ?? 'application/octet-stream')

  const resumable = String(headers['accept-ranges'] ?? '').toLowerCase() === 'bytes'

  return {
    url,
    filename,
    extension: getExtension(filename),
    mimeType,
    size,
    resumable
  }
}
