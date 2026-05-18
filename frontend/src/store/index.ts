import { create } from 'zustand'
import type { Category, FeedbackEntry, MutashabihatRecord } from '../data/types'

interface Filters {
  categories: Category[]
  bookIds: string[]
  surahFrom: number
  surahTo: number
  ayahFrom: number
  ayahTo: number
  searchQuery: string
  minConfidence: number
}

interface Store {
  // Data
  focusedRecordId: string | null
  focusedNodeId: string | null     // "surah:ayah"
  hoveredNodeId: string | null

  // Filters
  filters: Filters
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void
  clearFilters: () => void

  // View mode
  view: 'graph' | 'browse'
  setView: (v: 'graph' | 'browse') => void

  // Language
  lang: 'ar' | 'en'
  setLang: (l: 'ar' | 'en') => void

  // Focus actions
  focusRecord: (record: MutashabihatRecord) => void
  focusNode: (nodeId: string) => void
  clearFocus: () => void
  setHovered: (nodeId: string | null) => void

  // Feedback
  feedback: Map<string, FeedbackEntry>
  setFeedback: (entry: FeedbackEntry) => void
  exportFeedback: () => void
}

const DEFAULT_FILTERS: Filters = {
  categories: [],
  bookIds: [],
  surahFrom: 1,
  surahTo: 114,
  ayahFrom: 1,
  ayahTo: 286,
  searchQuery: '',
  minConfidence: 0,
}

const FEEDBACK_KEY = 'mutashabihat-feedback'

function loadFeedback(): Map<string, FeedbackEntry> {
  try {
    const raw = localStorage.getItem(FEEDBACK_KEY)
    if (!raw) return new Map()
    const arr: FeedbackEntry[] = JSON.parse(raw)
    return new Map(arr.map(e => [e.recordId, e]))
  } catch { return new Map() }
}

function saveFeedback(map: Map<string, FeedbackEntry>) {
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(Array.from(map.values())))
}

export const useStore = create<Store>((set, get) => ({
  focusedRecordId: null,
  focusedNodeId: null,
  hoveredNodeId: null,

  filters: { ...DEFAULT_FILTERS },
  setFilter: (key, value) => set(s => ({ filters: { ...s.filters, [key]: value } })),
  clearFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  view: 'graph',
  setView: (view) => set({ view }),

  lang: 'ar',
  setLang: (lang) => set({ lang }),

  focusRecord: (record) => set({
    focusedRecordId: record.id,
    focusedNodeId: `${record.verses.primary.surah}:${record.verses.primary.ayah}`,
    view: 'graph',
  }),

  focusNode: (nodeId) => set({ focusedNodeId: nodeId }),

  clearFocus: () => set({ focusedRecordId: null, focusedNodeId: null }),

  setHovered: (nodeId) => set({ hoveredNodeId: nodeId }),

  feedback: loadFeedback(),
  setFeedback: (entry) => {
    const map = new Map(get().feedback)
    map.set(entry.recordId, entry)
    saveFeedback(map)
    set({ feedback: map })
  },
  exportFeedback: () => {
    const data = Array.from(get().feedback.values())
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `feedback-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  },
}))
