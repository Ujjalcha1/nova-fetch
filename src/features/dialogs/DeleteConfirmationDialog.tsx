import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, FileX2, X } from 'lucide-react'

export type DeleteAction = 'cancel' | 'delete' | 'delete-with-file'

type Props = {
  onClose: (action: DeleteAction) => void
  title?: string
  count?: number
}

export default function DeleteConfirmationDialog({ onClose, title, count }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Focus the Cancel button on mount
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  // ESC to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose('cancel')
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={() => onClose('cancel')}
    >
      {/* Backdrop blur layer */}
      <div className="absolute inset-0 backdrop-blur-sm" />

      {/* Dialog card */}
      <div
        className="relative z-10 flex flex-col"
        style={{
          width: '480px',
          maxWidth: '90vw',
          borderRadius: '16px',
          padding: '24px',
          backgroundColor: '#111827',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15">
              <Trash2 size={20} className="text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-white">{count && count > 1 ? `Delete ${count} Downloads` : 'Delete Download'}</h2>
          </div>
          <button
            onClick={() => onClose('cancel')}
            className="rounded-lg p-1.5 text-gray-500 transition hover:bg-white/10 hover:text-gray-300"
          >
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <p className="mt-4 text-sm leading-relaxed text-gray-400">
          {count && count > 1
            ? `Delete ${count} selected downloads?`
            : title
              ? <>
                  Choose how you want to remove{' '}
                  <span className="font-medium text-gray-200">{title}</span>{' '}
                  from NovaFetch.
                </>
              : 'Choose how you want to remove this download from NovaFetch.'
          }
        </p>

        {/* Divider */}
        <div className="my-4 h-px bg-white/10" />

        {/* Buttons — stacked vertically with 16px gap, 48px height each */}
        <div className="flex flex-col gap-4">
          {/* Cancel — secondary */}
          <button
            ref={cancelRef}
            onClick={() => onClose('cancel')}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-[#1A2232] px-5 text-sm font-medium text-gray-200 transition hover:bg-white/5"
          >
            Cancel
          </button>

          {/* Delete — orange */}
          <button
            onClick={() => onClose('delete')}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-medium text-white transition hover:bg-orange-500"
          >
            <Trash2 size={16} />
            Delete
          </button>

          {/* Delete with File — red */}
          <button
            onClick={() => onClose('delete-with-file')}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-medium text-white transition hover:bg-red-500"
          >
            <FileX2 size={16} />
            Delete with File
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
