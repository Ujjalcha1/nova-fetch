import MainLayout from './components/layout/MainLayout'

import DownloadPage from './pages/DownloadPage'
import SettingsPage from './pages/SettingsPage'
import AboutPage from './pages/AboutPage'

import useDownloader from './hooks/useDownloader'

import { useAppStore } from './store/app-store'

export default function App() {
  useDownloader()

  const page = useAppStore((state) => state.page)

  return (
    <MainLayout>
      {page === 'download' && <DownloadPage />}

      {page === 'settings' && <SettingsPage />}

      {page === 'about' && <AboutPage />}
    </MainLayout>
  )
}
