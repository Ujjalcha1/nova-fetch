import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'

import UrlInput from './UrlInput'
import MetadataPreview from './MetadataPreview'
import FormatSelector from './FormatSelector'
import FolderPicker from './FolderPicker'
import DownloadButton from './DownloadButton'
import PlaylistView from './PlaylistView'
import DirectFilePreview from './DirectFilePreview'
import MagnetPreview from './MagnetPreview'

import { electron } from '../../lib/electron'
import { detectUrlType } from '../../lib/url-parser'
import { selectBestFormat } from '../../lib/format-selector'
import { formatErrorMessage } from '../../lib/format'
import { DownloadMetadata } from '../../types/download-metadata'
import type { PlaylistMetadata } from '../../types/download-metadata'
import { useDialogStore } from '../../store/dialog-store'

type Props = {
  onClose?: () => void
}

const isDev = window.location.protocol === 'http:'

export default function NewDownloadDialog({ onClose }: Props) {
  const [url, setUrl] = useState('')
  const [selectedFormatId, setSelectedFormatId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchingRef = useRef(false)

  const [videoMetadata, setVideoMetadata] = useState<DownloadMetadata | null>(null)
  const [playlistData, setPlaylistData] = useState<PlaylistMetadata | null>(null)
  const [directFileInfo, setDirectFileInfo] = useState<{
    filename: string
    contentLength: number
    contentType: string
  } | null>(null)

  const [magnetInfo, setMagnetInfo] = useState<{
    name: string
    infoHash: string
    fileCount: number
    totalSize: number
    trackers: string[]
  } | null>(null)

  const [folder, setFolder] = useState('')

  const headerInfo = useMemo(() => {
    if (directFileInfo) {
      return { icon: '📄', title: 'File Download' }
    }
    if (magnetInfo) {
      return { icon: '🧲', title: 'Torrent Download' }
    }
    if (videoMetadata || playlistData) {
      return { icon: '🎥', title: 'Video Download' }
    }
    return { icon: null, title: 'New Download' }
  }, [directFileInfo, magnetInfo, videoMetadata, playlistData])

  useEffect(() => {
    if (!videoMetadata) return

    setSelectedFormatId(selectBestFormat(videoMetadata.formats))
  }, [videoMetadata])

  // ── Mount: initial URL + clipboard auto-paste ──────────────────────────────
  useEffect(() => {
    async function init() {
      const initial = useDialogStore.getState().initialUrl
      if (typeof initial === 'string' && initial) {
        setUrl(initial)
        useDialogStore.setState({ initialUrl: '' })
      } else {
        // Read clipboard on mount; skip if initialUrl was already set
        try {
          const text = await navigator.clipboard.readText()
          if (text) {
            const detected = detectUrlType(text)
            if (detected.type !== 'unknown') {
              setUrl(text)
              fetchMetadata(text)
            }
          }
        } catch {
          // Clipboard access denied or empty — noop
        }
      }
      electron.getDefaultDownloadsPath().then(setFolder).catch(() => setFolder(''))
    }
    init()
  }, [])

  async function fetchMetadata(explicitUrl?: string) {
    if (fetchingRef.current) return
    fetchingRef.current = true

    const target = explicitUrl ?? url

    if (typeof target !== 'string') {
      fetchingRef.current = false
      setError('Invalid URL input')
      return
    }

    if (!target.trim()) {
      fetchingRef.current = false
      return
    }

    if (isDev) console.log('[NewDownloadDialog] Analyze clicked, URL:', target)

    setLoading(true)
    setError(null)
    setVideoMetadata(null)
    setPlaylistData(null)

    try {
      const detected = detectUrlType(target)

      if (detected.type === 'direct-file') {
        if (isDev) console.log('[Router] Direct file — performing HEAD request')

        const head = await electron.headRequest(detected.url)

        if (!head.filename) {
          setError('Could not determine file info from the URL.')
          return
        }

        setDirectFileInfo({
          filename: head.filename,
          contentLength: head.contentLength,
          contentType: head.contentType,
        })
        return
      }

      if (detected.type === 'magnet') {
        if (isDev) console.log('[Router] Magnet — fetching torrent metadata')

        const magnetMeta = await electron.magnetMetadata(detected.url)

        setMagnetInfo({
          name: magnetMeta.name,
          infoHash: magnetMeta.infoHash,
          fileCount: magnetMeta.fileCount,
          totalSize: magnetMeta.totalSize,
          trackers: magnetMeta.trackers,
        })
        return
      }

      if (detected.type === 'unknown') {
        setError('Unsupported URL.')
        return
      }

      // YouTube URL – detected.url is already the canonical URL
      if (isDev) console.log('[Detect] kind:', detected.kind)

      if (detected.kind === 'playlist') {
        if (isDev) console.log('[Router] PlaylistMetadataService')
        const result = await electron.getPlaylistMetadata(detected.url)
        if (isDev) console.log('[Router] Playlist fetched:', result.title, `(${result.availableCount} available)`)
        setPlaylistData(result)
      } else {
        if (isDev) console.log('[Router] MetadataService')
        const result = await electron.getMetadata(detected.url)
        if (isDev) console.log('[Router] Metadata fetched:', result.title)
        setVideoMetadata(result)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch metadata'
      if (isDev) console.error('[NewDownloadDialog] Fetch failed:', err)
      setError(message)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }

  function reset() {
    setUrl('')
    setVideoMetadata(null)
    setPlaylistData(null)
    setDirectFileInfo(null)
    setMagnetInfo(null)
    setSelectedFormatId('')
    setLoading(false)
    setError(null)
    setFolder('')
  }

  function handleClose() {
    reset()
    onClose?.()
  }

  return (
    <div className="flex h-[90vh] w-[960px] max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-[#111827] shadow-2xl">
      {/* Fixed top section */}
      <div className="shrink-0">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            {headerInfo.icon && (
              <span className="text-2xl" aria-hidden="true">
                {headerInfo.icon}
              </span>
            )}
            <h2 className="text-xl font-bold">{headerInfo.title}</h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-white/10 px-6 py-4">
          <UrlInput url={url} setUrl={setUrl} onFetch={fetchMetadata} loading={loading} />
        </div>

        {error && (
          <div className="px-6 pb-4 pt-2">
            <div className="rounded-xl bg-red-900/20 p-3 text-sm text-red-400">{formatErrorMessage(error)}</div>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {directFileInfo ? (
          <DirectFilePreview
            url={url}
            info={directFileInfo}
            folder={folder}
            setFolder={setFolder}
            onClose={handleClose}
            onError={setError}
          />
        ) : magnetInfo ? (
          <MagnetPreview
            url={url}
            info={magnetInfo}
            folder={folder}
            setFolder={setFolder}
            onClose={handleClose}
            onError={setError}
          />
        ) : playlistData ? (
          <PlaylistView metadata={playlistData} folder={folder} onClose={handleClose} />
        ) : videoMetadata ? (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
            <MetadataPreview metadata={videoMetadata} />

            <FormatSelector
              metadata={videoMetadata}
              selectedFormatId={selectedFormatId}
              onChange={setSelectedFormatId}
            />

            <FolderPicker folder={folder} setFolder={setFolder} />

            <DownloadButton
              metadata={videoMetadata}
              folder={folder}
              selectedFormatId={selectedFormatId}
              onDownloadStarted={handleClose}
              onError={setError}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
