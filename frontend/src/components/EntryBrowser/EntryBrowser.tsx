import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import Fuse from 'fuse.js'
import type { DerivedData, MutashabihatRecord } from '../../data/types'
import { CATEGORY_COLORS, getCategoryLabel, getCategoryTooltip } from '../../data/types'
import { useStore } from '../../store'
import './entry-browser.css'

interface Props { data: DerivedData }

export function EntryBrowser({ data }: Props) {
  const { filters, setFilter, clearFilters, focusRecord, lang } = useStore()
  const t = {
    searchPlaceholder: lang === 'ar' ? 'ابحث في الآيات والشرح والمؤلفين…' : 'Search verses, explanations, authors…',
    entry: lang === 'ar' ? 'نتيجة' : 'entry',
    entries: lang === 'ar' ? 'نتائج' : 'entries',
    noConnections: lang === 'ar' ? 'لا توجد روابط مطابقة' : 'No connections found',
    tryRemoving: lang === 'ar' ? 'جرّب إزالة بعض الفلاتر أو مسح البحث' : 'Try removing a filter or clearing the search',
    clearAll: lang === 'ar' ? 'مسح كل الفلاتر' : 'Clear all filters',
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== '/') return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      event.preventDefault()
      const input = document.getElementById('entry-search-input') as HTMLInputElement | null
      input?.focus()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const fuse = useMemo(() => new Fuse(data.records, {
    keys: ['summary_en', 'verses.primary.text_snippet', 'source.author_ar'],
    threshold: 0.4,
    minMatchCharLength: 2,
  }), [data.records])

  const filtered = useMemo(() => {
    let results = data.records

    if (filters.searchQuery.trim()) {
      results = fuse.search(filters.searchQuery.trim()).map(r => r.item)
    }

    if (filters.categories.length > 0) {
      results = results.filter(r => filters.categories.includes(r.category))
    }

    if (filters.bookIds.length > 0) {
      const activeBooks = new Set(filters.bookIds)
      results = results.filter(r => activeBooks.has(r.source.book_id))
    }

    results = results.filter(
      r => r.verses.primary.surah >= filters.surahFrom
        && r.verses.primary.surah <= filters.surahTo
    )

    if (filters.minConfidence > 0) {
      results = results.filter(r => (r.confidence ?? 0) >= filters.minConfidence)
    }

    return results
  }, [data.records, filters.searchQuery, filters.categories, filters.bookIds, filters.surahFrom, filters.surahTo, filters.minConfidence, fuse])

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 20 }}
        className="entry-search-wrap px-4 pt-4 pb-3 flex-shrink-0"
      >
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 text-sm pointer-events-none">⌕</span>
          <input
            type="text"
            value={filters.searchQuery}
            onChange={e => setFilter('searchQuery', e.target.value)}
            placeholder={t.searchPlaceholder}
            id="entry-search-input"
            className="entry-search-input w-full text-sm rounded-xl pl-9 pr-4 py-2.5 text-slate-300 placeholder-slate-600 focus:outline-none transition-all"
          />
        </div>
      </motion.div>

      {/* Results count */}
      <div className="px-4 py-2 flex-shrink-0 flex items-center justify-between">
        <span className="text-[11px] text-slate-600">
          {filtered.length} {filtered.length === 1 ? t.entry : t.entries}
          {filters.searchQuery && <span> · "<span className="text-slate-500">{filters.searchQuery}</span>"</span>}
        </span>
      </div>

      {/* Grid or empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center px-8 gap-4">
          <div className="entry-empty-icon w-14 h-14 rounded-2xl flex items-center justify-center mb-1">
            <span className="text-2xl text-slate-600">✦</span>
          </div>
          <div>
            <p className="text-slate-400 text-sm font-medium mb-1">{t.noConnections}</p>
            <p className="text-slate-600 text-xs leading-relaxed">{t.tryRemoving}</p>
          </div>
          <button
            onClick={() => {
              clearFilters()
            }}
            className="text-xs text-[var(--gold)] hover:text-[var(--gold-warm)] transition-colors px-4 py-1.5 rounded-full"
            style={{ border: '1px solid rgba(212,175,55,0.25)' }}
          >
            {t.clearAll}
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {filtered.map(record => (
              <EntryCard key={record.id} record={record} onOpen={focusRecord} lang={lang} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function EntryCard({ record, onOpen, lang }: { record: MutashabihatRecord; onOpen: (r: MutashabihatRecord) => void; lang: 'ar' | 'en' }) {
  const color = CATEGORY_COLORS[record.category] ?? '#888'
  const label = getCategoryLabel(record.category, lang)
  const tooltip = getCategoryTooltip(record.category, lang)
  const { feedback } = useStore()
  const fb = feedback.get(record.id)

  return (
    <motion.button
      onClick={() => onOpen(record)}
      className="entry-card text-left rounded-2xl border cursor-pointer flex flex-col overflow-hidden transition-all duration-300 group"
      whileHover={{ y: -4, scale: 1.012 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      style={{
        ['--cat-color' as string]: color,
        ['--cat-color-bg' as string]: `${color}15`,
        ['--cat-color-border' as string]: `${color}30`,
        ['--cat-color-fade' as string]: `${color}80`,
        ['--cat-color-line' as string]: `${color}30`,
      }}
    >
      {/* Category color accent bar */}
      <div className="h-[2px] w-full flex-shrink-0" style={{
        background: `linear-gradient(to right, ${color}, ${color}40, transparent)`,
      }} />

      <div className="p-4 flex flex-col gap-2.5 flex-1">
        {/* Category badge + ref */}
        <div className="flex items-center justify-between">
          <span
            className="entry-badge text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wide"
            title={tooltip}
          >
            {label}
          </span>
          <div className="flex items-center gap-2">
            {fb && <span className="text-xs">{fb.vote === 'up' ? '👍' : '👎'}</span>}
            <span className="text-xs text-slate-600 font-mono tabular-nums">
              {record.verses.primary.surah}:{record.verses.primary.ayah}
            </span>
          </div>
        </div>

        {/* Primary Arabic text */}
        <p
          className="arabic text-lg text-slate-100 leading-relaxed line-clamp-2 text-right"
          lang="ar"
          dir="rtl"
        >
          {record.verses.primary._auto_filled?.text_uthmani_full || record.verses.primary.text_snippet}
        </p>

        {/* Related verse ref */}
        {record.verses.related[0] && (
          <div className="flex items-center justify-end gap-1.5 text-xs text-slate-600">
            <span className="font-mono tabular-nums">{record.verses.related[0].surah}:{record.verses.related[0].ayah}</span>
            <span className="entry-related-arrow">{lang === 'ar' ? '↔' : '↔'}</span>
            <span className="text-slate-500 truncate max-w-[100px]">
              {record.verses.related[0]._auto_filled?.surah_name_en ?? `Surah ${record.verses.related[0].surah}`}
            </span>
          </div>
        )}

        {/* English summary */}
        {record.summary_en && (
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed transition-colors group-hover:text-slate-400">
            {record.summary_en}
          </p>
        )}
      </div>

      {/* Author footer */}
      <div className="entry-footer px-4 pb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 pt-2.5">
          <span
            className="entry-footer-dot w-1 h-1 rounded-full flex-shrink-0"
              style={{ opacity: record.confidence ?? 0 }}
          />
          <span className="arabic-ui text-[11px] text-slate-600" lang="ar" dir="rtl">
            {record.source.author_ar}
          </span>
        </div>
        <div className="entry-footer-line w-8 h-px mt-2.5" />
      </div>
    </motion.button>
  )
}
