import { useState, useRef, useEffect } from 'react'
import { Bell, Download, Pause, Play, CheckCircle2, XCircle, RefreshCw, Trash2, ListChecks } from 'lucide-react'
import { useNotificationStore, type NotificationType } from '../../store/notification-store'

const ICONS: Record<NotificationType, React.ElementType> = {
  'download-started': Download,
  'download-paused': Pause,
  'download-resumed': Play,
  'download-completed': CheckCircle2,
  'download-failed': XCircle,
  'retry-started': RefreshCw,
  'queue-finished': ListChecks,
}

const COLORS: Record<NotificationType, string> = {
  'download-started': 'text-green-400',
  'download-paused': 'text-yellow-400',
  'download-resumed': 'text-green-400',
  'download-completed': 'text-green-400',
  'download-failed': 'text-red-400',
  'retry-started': 'text-orange-400',
  'queue-finished': 'text-blue-400',
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  return `${hr}h ago`
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const clearAll = useNotificationStore((s) => s.clearAll)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function handleToggle() {
    setOpen((v) => {
      if (!v) markAllRead()
      return !v
    })
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleToggle}
        className="relative rounded-lg bg-[#1A2232] p-2 transition hover:bg-[#253147]"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount() > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount() > 99 ? '99+' : unreadCount()}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-white/10 bg-[#1C2537] shadow-lg">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-xs text-gray-400 transition hover:text-red-400"
              >
                <Trash2 size={12} />
                Clear All
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-gray-500">
                <Bell size={24} className="opacity-40" />
                <p className="text-xs">No notifications</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = ICONS[n.type]
                const color = COLORS[n.type]
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 border-b border-white/5 px-4 py-3 transition ${
                      n.read ? 'opacity-60' : ''
                    }`}
                  >
                    <Icon size={16} className={`mt-0.5 shrink-0 ${color}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      {n.message && (
                        <p className="truncate text-xs text-gray-400">{n.message}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-gray-500">
                      {timeAgo(n.timestamp)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
