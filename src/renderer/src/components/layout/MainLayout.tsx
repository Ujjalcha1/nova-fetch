import { ReactNode } from 'react'
import Sidebar from './Sidebar'

interface Props {
  children: ReactNode
}

export default function MainLayout({ children }: Props) {
  return (
    <div className="layout-wrapper bg-[#070B1A] text-[#FFFFFF]">
      <Sidebar />

      <div className="layout-main border border-white/8 bg-[#09090B]/95 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <main className="main-content">{children}</main>
      </div>
    </div>
  )
}