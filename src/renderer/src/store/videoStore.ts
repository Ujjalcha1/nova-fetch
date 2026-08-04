import { create } from 'zustand'

import type { VideoInfo } from '../../../shared/types/video'
import type { FileInfo } from '../../../shared/types/file'
import type { PlaylistInfo } from '../../../shared/types/playlist'
interface VideoStore {
  videos: VideoInfo[]
  playlists: PlaylistInfo[]
  files: FileInfo[]

  setVideos: (videos: VideoInfo[]) => void
  addVideo: (video: VideoInfo) => void
  removeVideo: (id: string) => void

  setPlaylists: (playlists: PlaylistInfo[]) => void
  addPlaylist: (playlist: PlaylistInfo) => void
  removePlaylist: (id: string) => void

  setFiles: (files: FileInfo[]) => void
  addFile: (file: FileInfo) => void
  removeFile: (url: string) => void

  clear: () => void
}

export const useVideoStore = create<VideoStore>((set) => ({
  videos: [],
  playlists: [],
  files: [],

  setVideos: (videos) => set({ videos }),

  addVideo: (video) =>
    set((state) => {
      const exists = state.videos.find((v) => v.id === video.id)

      if (exists) {
        return {
          videos: state.videos.map((v) => (v.id === video.id ? video : v))
        }
      }

      return {
        videos: [...state.videos, video]
      }
    }),

  setPlaylists: (playlists) => set({ playlists }),

  addPlaylist: (playlist) =>
    set((state) => {
      const exists = state.playlists.find((p) => p.id === playlist.id)

      if (exists) {
        return {
          playlists: state.playlists.map((p) => (p.id === playlist.id ? playlist : p))
        }
      }

      return {
        playlists: [...state.playlists, playlist]
      }
    }),

  removePlaylist: (id) =>
    set((state) => ({
      playlists: state.playlists.filter((p) => p.id !== id)
    })),

  removeVideo: (id: string) =>
    set((state) => ({
      videos: state.videos.filter((video) => video.id !== id)
    })),

  removeFile: (url: string) =>
    set((state) => ({
      files: state.files.filter((file) => file.url !== url)
    })),

  setFiles: (files) => set({ files }),

  addFile: (file) =>
    set((state) => {
      const exists = state.files.find((f) => f.url === file.url)

      if (exists) {
        return {
          files: state.files.map((f) => (f.url === file.url ? file : f))
        }
      }

      return {
        files: [...state.files, file]
      }
    }),

  clear: () =>
    set({
      videos: [],
      playlists: [],
      files: []
    })
}))
