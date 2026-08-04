import { Loader2, Search } from 'lucide-react'

type Props = {
  url: string

  setUrl: (value: string) => void

  onFetch: () => void

  loading: boolean
}

export default function UrlInput({ url, setUrl, onFetch, loading }: Props) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Video / Playlist URL</label>

      <div className="flex gap-3">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className="flex-1 rounded-xl border border-white/10 bg-[#1A2232] px-4 py-3 outline-none focus:border-violet-500"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onFetch()
            }
          }}
        />

        <button
          onClick={() => onFetch()}
          disabled={loading || !url.trim()}
          className="flex w-40 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-medium transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Search size={18} />
              Analyze
            </>
          )}
        </button>
      </div>
    </div>
  )
}
