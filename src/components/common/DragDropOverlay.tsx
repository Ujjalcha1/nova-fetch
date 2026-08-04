import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { useDialogStore } from '../../store/dialog-store'
import { useToastStore } from '../../store/toast-store'

export default function DragDropOverlay() {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    let dragCounter = 0

    function onDragEnter(e: DragEvent) {
      e.preventDefault()
      dragCounter++
      if (dragCounter === 1) setDragging(true)
    }

    function onDragOver(e: DragEvent) {
      e.preventDefault()
    }

    function onDragLeave(e: DragEvent) {
      e.preventDefault()
      dragCounter--
      if (dragCounter === 0) setDragging(false)
    }

    function onDrop(e: DragEvent) {
      e.preventDefault()
      dragCounter = 0
      setDragging(false)

      const text = e.dataTransfer?.getData('text')
      const files = e.dataTransfer?.files

      if (text) {
        useDialogStore.getState().openNewDownload(text.trim())
        return
      }

      if (files && files.length > 0) {
        const file = files[0]
        const isTorrent = file.name.endsWith('.torrent')
        const isVideo = /\.(mp4|mkv|webm|avi|mov|flv|wmv)$/i.test(file.name)

        if (isTorrent || isVideo) {
          useToastStore.getState().addToast({
            message: `${isTorrent ? 'Torrent' : 'Video'} files are not supported yet`,
            type: 'info'
          })
        } else {
          useToastStore.getState().addToast({
            message: 'Unsupported file type',
            type: 'error'
          })
        }
        return
      }
    }

    document.addEventListener('dragenter', onDragEnter)
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop', onDrop)

    return () => {
      document.removeEventListener('dragenter', onDragEnter)
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop', onDrop)
    }
  }, [])

  if (!dragging) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0E131C]/80">
      <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-violet-500/50 bg-[#1A2232]/90 px-12 py-10">
        <div className="rounded-full bg-violet-500/20 p-4">
          <Upload size={36} className="text-violet-400" />
        </div>
        <p className="text-lg font-semibold">Drop to add download</p>
        <p className="text-sm text-gray-400">URLs, magnet links, or files</p>
      </div>
    </div>
  )
}
