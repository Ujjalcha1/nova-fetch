import fs from 'node:fs'

export function getDiskFreeSpace(dirPath: string): { free: number; total: number } {
  try {
    const stats = fs.statfsSync(dirPath)
    return {
      free: stats.bfree * stats.bsize,
      total: stats.blocks * stats.bsize
    }
  } catch {
    return { free: 0, total: 0 }
  }
}
