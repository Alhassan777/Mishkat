import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store'
import type { DerivedData, MutashabihatRecord } from '../../data/types'
import { CATEGORY_COLORS, getCategoryLabel, getCategoryTooltip } from '../../data/types'
import { ArabicBlock } from './ArabicBlock'
import { FeedbackWidget } from './FeedbackWidget'
import { useEffect } from 'react'
import './verse-detail.css'

interface Props { data: DerivedData }

export function VerseDetail({ data }: Props) {
  const { focusedRecordId, clearFocus, focusRecord, lang } = useStore()
  const record = focusedRecordId ? data.byId.get(focusedRecordId) ?? null : null

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearFocus()
      if (!record) return
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      const index = data.records.findIndex(r => r.id === record.id)
      if (index < 0) return
      const delta = e.key === 'ArrowRight' ? 1 : -1
      const nextIndex = (index + delta + data.records.length) % data.records.length
      focusRecord(data.records[nextIndex])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [clearFocus, data.records, focusRecord, record])

  return (
    <AnimatePresence>
      {record && (
        <motion.div
          key={record.id}
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 24 }}
          className="verse-panel fixed right-0 top-0 h-full z-30 w-full sm:w-[440px] md:w-[500px] flex flex-col"
        >
          <PanelContent record={record} onClose={clearFocus} lang={lang} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function PanelContent({ record, onClose, lang }: { record: MutashabihatRecord; onClose: () => void; lang: 'ar' | 'en' }) {
  const color = CATEGORY_COLORS[record.category] ?? '#8B5CF6'
  const label = getCategoryLabel(record.category, lang)
  const tooltip = getCategoryTooltip(record.category, lang)
  const confidence = record.confidence ?? 0
  const t = {
    primary: lang === 'ar' ? 'الآية الأساسية' : 'Primary verse',
    related: lang === 'ar' ? 'آية مرتبطة' : 'Related',
    explanation: lang === 'ar' ? 'الشرح العلمي' : 'Scholarly Explanation',
    confidence: lang === 'ar' ? 'الثقة' : 'Confidence',
    source: lang === 'ar' ? 'المصدر' : 'Source',
  }

  return (
    <>
      {/* Category color gradient accent bar */}
      <div className="h-[2px] w-full flex-shrink-0" style={{
        background: `linear-gradient(to right, ${color}, ${color}60, transparent)`,
      }} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="verse-panel-header flex items-center gap-3 px-5 py-3.5 flex-shrink-0">
        <span
          className="verse-badge text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wide flex-shrink-0"
          title={tooltip}
          style={{
            ['--cat-color' as string]: color,
            ['--cat-color-bg' as string]: `${color}18`,
            ['--cat-color-border' as string]: `${color}35`,
          }}
        >
          {label}
        </span>
        <span className="text-slate-500 text-xs flex-1 truncate arabic-ui" lang="ar" dir="rtl">
          {record.source.author_ar}
          {record.source.page_or_section ? ` · ص ${record.source.page_or_section}` : ''}
        </span>
        <motion.button
          onClick={onClose}
          className="verse-close-btn w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0 text-sm"
          whileHover={{ scale: 1.08, rotate: 90 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 280, damping: 15 }}
        >
          ×
        </motion.button>
      </motion.div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 flex flex-col gap-4">

          {/* Primary verse */}
          <ArabicBlock
            verse={record.verses.primary}
            label={t.primary}
          />

          {/* Related verses */}
          {record.verses.related.map((v, i) => (
            <ArabicBlock
              key={i}
              verse={v}
              label={`${t.related} · ${v.role ?? 'mutashabih'}`}
              dimmed
            />
          ))}

          {/* Explanations — order/prominence driven by lang toggle */}
          {lang === 'en' ? (
            <>
              {record.summary_en && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="verse-card rounded-xl p-4">
                  <div className="text-[10px] text-slate-500 mb-2.5 uppercase tracking-widest font-semibold">{t.explanation}</div>
                  <p className="text-sm text-slate-300 leading-relaxed">{record.summary_en}</p>
                </motion.div>
              )}
              {record.summary_ar && (
                <details className="verse-details rounded-xl overflow-hidden">
                  <summary className="verse-details-summary text-[10px] cursor-pointer transition-colors uppercase tracking-widest font-semibold px-4 py-3 flex items-center justify-between">
                    <span>الشرح بالعربية</span>
                    <span className="text-slate-600 text-xs">▾</span>
                  </summary>
                  <p className="arabic text-sm text-slate-300 leading-relaxed p-4" lang="ar" dir="rtl">{record.summary_ar}</p>
                </details>
              )}
            </>
          ) : (
            <>
              {record.summary_ar && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="verse-card verse-card-gold rounded-xl p-4">
                  <div className="verse-ar-heading text-[10px] mb-2.5 uppercase tracking-widest font-semibold arabic-ui">الشرح العلمي</div>
                  <p className="arabic text-sm text-slate-300 leading-relaxed" lang="ar" dir="rtl">{record.summary_ar}</p>
                </motion.div>
              )}
              {record.summary_en && (
                <details className="verse-details rounded-xl overflow-hidden">
                  <summary className="verse-details-summary text-[10px] cursor-pointer transition-colors uppercase tracking-widest font-semibold px-4 py-3 flex items-center justify-between">
                    <span>Scholarly Explanation</span>
                    <span className="text-slate-600 text-xs">▾</span>
                  </summary>
                  <p className="text-sm text-slate-300 leading-relaxed p-4">{record.summary_en}</p>
                </details>
              )}
            </>
          )}

          {/* Confidence + source */}
          <div className="verse-card rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">{t.confidence}</span>
              <span className="text-slate-300 font-semibold tabular-nums">{(confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="verse-progress-track w-full h-1 rounded-full overflow-hidden">
              <div
                className="verse-progress-fill h-full rounded-full transition-all"
                style={{
                  width: `${confidence * 100}%`,
                  ['--cat-color' as string]: color,
                  ['--cat-color-fade' as string]: `${color}80`,
                }}
              />
            </div>
            <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
              <span>{t.source}:</span>
              <span className="arabic-ui text-slate-500" lang="ar" dir="rtl">{record.source.book_title_ar}</span>
            </div>
          </div>

          {/* Feedback */}
          <div className="verse-feedback-wrap pt-1">
            <FeedbackWidget recordId={record.id} />
          </div>
        </div>
      </div>
    </>
  )
}
