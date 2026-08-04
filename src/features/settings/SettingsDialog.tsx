import { useState } from 'react'
import { X } from 'lucide-react'

import { useSettingsStore } from '../../store/settings-store'
import { useToastStore } from '../../store/toast-store'

type Props = {
  onClose?: () => void
}

const COOKIE_OPTIONS: { value: string; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'chrome', label: 'Chrome' },
  { value: 'edge', label: 'Edge' },
  { value: 'brave', label: 'Brave' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'disabled', label: 'Disabled' }
]

export default function SettingsDialog({ onClose }: Props): React.JSX.Element {
  const cookiesMode = useSettingsStore((s) => s.cookiesMode)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const addToast = useToastStore((s) => s.addToast)
  const [saving, setSaving] = useState(false)

  async function handleCookiesChange(value: string): Promise<void> {
    setSaving(true)
    try {
      await updateSettings({ cookiesMode: value })
      addToast({
        message: 'YouTube cookies updated',
        subtitle: value === 'disabled' ? 'Cookie support disabled' : `Cookie source: ${value}`,
        type: 'success'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex w-[460px] flex-col overflow-hidden rounded-2xl bg-[#111827] shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <h2 className="text-xl font-bold">Settings</h2>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Close settings"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-6 px-6 py-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-200">
            YouTube cookies (yt-dlp)
          </label>
          <p className="mb-3 text-xs leading-relaxed text-gray-500">
            Lets yt-dlp sign in to YouTube automatically using cookies from an installed
            browser. No manual cookie export needed. In <span className="text-gray-400">Auto</span>{' '}
            mode it tries Chrome, then Edge, Brave, and Firefox, and keeps working even when a
            browser is unavailable. Does not affect direct HTTP downloads.
          </p>
          <select
            value={cookiesMode}
            disabled={saving}
            onChange={(e) => handleCookiesChange(e.target.value)}
            className="h-10 w-full rounded-lg border border-white/10 bg-[#1A2232] px-3 text-sm text-gray-200 outline-none transition focus:border-violet-500 disabled:opacity-50"
          >
            {COOKIE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end border-t border-white/10 px-6 py-4">
        <button
          onClick={onClose}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium transition hover:bg-violet-500"
        >
          Done
        </button>
      </div>
    </div>
  )
}
