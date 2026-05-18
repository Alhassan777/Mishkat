import type { VerseRef } from '../../data/types'

interface Props {
  verse: VerseRef
  label: string
  dimmed?: boolean
}

export function ArabicBlock({ verse, label, dimmed }: Props) {
  const surahName = verse._auto_filled?.surah_name_en ?? `Surah ${verse.surah}`
  const surahNameAr = verse._auto_filled?.surah_name_ar ?? ''
  const score = verse._auto_filled?.verification_score
  const uthmani = verse._auto_filled?.text_uthmani_full

  return (
    <div className="rounded-2xl overflow-hidden" style={{
      background: dimmed ? 'rgba(255,255,255,0.018)' : 'rgba(201,168,76,0.025)',
      border: dimmed ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(201,168,76,0.12)',
    }}>
      {/* Reference line */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {verse.surah}:{verse.ayah}
          </span>
          {score !== undefined && score < 0.85 && (
            <span className="text-[10px] text-amber-500/70">⚠ {(score * 100).toFixed(0)}%</span>
          )}
        </div>
      </div>

      {/* Surah name */}
      <div className="flex items-center justify-between px-4 pb-2">
        <span className="text-[11px] text-slate-500 italic">{surahName}</span>
        {surahNameAr && (
          <span className="arabic-ui text-xs text-slate-400" lang="ar" dir="rtl">{surahNameAr}</span>
        )}
      </div>

      {/* Divider */}
      <div className="mx-4" style={{ height: '1px', background: dimmed ? 'rgba(255,255,255,0.04)' : 'rgba(201,168,76,0.07)' }} />

      {/* Arabic text */}
      <div className="px-4 pt-3 pb-4">
        {uthmani ? (
          <p
            className="arabic text-2xl text-slate-100 leading-loose text-right"
            lang="ar"
            dir="rtl"
          >
            {uthmani}
          </p>
        ) : (
          <p
            className="arabic text-xl text-slate-200 leading-loose text-right"
            lang="ar"
            dir="rtl"
          >
            {verse.text_snippet}
          </p>
        )}

        {/* Snippet highlighted */}
        {uthmani && verse.text_snippet && verse.text_snippet !== uthmani && (
          <p
            className="arabic text-sm text-[color:rgba(212,175,55,0.62)] mt-2 text-right leading-relaxed"
            lang="ar"
            dir="rtl"
          >
            <span className="text-slate-600 text-xs ml-2">المقطع: </span>
            {verse.text_snippet}
          </p>
        )}
      </div>
    </div>
  )
}
