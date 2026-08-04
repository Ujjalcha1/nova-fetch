// @ts-nocheck
import { useDownloadStore } from '../store/downloadStore'

export function registerDownloadEvents() {
  const offProgress = window.api.onDownloadProgress((progress) => {
    useDownloadStore.getState().setProgress({
      ...progress,
      status: 'downloading'
    })
  })

  const offCompleted = window.api.onDownloadCompleted(async (result) => {
    useDownloadStore.getState().setProgress({
      percent: result.success ? 100 : 0,
      speed: '',
      eta: '',
      status: result.success ? 'completed' : 'error'
    })

    await window.api.system.notify({
      title: result.success ? 'Download Complete' : 'Download Failed',
      body: result.success
        ? 'Your video has been downloaded successfully.'
        : 'The download could not be completed.'
    })
  })

  return () => {
    offProgress()
    offCompleted()
  }
}
