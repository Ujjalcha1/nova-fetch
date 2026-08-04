import { ImageOff } from 'lucide-react'
import { useThumbnail } from '../../../hooks/useThumbnail'

type Props = {
  /** Raw thumbnail URL from the download item. May be undefined. */
  thumbnail?: string
  /** Visual size variant. Defaults to 'row' (fits the download list row). */
  size?: 'row' | 'card'
}

const SIZE: Record<NonNullable<Props['size']>, string> = {
  row: 'h-[45px] w-[80px] rounded-md',
  card: 'h-24 w-40 rounded-xl'
}

/**
 * DownloadThumbnail
 *
 * Renders a thumbnail image with three lifecycle states:
 *   - No URL       → "File" placeholder
 *   - Loading      → animated skeleton shimmer
 *   - Loaded       → image fades in
 *   - Error        → ImageOff icon fallback
 *
 * Thumbnail loading is async, cached globally via ThumbnailService,
 * and lazy (only starts when this component mounts).
 */
export default function DownloadThumbnail({ thumbnail, size = 'row' }: Props) {
  const { status, src } = useThumbnail(thumbnail)
  const cls = SIZE[size]

  // No URL at all
  if (!thumbnail) {
    return (
      <div className={`${cls} flex items-center justify-center bg-[#1A2232] text-xs text-gray-500`}>
        File
      </div>
    )
  }

  // Skeleton while loading
  if (status === 'loading' || status === 'idle') {
    return (
      <div className={`${cls} relative overflow-hidden bg-[#1A2232]`}>
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>
    )
  }

  // Error fallback
  if (status === 'error') {
    return (
      <div className={`${cls} flex items-center justify-center bg-[#1A2232] text-gray-600`}>
        <ImageOff size={size === 'card' ? 20 : 14} />
      </div>
    )
  }

  // Loaded — fade in
  return (
    <img
      src={src!}
      className={`${cls} object-cover opacity-0 transition-opacity duration-300`}
      style={{ opacity: 1 }}
      draggable={false}
    />
  )
}
