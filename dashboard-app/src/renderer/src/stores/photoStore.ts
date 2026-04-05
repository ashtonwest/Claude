import { create } from 'zustand'
import type { PhotoMeta } from '@shared/types'

interface PhotoState {
  currentPhoto: PhotoMeta | null
  nextPhoto: PhotoMeta | null
  transitioning: boolean
  loading: boolean

  loadNext: () => Promise<void>
  prefetch: () => Promise<void>
}

export const usePhotoStore = create<PhotoState>((set, get) => ({
  currentPhoto: null,
  nextPhoto: null,
  transitioning: false,
  loading: false,

  loadNext: async () => {
    const { nextPhoto } = get()
    try {
      const newNext = await window.electronAPI['photos:getNext']()

      if (nextPhoto) {
        set({ transitioning: true })
        setTimeout(() => {
          set({
            currentPhoto: nextPhoto,
            nextPhoto: newNext,
            transitioning: false
          })
        }, 50)
      } else {
        set({
          currentPhoto: newNext,
          nextPhoto: null
        })
        // Prefetch next
        const prefetched = await window.electronAPI['photos:getNext']()
        set({ nextPhoto: prefetched })
      }
    } catch {
      // Keep current photo on error
    }
  },

  prefetch: async () => {
    if (get().nextPhoto) return
    try {
      const next = await window.electronAPI['photos:getNext']()
      set({ nextPhoto: next })
    } catch {
      // ignore
    }
  }
}))
