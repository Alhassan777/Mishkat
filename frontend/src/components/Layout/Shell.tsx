import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { DerivedData } from '../../data/types'
import { useStore } from '../../store'
import { CATEGORY_COLORS, getCategoryLabel, getCategoryTooltip } from '../../data/types'
import './shell.css'

interface Props { data: DerivedData; children: ReactNode }

export function Shell({ data, children }: Props) {
  const { view, setView, filters, setFilter, clearFilters, exportFeedback, feedback, lang, setLang } = useStore()

  const categories = Array.from(new Set(data.records.map(r => r.category)))
  const feedbackCount = feedback.size
  const t = {
    records: lang === 'ar' ? 'سجلات' : 'records',
    verses: lang === 'ar' ? 'آيات' : 'verses',
    graph: lang === 'ar' ? 'الرسم' : 'Graph',
    browse: lang === 'ar' ? 'تصفح' : 'Browse',
    filter: lang === 'ar' ? 'فلترة' : 'Filter',
    clear: lang === 'ar' ? 'مسح' : 'clear',
    reset: lang === 'ar' ? 'إعادة ضبط' : 'reset',
    search: lang === 'ar' ? 'بحث...' : 'Search...',
    allBooks: lang === 'ar' ? 'كل الكتب' : 'All books',
    export: lang === 'ar' ? 'تصدير' : 'Export',
  }

  return (
    <div className="relative z-10 flex flex-col h-full">

      {/* ── Top navigation ── */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 20 }}
        className="shell-header flex items-center gap-4 px-5 flex-shrink-0"
      >
        {/* Shimmer border underline */}
        <div className="shell-header-shimmer" />

        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="shell-logo-badge flex items-center justify-center flex-shrink-0">
            <span className="shell-logo-star">✦</span>
          </div>
          <div className="flex flex-col">
            <span className="shell-logo-title text-sm font-semibold leading-tight">
              Mutashabihat
            </span>
            <span className="shell-logo-ar hidden sm:block leading-tight">
              المتشابهات القرآنية
            </span>
          </div>
        </div>

        {/* View toggle — pill with gold active state */}
        <div className="shell-segment flex items-center ms-4 p-[3px] flex-shrink-0">
          {(['graph', 'browse'] as const).map(v => (
            <motion.button
              key={v}
              onClick={() => setView(v)}
              className={`shell-segment-btn flex items-center gap-[5px] text-xs font-medium transition-all duration-200 ${view === v ? 'is-active' : ''}`}
              whileHover={{ y: -1.5, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 250, damping: 16 }}
            >
              <span className="shell-segment-icon">{v === 'graph' ? '✦' : '⊞'}</span>
              {v === 'graph' ? t.graph : t.browse}
            </motion.button>
          ))}
        </div>

        {/* Right: lang toggle + stats + export */}
        <div className="ms-auto flex items-center gap-2.5">

          {/* AR / EN language toggle */}
          <div className="shell-lang-wrap flex items-center p-[3px] flex-shrink-0">
            {(['ar', 'en'] as const).map(l => (
              <motion.button
                key={l}
                onClick={() => setLang(l)}
                className={`shell-lang-btn text-xs font-semibold transition-all duration-200 flex-shrink-0 ${lang === l ? 'is-active' : ''}`}
                whileHover={{ y: -1, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 260, damping: 17 }}
              >
                {l === 'ar'
                  ? <span className="arabic-ui shell-lang-ar">ع</span>
                  : 'EN'}
              </motion.button>
            ))}
          </div>

          <div className="shell-stats hidden sm:flex items-center gap-2 text-xs">
            <span className="shell-stat-chip px-2.5 py-1 rounded-full">
              {data.records.length} {t.records}
            </span>
            <span className="shell-stat-chip px-2.5 py-1 rounded-full">
              {data.nodes.length} {t.verses}
            </span>
          </div>
          {feedbackCount > 0 && (
            <button
              onClick={exportFeedback}
              className="shell-export-btn text-xs transition-colors"
            >
              ↓ {t.export} {feedbackCount}
            </button>
          )}
        </div>
      </motion.header>

      {/* ── Category filter strip ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="shell-filter-bar flex items-center gap-2 px-5 flex-shrink-0 overflow-x-auto no-scrollbar"
      >
        <span className="shell-filter-label">
          {t.filter}
        </span>
        <div className="shell-filter-divider flex-shrink-0 mx-1" />

        {categories.map(cat => {
          const isActive = filters.categories.length === 0 || filters.categories.includes(cat)
          const color = CATEGORY_COLORS[cat] ?? '#888'
          const tooltip = getCategoryTooltip(cat, lang)
          return (
            <motion.button
              key={cat}
              onClick={() => {
                const active = filters.categories
                const next = active.includes(cat)
                  ? active.filter(c => c !== cat)
                  : [...active, cat]
                setFilter('categories', next)
              }}
              title={tooltip}
              className={`shell-filter-chip flex items-center gap-[5px] text-xs flex-shrink-0 transition-all duration-150 ${isActive ? 'is-active' : 'is-inactive'}`}
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 240, damping: 16 }}
            >
              <span
                className="shell-category-dot flex-shrink-0"
                style={{
                  backgroundColor: color,
                  boxShadow: isActive ? `0 0 5px ${color}` : undefined,
                }}
              />
              {getCategoryLabel(cat, lang)}
            </motion.button>
          )
        })}

        {filters.categories.length > 0 && (
          <button
            onClick={() => setFilter('categories', [])}
            className="shell-clear-btn text-xs ms-1 flex-shrink-0 transition-colors"
          >
            × {t.clear}
          </button>
        )}

        <div className="shell-filter-divider flex-shrink-0 mx-1" />
        <input
          value={filters.searchQuery}
          onChange={(e) => setFilter('searchQuery', e.target.value)}
          placeholder={t.search}
          className="text-xs px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-slate-300 placeholder-slate-500 w-32 sm:w-40 focus:outline-none focus:border-[var(--gold-border)]"
        />
        <select
          value={filters.bookIds[0] ?? ''}
          onChange={(e) => setFilter('bookIds', e.target.value ? [e.target.value] : [])}
          className="text-xs px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-slate-300 focus:outline-none focus:border-[var(--gold-border)]"
        >
          <option value="">{t.allBooks}</option>
          {data.books.map((book) => (
            <option key={book.id} value={book.id}>
              {book.authorAr}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <span>S</span>
          <input
            type="number"
            min={1}
            max={114}
            value={filters.surahFrom}
            onChange={(e) => setFilter('surahFrom', Math.min(114, Math.max(1, Number(e.target.value) || 1)))}
            className="w-12 px-1.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300 focus:outline-none focus:border-[var(--gold-border)]"
          />
          <span>-</span>
          <input
            type="number"
            min={1}
            max={114}
            value={filters.surahTo}
            onChange={(e) => setFilter('surahTo', Math.min(114, Math.max(1, Number(e.target.value) || 114)))}
            className="w-12 px-1.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300 focus:outline-none focus:border-[var(--gold-border)]"
          />
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <span>A</span>
          <input
            type="number"
            min={1}
            max={286}
            value={filters.ayahFrom}
            onChange={(e) => setFilter('ayahFrom', Math.min(286, Math.max(1, Number(e.target.value) || 1)))}
            className="w-12 px-1.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300 focus:outline-none focus:border-[var(--gold-border)]"
          />
          <span>-</span>
          <input
            type="number"
            min={1}
            max={286}
            value={filters.ayahTo}
            onChange={(e) => setFilter('ayahTo', Math.min(286, Math.max(1, Number(e.target.value) || 286)))}
            className="w-12 px-1.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300 focus:outline-none focus:border-[var(--gold-border)]"
          />
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500 min-w-[120px]">
          <span>C</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={filters.minConfidence}
            onChange={(e) => setFilter('minConfidence', Number(e.target.value))}
            className="w-20 accent-[var(--gold)]"
          />
          <span>{filters.minConfidence.toFixed(2)}</span>
        </div>
        <button
          onClick={clearFilters}
          className="shell-clear-btn text-xs ms-1 flex-shrink-0 transition-colors"
        >
          {t.reset}
        </button>
      </motion.div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
