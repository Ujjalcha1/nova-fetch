import { Play, Pause, FolderOpen, MoreVertical } from 'lucide-react'

export default function DownloadActions() {
  return (
    <div className="flex gap-2">
      <button className="rounded-lg bg-[#1A2232] p-2 hover:bg-violet-600">
        <Play size={16} />
      </button>

      <button className="rounded-lg bg-[#1A2232] p-2 hover:bg-violet-600">
        <Pause size={16} />
      </button>

      <button className="rounded-lg bg-[#1A2232] p-2 hover:bg-violet-600">
        <FolderOpen size={16} />
      </button>

      <button className="rounded-lg bg-[#1A2232] p-2 hover:bg-violet-600">
        <MoreVertical size={16} />
      </button>
    </div>
  )
}
