import { useState } from 'react'
import { Info, TrendingUp, FileText, Wifi, ScrollText } from 'lucide-react'

import GeneralTab from './GeneralTab'
import ProgressTab from './ProgressTab'
import FilesTab from './FilesTab'
import ConnectionsTab from './ConnectionsTab'
import LogTab from './LogTab'
import { useDownloadStore } from '../../../store/download-store'

const TABS = [
  { id: 'General',     label: 'General',     icon: Info       },
  { id: 'Progress',    label: 'Progress',     icon: TrendingUp },
  { id: 'Files',       label: 'Files',        icon: FileText   },
  { id: 'Connections', label: 'Connections',  icon: Wifi       },
  { id: 'Logs',        label: 'Logs',         icon: ScrollText },
] as const

type TabId = (typeof TABS)[number]['id']

export default function DetailsPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('General')
  const activeId = useDownloadStore((s) => s.activeId)
  const download  = useDownloadStore((s) => s.downloads.find((x) => x.id === activeId))

  if (!download) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
            <Info size={18} className="text-gray-500" />
          </span>
          <p className="text-sm font-medium text-gray-400">No download selected</p>
          <p className="text-xs text-gray-600">Click a row in the list to see details.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center gap-0.5 border-b border-white/10 px-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition ${
                active
                  ? 'border-violet-500 text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon size={12} className={active ? 'text-violet-400' : 'text-gray-500'} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'General'     && <GeneralTab     download={download} />}
        {activeTab === 'Progress'    && <ProgressTab    download={download} />}
        {activeTab === 'Files'       && <FilesTab       download={download} />}
        {activeTab === 'Connections' && <ConnectionsTab download={download} />}
        {activeTab === 'Logs'        && <LogTab         download={download} />}
      </div>
    </div>
  )
}
