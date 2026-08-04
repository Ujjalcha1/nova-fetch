import { DownloadCloud } from 'lucide-react'
import DownloadList from '../features/download/components/DownloadList'
import SummaryBar from '../features/download/components/SummaryBar'
import DetailsPanel from '../features/details/components/DetailsPanel'
import SplitPane from '../components/common/SplitPane'
import { useDialogStore } from '../store/dialog-store'
import { useSearchStore } from '../store/search-store'

export default function DownloadsPage() {
  const openNewDownload = useDialogStore((s) => s.openNewDownload)
  const searchQuery = useSearchStore((s) => s.query)

  return (
    <div className="flex h-full flex-col">
      <SummaryBar />

      <div className="flex-1 overflow-hidden">
        <SplitPane
          storageKey="downloads-splitter-ratio"
          defaultRatio={0.5}
          minTopHeight={180}
          minBottomHeight={180}
          top={
            <DownloadList
              searchQuery={searchQuery || undefined}
              emptyState={{
                icon: DownloadCloud,
                title: 'No Downloads',
                description: 'Click "Add Download" to start downloading.',
                action: { label: 'Add Download', onClick: () => openNewDownload() }
              }}
            />
          }
          bottom={
            <div className="h-full border-t border-white/10 bg-[#111827]">
              <DetailsPanel />
            </div>
          }
        />
      </div>
    </div>
  )
}