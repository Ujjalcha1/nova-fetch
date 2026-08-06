import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Star, X } from 'lucide-react'

type Props = {
  /** Dismisses the dialog (the "Later" button / X / Escape / backdrop click). */
  onClose: () => void
  /** Called with the chosen star rating (1-5) and trimmed comment when Submit is pressed. */
  onSubmit: (rating: number, comment: string) => void
  /** Optional heading shown at the top of the dialog. */
  title?: string
  /**
   * Error message to show when saving the rating failed. When set, the dialog
   * stays open so the user can retry; cleared once a save succeeds.
   */
  error?: string | null
  /** True while the rating is being uploaded; disables the Submit button. */
  submitting?: boolean
}

const RATING_LABELS: Record<number, string> = {
  1: 'Terrible',
  2: 'Poor',
  3: 'Okay',
  4: 'Good',
  5: 'Amazing'
}

const COMMENT_MAX = 500

/**
 * RatingDialog — asks the user to rate their experience.
 *
 * Presentational only: it collects a 1-5 star rating and optional feedback, then
 * hands them to `onSubmit`. Nothing is persisted or uploaded here.
 *
 * Interactions:
 *   - Hovering stars previews the rating; clicking selects it.
 *   - Submit stays disabled until at least one star is picked.
 *   - Escape, the X, "Later", and a backdrop click all dismiss via onClose.
 */
export default function RatingDialog({
  onClose,
  onSubmit,
  title = 'Enjoying NovaFetch?',
  error = null,
  submitting = false
}: Props): React.JSX.Element {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')

  const firstStarRef = useRef<HTMLButtonElement>(null)

  const active = hover || rating
  const canSubmit = rating >= 1

  // Focus the first star so keyboard users can rate immediately.
  useEffect(() => {
    firstStarRef.current?.focus()
  }, [])

  // Escape dismisses.
  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleSubmit(): void {
    if (!canSubmit) return
    onSubmit(rating, comment.trim())
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      {/* Backdrop blur layer */}
      <div className="absolute inset-0 backdrop-blur-sm" />

      {/* Dialog card */}
      <div
        className="relative z-10 flex flex-col"
        style={{
          width: '440px',
          maxWidth: '90vw',
          borderRadius: '16px',
          padding: '24px',
          backgroundColor: '#111827',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/15">
              <Star size={20} className="fill-amber-400 text-amber-400" />
            </div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 transition hover:bg-white/10 hover:text-gray-300"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Prompt */}
        <p className="mt-4 text-sm leading-relaxed text-gray-400">
          You just finished your first download. How would you rate your experience?
        </p>

        {/* Stars */}
        <div className="mt-6 flex flex-col items-center">
          <div className="flex items-center gap-2" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((value) => {
              const filled = value <= active
              return (
                <button
                  key={value}
                  ref={value === 1 ? firstStarRef : undefined}
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHover(value)}
                  aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`}
                  aria-pressed={rating === value}
                  type="button"
                  className={`rounded-lg p-1 outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                    filled
                      ? 'scale-110 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.45)]'
                      : 'text-gray-600 hover:scale-110 hover:text-amber-300/80'
                  }`}
                >
                  <Star size={36} className={filled ? 'fill-amber-400' : ''} />
                </button>
              )
            })}
          </div>

          {/* Label for the hovered/selected rating */}
          <div className="mt-3 h-5 text-sm font-medium text-amber-300/90">
            {active > 0 ? RATING_LABELS[active] : 'Tap a star to rate'}
          </div>
        </div>

        {/* Optional feedback */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <label htmlFor="rating-feedback" className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Feedback (optional)
            </label>
            <span className="text-xs tabular-nums text-gray-600">
              {comment.length}/{COMMENT_MAX}
            </span>
          </div>
          <textarea
            id="rating-feedback"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
            placeholder="Tell us what you think…"
            rows={3}
            className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#1A2232] px-3.5 py-2.5 text-sm text-gray-200 placeholder:text-gray-500 transition focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
          >
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </p>
        )}

        {/* Divider */}
        <div className="my-5 h-px bg-white/10" />

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-[#1A2232] px-5 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-white/5"
          >
            Later
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
