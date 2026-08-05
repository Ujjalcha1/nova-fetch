import updateJson from '../../update.json'

export default function StatusBar() {
  return (
    <footer className="flex h-8 items-center justify-between border-t border-white/10 bg-[#10151F] px-4 text-xs text-gray-400">
      <span>Ready</span>

      <span>NovaFetch v{updateJson.latestVersion}</span>
    </footer>
  )
}
