import type { DownloadMetadata } from '../../types/download-metadata'

type Props = {
  metadata: DownloadMetadata
}

export default function MetadataPreview({ metadata }: Props) {
  return (
    <div className="flex gap-5 rounded-xl bg-[#1A2232] p-4">
      <img src={metadata.thumbnail} className="h-32 w-56 rounded-lg object-cover" />

      <div className="flex flex-1 flex-col">
        <h2 className="text-xl font-semibold">{metadata.title}</h2>

        <p className="mt-2 text-gray-400">{metadata.uploader}</p>

        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <span>
            Duration
            <b className="ml-2">{metadata.duration}s</b>
          </span>

          <span>
            Playlist
            <b className="ml-2">{metadata.isPlaylist ? `Yes (${metadata.playlistCount})` : 'No'}</b>
          </span>
        </div>
      </div>
    </div>
  )
}
