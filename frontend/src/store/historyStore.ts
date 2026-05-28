import { create } from 'zustand'

const MAX_HISTORY = 100

export interface HistoryEntry {
  id: string
  description: string
  module: string
  timestamp: number
  undo: () => Promise<void>
  redo: () => Promise<void>
}

interface HistoryState {
  past: HistoryEntry[]
  future: HistoryEntry[]
  isProcessing: boolean
  reloadTrigger: number
  dataOnlyTrigger: number

  push: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void
  undo: () => Promise<void>
  redo: () => Promise<void>
  clear: () => void
  triggerReload: () => void
  triggerDataOnly: () => void
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  past: [],
  future: [],
  isProcessing: false,
  reloadTrigger: 0,
  dataOnlyTrigger: 0,

  push: (entry) => {
    set((state) => ({
      past: [
        ...state.past.slice(-(MAX_HISTORY - 1)),
        {
          ...entry,
          id: Math.random().toString(36).slice(2),
          timestamp: Date.now(),
        },
      ],
      future: [],
    }))
  },

  undo: async () => {
    const { past, isProcessing } = get()
    if (isProcessing || past.length === 0) return
    const entry = past[past.length - 1]
    set({ isProcessing: true })
    try {
      await entry.undo()
      set((state) => ({
        past: state.past.slice(0, -1),
        future: [entry, ...state.future],
        isProcessing: false,
      }))
    } catch {
      set({ isProcessing: false })
    }
  },

  redo: async () => {
    const { future, isProcessing } = get()
    if (isProcessing || future.length === 0) return
    const entry = future[0]
    set({ isProcessing: true })
    try {
      await entry.redo()
      set((state) => ({
        past: [...state.past, entry],
        future: state.future.slice(1),
        isProcessing: false,
      }))
    } catch {
      set({ isProcessing: false })
    }
  },

  clear: () => set({ past: [], future: [] }),

  triggerReload: () => set((state) => ({ reloadTrigger: state.reloadTrigger + 1 })),
  triggerDataOnly: () => set((state) => ({ dataOnlyTrigger: state.dataOnlyTrigger + 1 })),
}))
