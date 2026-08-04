import { File, Download, HardDrive, Link2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { AppSettings } from '../../../../shared/types/settings'
import type { FileInfo } from '../../../../shared/types/file'

import { useQueueStore } from '../../store/queueStore'
import QueueItemCard from './QueueItemCard'
import { useVideoStore } from '../../store/videoStore'
interface Props {
  file: FileInfo
}

function formatBytes(bytes: number) {
  if (!bytes) return 'Unknown Size'

  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))

  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
}

export default function FileCard({ file }: Props) {
  const queue = useQueueStore((s) => s.queue)
  const add = useQueueStore((s) => s.add)
  const removeFile = useVideoStore((s) => s.removeFile)
  const item = queue.find((q) => q.url === file.url)

  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    window.api.settings.get().then(setSettings)
  }, [])

  async function handleDownload() {
    setLoading(true)

    try {
      const id = Date.now().toString()

      add({
        id,
        type: 'file',
        title: file.filename,
        url: file.url,
        folder: settings?.downloadFolder ?? '',
        formatId: 'file',
        format: 'mp4',
        filename: file.filename,
        progress: 0,
        speed: '-',
        eta: '-',
        status: 'waiting'
      })

      await window.api.download.start({
        id,
        url: file.url,
        folder: settings?.downloadFolder ?? '',
        formatId: 'file',
        format: 'mp4',
        type: 'file',
        filename: file.filename,
        title: file.filename
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        border: '1px solid #1E293B',
        background: '#111827',
        borderRadius: 24,
        padding: 24,
        display: 'flex',
        gap: 24,
        alignItems: 'stretch'
      }}
    >
      {!item && (
        <button
          onClick={() => removeFile(file.url)}
          title="Remove from list"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '1px solid #334155',
            background: '#0F172A',
            color: '#94A3B8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all .2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,.12)'
            e.currentTarget.style.borderColor = '#EF4444'
            e.currentTarget.style.color = '#EF4444'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#0F172A'
            e.currentTarget.style.borderColor = '#334155'
            e.currentTarget.style.color = '#94A3B8'
          }}
        >
          <X size={18} />
        </button>
      )}
      <div
        style={{
          width: 240,
          minWidth: 240,
          aspectRatio: '16 / 9',
          background: '#09090B',
          borderRadius: 18,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <File size={72} color="#475569" />

        <div
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            background: 'rgba(0,0,0,.75)',
            padding: '6px 10px',
            borderRadius: 8,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase'
          }}
        >
          {file.extension || 'FILE'}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1.3,
            wordBreak: 'break-word'
          }}
        >
          {file.filename}
        </h2>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 20,
            marginTop: 16,
            color: '#94A3B8',
            fontSize: 14
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
              flex: 1
            }}
          >
            <Link2 size={16} />

            <span
              style={{
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis'
              }}
            >
              {file.url}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <HardDrive size={16} />
            {formatBytes(file.size)}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <File size={16} />
            Direct File
          </div>
        </div>
        <div
          style={{
            marginTop: 24,
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'flex-end'
          }}
        >
          {item ? (
            <QueueItemCard item={item} />
          ) : (
            <button
              onClick={handleDownload}
              disabled={loading || !settings?.downloadFolder}
              style={{
                height: 50,
                width: '100%',
                border: 'none',
                borderRadius: 14,
                background:
                  loading || !settings?.downloadFolder
                    ? '#334155'
                    : 'linear-gradient(90deg,#7C3AED,#2563EB)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: loading || !settings?.downloadFolder ? 'not-allowed' : 'pointer',
                opacity: loading || !settings?.downloadFolder ? 0.6 : 1,
                transition: 'all .25s ease',
                boxShadow: '0 12px 30px rgba(124,58,237,.25)'
              }}
              onMouseEnter={(e) => {
                if (loading || !settings?.downloadFolder) return

                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 18px 35px rgba(124,58,237,.45)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)'
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(124,58,237,.25)'
              }}
            >
              <Download size={20} />

              {loading ? 'Starting Download...' : 'Download File'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
