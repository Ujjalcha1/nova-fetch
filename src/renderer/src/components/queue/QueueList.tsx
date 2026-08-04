import QueueCard from './QueueCard'

import { useQueueStore } from '../../store/queueStore'

export default function QueueList() {
  const queue = useQueueStore((state) => state.queue)

  if (!queue.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/4 px-8 py-10 text-center text-slate-400">
        No active downloads
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {queue.map((item) => (
        <QueueCard
          key={item.id}
          title={item.title}
          progress={item.progress}
          speed={item.speed}
          eta={item.eta}
          status={item.status === 'downloading' || item.status === 'completed' ? item.status : 'waiting'}
        />
      ))}
    </div>
  )
}
