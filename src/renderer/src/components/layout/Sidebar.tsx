import { Download, Settings, Info } from 'lucide-react'

import { useAppStore, type AppPage } from '../../store/app-store'

const menus: {
  label: string
  page: AppPage
  icon: typeof Download
}[] = [
  {
    label: 'Download',
    page: 'download',
    icon: Download
  },
  {
    label: 'Settings',
    page: 'settings',
    icon: Settings
  },
  {
    label: 'About',
    page: 'about',
    icon: Info
  }
]

export default function Sidebar() {
  const page = useAppStore((s) => s.page)
  const setPage = useAppStore((s) => s.setPage)

  return (
    <aside className="sidebar border border-white/8 bg-[#111827]/92 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className="sidebar-logo border-b border-white/8 px-6 py-6">
        <h1 className="bg-gradient-to-br from-[#B794F4] to-[#60A5FA] bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          NovaFetch
        </h1>
        <p className="mt-2 text-sm text-slate-400">Download Anything</p>
      </div>

      <nav className="sidebar-menu px-4 py-6">
        <div className="space-y-2">
          {menus.map((item) => {
            const Icon = item.icon
            const active = page === item.page

            return (
              <button
                key={item.page}
                onClick={() => setPage(item.page)}
                className={`menu-item transition-all duration-200 ${
                  active
                    ? 'bg-linear-to-r from-[#7C3AED] to-[#2563EB] text-[#FFFFFF] shadow-[0_10px_30px_rgba(124,58,237,0.20)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={18} />
                <span className="text-sm font-medium tracking-wide">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <div className="sidebar-footer border-t border-white/8 p-5">
        <div className="rounded-2xl border border-white/6 bg-white/5 px-4 py-4 text-center">
          <p className="text-sm font-medium text-slate-300">NovaFetch v1.0.0</p>
        </div>
      </div>
    </aside>
  )
}
