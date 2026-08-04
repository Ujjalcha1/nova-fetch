import { useState } from 'react'
import {
  AlertCircle, ChevronDown, ChevronRight, RefreshCw,
  Info, ArrowDownToLine, FileText, Wifi, BarChart2,
  Link, Clock, Zap, Gauge, Timer, HardDrive, Database, Activity
} from 'lucide-react'
import type { DownloadItem } from '../../../types/download'
import { useDownloadStore } from '../../../store/download-store'
import { electron } from '../../../lib/electron'
import { formatBytes, formatSpeed, formatEta, formatTime, formatErrorMessage } from '../../../lib/format'

type Props = {
  download: DownloadItem
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  icon: Icon,
  children
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#1A2232] p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-white/[0.06] pb-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/15">
          <Icon size={13} className="text-violet-400" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</span>
      </div>
      {children}
    </div>
  )
}

function Field({ label, value, mono = false, dim = false }: {
  label: string
  value: React.ReactNode
  mono?: boolean
  dim?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{label}</span>
      <span className={`truncate text-sm font-medium ${mono ? 'font-mono tabular-nums' : ''} ${dim ? 'text-gray-300' : 'text-white'}`}>
        {value}
      </span>
    </div>
  )
}

function StatTile({ label, value, icon: Icon, accent = false }: {
  label: string
  value: string
  icon: React.ElementType
  accent?: boolean
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg p-3 ${accent ? 'bg-violet-500/10' : 'bg-white/[0.04]'}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accent ? 'bg-violet-500/20' : 'bg-white/[0.06]'}`}>
        <Icon size={15} className={accent ? 'text-violet-300' : 'text-gray-400'} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
        <p className="truncate font-mono text-sm font-semibold tabular-nums text-white">{value}</p>
      </div>
    </div>
  )
}

/**
 * SizeDisplay — shows downloaded / remaining / total in a scannable stacked layout.
 *
 *   872.20 MB          ← downloaded, large & bright
 *   remaining
 *   392.80 MB          ← remaining, medium
 *   of
 *   1.26 GB            ← total, dimmed
 */
function SizeDisplay({ downloaded, remaining, total }: {
  downloaded: number
  remaining: number
  total: number
}) {
  const hasTotal = total > 0
  return (
    <div className="flex items-baseline gap-4">
      {/* Downloaded — primary */}
      <div className="flex flex-col">
        <span className="font-mono text-lg font-bold tabular-nums text-white">
          {formatBytes(downloaded)}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">downloaded</span>
      </div>

      {hasTotal && (
        <>
          {/* Separator */}
          <div className="h-8 w-px shrink-0 bg-white/10" />

          {/* Remaining */}
          <div className="flex flex-col">
            <span className="font-mono text-base font-semibold tabular-nums text-violet-300">
              {formatBytes(remaining)}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">remaining</span>
          </div>

          {/* Separator */}
          <div className="h-8 w-px shrink-0 bg-white/10" />

          {/* Total */}
          <div className="flex flex-col">
            <span className="font-mono text-base font-medium tabular-nums text-gray-400">
              {formatBytes(total)}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">total</span>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GeneralTab({ download }: Props) {
  const updateDownload = useDownloadStore((s) => s.updateDownload)
  const [retrying, setRetrying] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const isFailed = download.status === 'failed'
  const elapsed = (Date.now() - download.addedAt) / 1000
  const avgSpeed = !isFailed && elapsed > 0 && download.downloaded > 0 ? download.downloaded / elapsed : 0
  const remaining = Math.max(0, download.totalSize - download.downloaded)

  const handleRetry = async () => {
    setRetrying(true)
    console.trace('[IPC RESUME CALL]', {
      function: 'GeneralTab.handleRetry',
      id: download.id,
      ids: [download.id],
      status: download.status,
      paused: download.status === 'paused',
      stack: new Error().stack,
    })
    updateDownload(download.id, { status: 'queued', error: undefined, failureDetails: undefined })
    try {
      await electron.start({ id: download.id, url: download.url, outputPath: download.savePath, format: '' })
    } catch (err) {
      updateDownload(download.id, { status: 'failed', error: formatErrorMessage(err) || 'Retry failed' })
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="space-y-3">

      {/* ── Error Banner ─────────────────────────────────────────────────── */}
      {isFailed && download.error && (
        <>
          <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-900/20 p-4">
            <AlertCircle className="mt-0.5 shrink-0 text-red-400" size={18} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-red-400">Download Failed</p>
              <p className="mt-0.5 text-sm text-red-300">{formatErrorMessage(download.error)}</p>
            </div>
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm transition hover:bg-violet-500 disabled:opacity-50"
            >
              <RefreshCw size={13} className={retrying ? 'animate-spin' : ''} />
              {retrying ? 'Retrying…' : 'Retry'}
            </button>
          </div>

          {download.failureDetails && (
            <div className="rounded-xl border border-white/[0.06] bg-[#1A2232]">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex w-full items-center gap-2 px-4 py-3 text-xs font-medium text-gray-400 transition hover:text-white"
              >
                {showDetails ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                Technical Details
              </button>
              {showDetails && (
                <div className="space-y-3 border-t border-white/5 p-4 font-mono text-sm">
                  {download.failureDetails.command && (
                    <div>
                      <p className="mb-1 text-xs text-gray-400">Command</p>
                      <pre className="whitespace-pre-wrap break-all text-gray-200">{download.failureDetails.command}</pre>
                    </div>
                  )}
                  {download.failureDetails.exitCode !== undefined && (
                    <div>
                      <p className="mb-1 text-xs text-gray-400">Exit Code</p>
                      <span className="text-red-400">{download.failureDetails.exitCode}</span>
                    </div>
                  )}
                  {download.failureDetails.stderr && (
                    <div>
                      <p className="mb-1 text-xs text-gray-400">stderr</p>
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-red-300">{download.failureDetails.stderr}</pre>
                    </div>
                  )}
                  {download.failureDetails.stdout && (
                    <div>
                      <p className="mb-1 text-xs text-gray-400">stdout</p>
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-gray-300">{download.failureDetails.stdout}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Cards grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">

        {/* General */}
        <SectionCard title="General" icon={Info}>
          <div className="space-y-3">
            <Field label="Title" value={download.title} />
            <Field label="URL" value={
              <span className="text-violet-400">{download.url}</span>
            } />
            <Field label="Status" value={
              <span className="capitalize">{download.status}</span>
            } />
          </div>
        </SectionCard>

        {/* File */}
        <SectionCard title="File" icon={FileText}>
          <div className="space-y-3">
            <Field label="Save Path" value={download.savePath} dim />
            <SizeDisplay
              downloaded={download.downloaded}
              remaining={remaining}
              total={download.totalSize}
            />
          </div>
        </SectionCard>

        {/* Transfer */}
        <SectionCard title="Transfer" icon={ArrowDownToLine}>
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Current Speed" value={isFailed ? '0 B/s' : formatSpeed(download.speed)}    icon={Zap}   accent />
            <StatTile label="Average Speed" value={isFailed ? '0 B/s' : formatSpeed(avgSpeed)}          icon={Gauge} />
            <StatTile label="ETA"           value={formatEta(download.eta, download.status)}             icon={Clock} />
            <StatTile label="Elapsed Time"  value={formatTime(elapsed)}                              icon={Timer} />
          </div>
        </SectionCard>

        {/* Network */}
        <SectionCard title="Network" icon={Wifi}>
          <div className="space-y-3">
            <Field label="Active Connections" value={String(download.connections?.length ?? 0)} mono />
            {(download.connections?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                {download.connections?.map((conn) => (
                  <div key={conn.id} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link size={11} className="shrink-0 text-gray-500" />
                      <span className="truncate text-xs text-gray-300">{conn.host}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="font-mono text-xs tabular-nums text-white">{formatSpeed(conn.speed)}</span>
                      <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-400">{conn.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">No active connections.</p>
            )}
          </div>
        </SectionCard>

        {/* Statistics — spans full width */}
        <div className="xl:col-span-2">
          <SectionCard title="Statistics" icon={BarChart2}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label="Downloaded"    value={formatBytes(download.downloaded)}                               icon={HardDrive} />
              <StatTile label="Total Size"    value={download.totalSize > 0 ? formatBytes(download.totalSize) : '—'} icon={Database}  />
              <StatTile label="Connections"   value={String(download.connections?.length ?? 0)}                            icon={Activity}  />
              <StatTile label="Elapsed Time"  value={formatTime(elapsed)}                                        icon={Timer}     />
            </div>
          </SectionCard>
        </div>

      </div>
    </div>
  )
}
