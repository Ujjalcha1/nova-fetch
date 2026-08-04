import { formatSpeed } from '../../../lib/format'
import type { DownloadItem } from '../../../types/download'

type Props = {
  download: DownloadItem
}

export default function ConnectionsTab({ download }: Props) {
  if ((download.connections?.length ?? 0) === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        No connection details available.
      </div>
    )
  }

  return (
    <table className="w-full text-left">
      <thead>
        <tr className="text-gray-400">
          <th>Host</th>

          <th>Speed</th>

          <th>Status</th>
        </tr>
      </thead>

      <tbody>
        {download.connections?.map((connection) => (
          <tr key={connection.id} className="border-t border-white/10">
            <td className="py-3">{connection.host}</td>

            <td>{formatSpeed(connection.speed)}</td>

            <td className="text-green-400">{connection.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
