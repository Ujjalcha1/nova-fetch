import { app } from 'electron'
import path from 'node:path'

function getResourcesDir() {
  if (app.isPackaged) {
    // extraResources -> to: "resources"
    return path.join(process.resourcesPath, 'resources')
  }

  return path.join(process.cwd(), 'resources')
}

export function getYtDlpPath() {
  return path.join(getResourcesDir(), 'yt-dlp.exe')
}

export function getFfmpegPath() {
  return path.join(getResourcesDir(), 'ffmpeg.exe')
}

export function getFfprobePath() {
  return path.join(getResourcesDir(), 'ffprobe.exe')
}
