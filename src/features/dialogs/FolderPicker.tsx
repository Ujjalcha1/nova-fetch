import { Folder } from 'lucide-react'

import { electron } from '../../lib/electron'

type Props = {
  folder: string

  setFolder: (folder: string) => void
}

export default function FolderPicker({ folder, setFolder }: Props) {
  async function browse() {
    const result = await electron.selectFolder()

    if (result) {
      setFolder(result)
    }
  }

  return (
    <div>
      <label className="mb-3 block text-sm font-medium">Save Folder</label>

      <div className="flex gap-3">
        <input value={folder} readOnly className="flex-1 rounded-xl bg-[#1A2232] px-4 py-3" />

        <button onClick={browse} className="rounded-xl bg-violet-600 px-5">
          <Folder />
        </button>
      </div>
    </div>
  )
}
