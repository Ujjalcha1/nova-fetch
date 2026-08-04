import { useSettings } from '@renderer/hooks/useSettings'

export default function SettingsPage() {
  const { settings, update } = useSettings()

  const selectFolder = async () => {
    const folder = await window.api.dialog.selectFolder()

    if (!folder) return

    await update({
      downloadFolder: folder
    })
  }

  return (
    <div className="full-height bg-[#09090B] text-[#FFFFFF]">
      <div className="page-header border-b border-[#1E293B] bg-[#111827]/80 backdrop-blur-3xl">
        <div className="absolute inset-0 bg-linear-to-r from-[#7C3AED]/10 to-[#2563EB]/10" />
        <div className="relative">
          <h1 className="bg-gradient-to-br from-[#FFFFFF] to-[#94A3B8] bg-clip-text text-[24px] font-bold leading-none tracking-tight text-transparent">
            Settings
          </h1>
          <p className="mt-2 text-[14px] font-medium leading-none text-[#94A3B8]">
            Preferences & Configuration
          </p>
        </div>
      </div>

      <div className="scroll-area">
        <div className="container">
          <div className="settings-card border border-[#1E293B] bg-[#111827] shadow-2xl backdrop-blur-xl">
            <h2 className="text-[20px] font-medium text-[#FFFFFF]">Download Folder</h2>
            <p className="mt-1 text-[14px] text-[#94A3B8]">Choose where your media files will be saved by default.</p>
            
            <div className="settings-row mt-6 border border-[#1E293B] bg-[#09090B]">
              <p className="break-all font-mono text-[14px] text-[#FFFFFF]">
                {settings?.downloadFolder || 'No folder selected'}
              </p>

              <button 
                onClick={selectFolder} 
                className="action-btn-sm ml-4 bg-[#1E293B] font-semibold text-[#FFFFFF] transition-all hover:bg-[#1E293B]/80 active:scale-[0.98]"
              >
                Change Folder
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
