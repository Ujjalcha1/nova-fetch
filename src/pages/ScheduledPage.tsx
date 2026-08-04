import { Clock3 } from 'lucide-react'
import { useNavigationStore } from '../store/navigation-store'
import DownloadList from '../features/download/components/DownloadList'
import DetailsPanel from '../features/details/components/DetailsPanel'

export default function ScheduledPage() {
  const navigate = useNavigationStore((s) => s.navigate)

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden">
        <DownloadList
          statusFilter="queued"
          emptyState={{
            icon: Clock3,
            title: 'No Scheduled',
            description: 'You have no queued downloads.',
            action: { label: 'Go to Downloads', onClick: () => navigate('downloads') }
          }}
        />
      </div>

      <div className="h-72 border-t border-white/10 bg-[#111827]">
        <DetailsPanel />
      </div>
    </div>
  )
}
