import {
  Download,
  Clock3,
  CheckCircle2,
  History,
  CircleHelp
} from 'lucide-react'

import { useNavigationStore } from '../store/navigation-store'
import type { Page } from '../store/navigation-store'

type Menu = {
  id: Page
  label: string
  icon: React.ElementType
}

const MENUS: Menu[] = [
  { id: 'downloads', label: 'Downloads', icon: Download },
  { id: 'scheduled', label: 'Scheduled', icon: Clock3 },
  { id: 'completed', label: 'Completed', icon: CheckCircle2 },
  { id: 'history', label: 'History', icon: History }
]

export default function Sidebar(): React.JSX.Element {
  const page = useNavigationStore((s) => s.page)
  const navigate = useNavigationStore((s) => s.navigate)

  return (
    <aside className="flex w-[250px] flex-col border-r border-white/10 bg-[#111827]">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-violet-500">NovaFetch</h1>
        <p className="mt-0.5 text-[11px] text-gray-500">Download Anything</p>
      </div>

      {/* Scrollable middle area */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {/* Navigation */}
        <div className="px-3">
          <h3 className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">Navigation</h3>
          <div className="flex flex-col gap-0.5">
            {MENUS.map((item) => {
              const Icon = item.icon
              const selected = page === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm transition duration-150 ${
                    selected
                      ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/20'
                      : 'text-gray-300 hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon size={18} className={selected ? 'text-white' : 'text-gray-400'} />
                  <span className="font-medium">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>

      </div>

      {/* Bottom (always pinned) */}
      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => navigate('about')}
            className={`flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm transition duration-150 ${
              page === 'about'
                ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/20'
                : 'text-gray-300 hover:bg-white/[0.06]'
            }`}
          >
            <CircleHelp size={18} className={page === 'about' ? 'text-white' : 'text-gray-400'} />
            <span className="font-medium">About</span>
          </button>
        </div>
      </div>
    </aside>
  )
}