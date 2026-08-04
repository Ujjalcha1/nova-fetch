import { formatBytes } from '../../lib/format'
import type { DownloadMetadata } from '../../types/download-metadata'

type Props = {
  metadata: DownloadMetadata

  selectedFormatId: string

  onChange: (formatId: string) => void
}

export default function FormatSelector({ metadata, selectedFormatId, onChange }: Props) {
  return (
    <div>
      <label className="mb-3 block text-sm font-medium">Format</label>

      <select
        value={selectedFormatId}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl bg-[#1A2232] p-3"
      >
        {metadata.formats.map((format) => (
          <option key={format.id} value={format.id}>
            {format.resolution || 'Unknown'}

            {' • '}

            {format.ext}

            {format.filesize ? ` • ${formatBytes(format.filesize)}` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
