export default function AboutPage() {
  return (
    <div className="full-height bg-[#09090B] text-[#FFFFFF]">
      <div className="page-header border-b border-[#1E293B] bg-[#111827]/80 backdrop-blur-3xl">
        <div className="absolute inset-0 bg-linear-to-r from-[#7C3AED]/10 to-[#2563EB]/10" />
        <div className="relative">
          <h1 className="bg-gradient-to-br from-[#FFFFFF] to-[#94A3B8] bg-clip-text text-[24px] font-bold leading-none tracking-tight text-transparent">
            About
          </h1>
          <p className="mt-2 text-[14px] font-medium leading-none text-[#94A3B8]">
            System Information
          </p>
        </div>
      </div>

      <div className="scroll-area">
        <div className="container">
          <div className="about-container border border-[#1E293B] bg-[#111827] shadow-2xl backdrop-blur-xl">
            <h1 className="bg-gradient-to-br from-[#7C3AED] to-[#2563EB] bg-clip-text text-[40px] font-bold tracking-tight text-transparent">
              NovaFetch
            </h1>
            <h2 className="mt-3 text-[24px] font-semibold text-[#94A3B8]">Download Anything</h2>
            <div className="about-grid mt-8">
              <div className="about-card border border-[#1E293B] bg-[#09090B]">
                <p className="text-[14px] font-medium text-[#94A3B8]">App Version</p>
                <p className="mt-2 font-mono text-[20px] font-medium text-[#FFFFFF]">v1.0.0</p>
              </div>
              <div className="about-card border border-[#1E293B] bg-[#09090B]">
                <p className="text-[14px] font-medium text-[#94A3B8]">Electron</p>
                <p className="mt-2 font-mono text-[20px] font-medium text-[#FFFFFF]">v39.0.0</p>
              </div>
              <div className="about-card border border-[#1E293B] bg-[#09090B]">
                <p className="text-[14px] font-medium text-[#94A3B8]">Node.js</p>
                <p className="mt-2 font-mono text-[20px] font-medium text-[#FFFFFF]">v22.13.1</p>
              </div>
              <div className="about-card border border-[#1E293B] bg-[#09090B]">
                <p className="text-[14px] font-medium text-[#94A3B8]">React</p>
                <p className="mt-2 font-mono text-[20px] font-medium text-[#FFFFFF]">v19.0.0</p>
              </div>
            </div>
            <p className="mt-12 text-[14px] text-[#94A3B8]">
              Built by a Senior UI/UX Designer & Engineer.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
