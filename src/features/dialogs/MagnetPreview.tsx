import { useState, useEffect, useMemo, useCallback } from 'react'
import { Magnet, Loader2, Download, ChevronRight, ChevronDown, FolderOpen, File, AlertCircle } from 'lucide-react'

import { electron } from '../../lib/electron'
import { formatBytes } from '../../lib/format'
import { useDownloadStore } from '../../store/download-store'
import FolderPicker from './FolderPicker'

type TorrentFile = {
  path: string
  name: string
  length: number
}

type TorrentInfo = {
  name: string
  infoHash: string
  totalSize: number
  fileCount: number
  files: TorrentFile[]
}

type TreeNode = {
  name: string
  path: string
  size: number
  isDirectory: boolean
  children: TreeNode[]
}

type Props = {
  url: string
  info: { name: string; infoHash: string; fileCount: number; totalSize: number; trackers: string[] }
  folder: string
  setFolder: (folder: string) => void
  onClose?: () => void
  onError?: (error: string) => void
}

function buildTree(files: TorrentFile[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const f of files) {
    const parts = f.path.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1
      const part = parts[i]

      if (isLast) {
        current.push({ name: part, path: f.path, size: f.length, isDirectory: false, children: [] })
      } else {
        let dir = current.find((n) => n.name === part && n.isDirectory)
        if (!dir) {
          dir = { name: part, path: parts.slice(0, i + 1).join('/'), size: 0, isDirectory: true, children: [] }
          current.push(dir)
        }
        current = dir.children
      }
    }
  }

  function computeDirSizes(nodes: TreeNode[]): void {
    for (const n of nodes) {
      if (n.isDirectory) {
        computeDirSizes(n.children)
        n.size = n.children.reduce((sum, c) => sum + c.size, 0)
      }
    }
  }
  computeDirSizes(root)

  return root
}

type CheckState = 'checked' | 'unchecked' | 'partial'

function getCheckState(node: TreeNode, selected: Set<string>): CheckState {
  if (node.isDirectory) {
    let hasChecked = false
    let hasUnchecked = false
    for (const c of node.children) {
      const cs = getCheckState(c, selected)
      if (cs === 'checked') hasChecked = true
      if (cs === 'unchecked') hasUnchecked = true
      if (cs === 'partial') return 'partial'
    }
    if (hasChecked && !hasUnchecked) return 'checked'
    if (!hasChecked && hasUnchecked) return 'unchecked'
    return 'unchecked'
  }
  return selected.has(node.path) ? 'checked' : 'unchecked'
}

function FileTree({
  nodes,
  selected,
  onToggle,
  depth = 0
}: {
  nodes: TreeNode[]
  selected: Set<string>
  onToggle: (path: string, isDirectory: boolean) => void
  depth?: number
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleCollapse = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  return (
    <>
      {nodes.map((node) => {
        const cs = getCheckState(node, selected)
        const isCollapsed = collapsed.has(node.path)

        return (
          <div key={node.path}>
            <div
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.04] ${depth === 0 ? '' : ''}`}
              style={{ paddingLeft: `${12 + depth * 20}px` }}
            >
              {/* Expand/collapse for directories */}
              {node.isDirectory ? (
                <button
                  onClick={() => toggleCollapse(node.path)}
                  className="shrink-0 rounded p-0.5 text-gray-500 hover:text-gray-300"
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
              ) : (
                <span className="w-5" />
              )}

              {/* Checkbox */}
              <label className="flex shrink-0 items-center">
                <input
                  type="checkbox"
                  checked={cs === 'checked'}
                  ref={(el) => {
                    if (el) el.indeterminate = cs === 'partial'
                  }}
                  onChange={() => onToggle(node.path, node.isDirectory)}
                  className="h-4 w-4 accent-emerald-500"
                />
              </label>

              {/* Icon */}
              {node.isDirectory ? (
                <FolderOpen size={15} className="shrink-0 text-amber-400" />
              ) : (
                <File size={15} className="shrink-0 text-gray-500" />
              )}

              {/* Name */}
              <span className={`min-w-0 truncate text-sm ${node.isDirectory ? 'font-medium text-gray-200' : 'text-gray-400'}`}>
                {node.name}
              </span>

              {/* Size */}
              <span className="ml-auto shrink-0 text-xs text-gray-500 tabular-nums">
                {formatBytes(node.size)}
              </span>
            </div>

            {/* Children */}
            {node.isDirectory && !isCollapsed && (
              <FileTree
                nodes={node.children}
                selected={selected}
                onToggle={onToggle}
                depth={depth + 1}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

export default function MagnetPreview({
  url,
  info: _initialInfo,
  folder,
  setFolder,
  onClose,
  onError
}: Props) {
  const addDownload = useDownloadStore((state) => state.addDownload)
  const [downloading, setDownloading] = useState(false)
  const [resolving, setResolving] = useState(true)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [torrentInfo, setTorrentInfo] = useState<TorrentInfo | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [diskSpace, setDiskSpace] = useState<{ free: number; total: number } | null>(null)

  // Resolve magnet metadata on mount
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setResolving(true)
        setResolveError(null)
        const result = await electron.resolveMagnet(url)
        if (cancelled) return
        setTorrentInfo(result)
        // Select all files by default
        const allPaths = new Set(result.files.map((f: TorrentFile) => f.path))
        setSelected(allPaths)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Failed to resolve torrent metadata'
        setResolveError(msg)
      } finally {
        if (!cancelled) setResolving(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [url])

  // Fetch disk space when folder changes
  useEffect(() => {
    if (!folder) return
    let cancelled = false
    electron.getDiskSpace(folder).then((space) => {
      if (!cancelled) setDiskSpace(space)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [folder])

  const tree = useMemo(() => {
    if (!torrentInfo) return []
    return buildTree(torrentInfo.files)
  }, [torrentInfo])

  const selectedSize = useMemo(() => {
    if (!torrentInfo) return 0
    let total = 0
    for (const f of torrentInfo.files) {
      if (selected.has(f.path)) total += f.length
    }
    return total
  }, [torrentInfo, selected])

  const handleToggle = useCallback((path: string, isDirectory: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)

      if (isDirectory) {
        const allPaths: string[] = []
        function walk(nodes: TreeNode[]): void {
          for (const n of nodes) {
            if (n.isDirectory) walk(n.children)
            else allPaths.push(n.path)
          }
        }
        const dirNode = findNode(tree, path)
        if (dirNode) walk(dirNode.children)

        const allChecked = allPaths.every((p) => prev.has(p))
        if (allChecked) {
          for (const p of allPaths) next.delete(p)
        } else {
          for (const p of allPaths) next.add(p)
        }
      } else {
        if (prev.has(path)) next.delete(path)
        else next.add(path)
      }

      return next
    })
  }, [tree])

  const handleSelectAll = useCallback(() => {
    if (!torrentInfo) return
    setSelected(new Set(torrentInfo.files.map((f: TorrentFile) => f.path)))
  }, [torrentInfo])

  const handleSelectNone = useCallback(() => {
    setSelected(new Set())
  }, [])

  const selectedCount = selected.size
  const hasFileTree = tree.length > 0

  async function handleDownload() {
    if (!folder) {
      onError?.('Please select a save folder')
      return
    }

    if (selectedCount === 0 && hasFileTree) {
      onError?.('Select at least one file to download')
      return
    }

    setDownloading(true)

    try {
      const id = crypto.randomUUID()

      addDownload({
        id,
        title: torrentInfo?.name ?? _initialInfo.name,
        url,
        thumbnail: '',
        status: 'queued',
        progress: 0,
        speed: 0,
        eta: 0,
        downloaded: 0,
        totalSize: selectedSize,
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
        retryDelay: 30,
        retryAt: null,
        savePath: folder,
        addedAt: Date.now(),
        logs: [],
        files: [],
        connections: []
      })

      await electron.start({
        id,
        url,
        outputPath: folder
      })

      onClose?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start download'
      onError?.(message)
    } finally {
      setDownloading(false)
    }
  }

  // Loading state
  if (resolving) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 size={28} className="animate-spin text-emerald-400" />
          <p className="text-sm">Connecting to swarm and resolving torrent metadata...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (resolveError) {
    return (
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
        <div className="flex items-start gap-4 rounded-xl bg-red-900/20 p-4">
          <AlertCircle size={22} className="shrink-0 text-red-400" />
          <div>
            <p className="font-medium text-red-300">Failed to resolve torrent</p>
            <p className="mt-1 text-sm text-red-400">{resolveError}</p>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-gray-700 px-6 py-3 font-medium transition hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Scrollable content */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
        {/* Torrent info card */}
        <div className="flex items-start gap-5 rounded-xl bg-[#1A2232] p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-600/20">
            <Magnet size={26} className="text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{torrentInfo?.name ?? _initialInfo.name}</h2>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span className="text-gray-400">
                Total <b className="ml-1 text-white">{formatBytes(torrentInfo?.totalSize ?? 0)}</b>
              </span>
              <span className="text-gray-400">
                Files <b className="ml-1 text-white">{torrentInfo?.fileCount ?? 0}</b>
              </span>
              <span className="text-gray-400">
                Selected <b className="ml-1 text-emerald-400">{formatBytes(selectedSize)}</b>
                <span className="ml-1 text-gray-500">({selectedCount} files)</span>
              </span>
              {diskSpace && (
                <span className="text-gray-400">
                  Free <b className="ml-1 text-gray-300">{formatBytes(diskSpace.free)}</b>
                  {diskSpace.free < selectedSize && (
                    <span className="ml-2 text-xs text-red-400">(Not enough free space)</span>
                  )}
                </span>
              )}
            </div>
            {torrentInfo?.infoHash && (
              <p className="mt-2 truncate text-xs text-gray-500 font-mono">{torrentInfo.infoHash}</p>
            )}
          </div>
        </div>

        {/* Select All / Select None */}
        {(tree.length > 0) && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Files</h3>
              <div className="flex gap-3">
                <button
                  onClick={handleSelectAll}
                  className="text-xs font-medium text-emerald-400 transition hover:text-emerald-300"
                >
                  Select All
                </button>
                <button
                  onClick={handleSelectNone}
                  className="text-xs font-medium text-gray-500 transition hover:text-gray-300"
                >
                  Select None
                </button>
              </div>
            </div>

            {/* File tree */}
            <div className="max-h-[300px] overflow-y-auto rounded-xl bg-[#1A2232] p-2">
              <FileTree
                nodes={tree}
                selected={selected}
                onToggle={handleToggle}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar (folder picker + download button) */}
      <div className="shrink-0 border-t border-white/10 p-6">
        <div className="flex items-end gap-4">
          <div className="min-w-0 flex-1">
            <FolderPicker folder={folder} setFolder={setFolder} />
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading || (hasFileTree && selectedCount === 0)}
            className="flex h-[50px] shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-6 font-medium transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Download size={18} />
                Start Download
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function findNode(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const n of nodes) {
    if (n.path === path) return n
    if (n.isDirectory) {
      const found = findNode(n.children, path)
      if (found) return found
    }
  }
  return undefined
}
