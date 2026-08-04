import { useState } from 'react'
import { Search, X, ClipboardPaste } from 'lucide-react'

interface Props {
  onAnalyze: any
}

export default function UrlInput({ onAnalyze }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAnalyze = async () => {
    const value = url.trim()

    if (!value || loading) return

    setLoading(true)

    try {
      await onAnalyze([value])

      // শুধুমাত্র success হলে input clear হবে
      setUrl('')
    } catch (error) {
      console.error('Analyze failed:', error)

      // চাইলে এখানে Toast দেখাতে পারো
      // toast.error(error instanceof Error ? error.message : 'Analyze failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card border border-[#1E293B] bg-[#111827] shadow-2xl backdrop-blur-xl transition-all">
      <label className="mb-3 block text-sm font-semibold text-[#FFFFFF]">Media URL</label>

      <div className="input-group">
        <div className="url-input-container">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste any media link here..."
            className="url-input-field border border-[#1E293B] bg-[#09090B]/50 text-[#FFFFFF] transition placeholder:text-[#94A3B8] focus:border-[#7C3AED]/50 focus:bg-[#09090B] focus:ring-4 focus:ring-[#7C3AED]/10"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAnalyze()
              }
            }}
          />
          {url ? (
            <button
              onClick={() => setUrl('')}
              className="url-input-btn text-[#94A3B8] transition hover:text-[#FFFFFF]"
              title="Clear"
            >
              <X size={20} />
            </button>
          ) : (
            <button
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText()
                  setUrl(text)
                } catch (err) {}
              }}
              className="url-input-btn text-[#94A3B8] transition hover:text-[#FFFFFF]"
              title="Paste from clipboard"
            >
              <ClipboardPaste size={20} />
            </button>
          )}
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !url.trim()}
          className="action-btn bg-linear-to-r from-[#7C3AED] to-[#2563EB] font-semibold text-[#FFFFFF] shadow-lg shadow-[#7C3AED]/20 transition-all hover:scale-[1.02] hover:shadow-[#7C3AED]/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
        >
          <Search size={18} />
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      <p className="mt-3 text-[13px] text-[#94A3B8]">
        Paste a media URL and press <b className="text-[#FFFFFF]">Enter</b> or click Analyze to
        begin.
      </p>
    </div>
  )
}
