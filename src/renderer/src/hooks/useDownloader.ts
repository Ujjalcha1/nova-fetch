import { useEffect } from 'react'

import { usePlaylistDownloadStore } from '../store/playlistDownloadStore'
import { useQueueStore } from '../store/queueStore'

function syncPlaylistFromQueue(playlistId: string) {
  const queueStore = useQueueStore.getState()
  const playlistStore = usePlaylistDownloadStore.getState()
  const summary = queueStore.getPlaylistSummary(playlistId)

  if (!playlistStore.downloads[playlistId] && summary.total === 0) {
    return
  }

  playlistStore.syncFromQueue(summary)
}

export default function useDownloader() {
  const update = useQueueStore((state) => state.update)

  useEffect(() => {
    const downloadApi = window.api.download

    const syncByDownloadId = (id: string) => {
      const item = useQueueStore.getState().queue.find((queueItem) => queueItem.id === id)
      if (item?.playlistId) {
        syncPlaylistFromQueue(item.playlistId)
      }
    }

    const offProgress = downloadApi.onProgress((data) => {
      update(data.id, {
        progress: data.progress,
        speed: data.speed,
        eta: data.eta,
        status: 'downloading'
      })

      syncByDownloadId(data.id)
      window.api.setTaskbarProgress(data.progress / 100)
    })

    const offCompleted = downloadApi.onCompleted((data) => {
      update(data.id, {
        progress: 100,
        speed: '-',
        eta: '-',
        status: 'completed',
        filePath: data.filePath
      })

      syncByDownloadId(data.id)
      window.api.setTaskbarProgress(-1)
    })

    const offPaused = downloadApi.onPaused((data) => {
      update(data.id, {
        status: 'paused',
        speed: '-',
        eta: '-'
      })

      syncByDownloadId(data.id)
    })

    const offCancelled = downloadApi.onCancelled((data) => {
      update(data.id, {
        status: 'cancelled',
        speed: '-',
        eta: '-'
      })

      syncByDownloadId(data.id)
      window.api.setTaskbarProgress(-1)
    })

    const offError = downloadApi.onError((data) => {
      update(data.id, {
        status: 'error'
      })

      syncByDownloadId(data.id)
      window.api.setTaskbarProgress(-1)
    })

    const offPlaylistProgress = downloadApi.onPlaylistProgress((data) => {
      syncPlaylistFromQueue(data.playlistId)
    })

    const offPlaylistCompleted = downloadApi.onPlaylistCompleted((data) => {
      syncPlaylistFromQueue(data.playlistId)
    })

    const playlistIds = Array.from(
      new Set(
        useQueueStore
          .getState()
          .queue.map((item) => item.playlistId)
          .filter(Boolean)
      )
    ) as string[]
    playlistIds.forEach((playlistId) => syncPlaylistFromQueue(playlistId))

    return () => {
      offProgress?.()
      offCompleted?.()
      offPaused?.()
      offCancelled?.()
      offError?.()

      offPlaylistProgress?.()
      offPlaylistCompleted?.()
    }
  }, [update])
}
