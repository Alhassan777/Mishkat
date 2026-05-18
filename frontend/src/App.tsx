import { Suspense, useEffect, useRef, useState } from 'react'
import { loadData } from './data/loader'
import type { Category, DerivedData } from './data/types'
import { useStore } from './store'
import { CosmicGraph } from './components/CosmicGraph/CosmicGraph'
import { VerseDetail } from './components/VerseDetail/VerseDetail'
import { EntryBrowser } from './components/EntryBrowser/EntryBrowser'
import { Shell } from './components/Layout/Shell'

export default function App() {
  const [data, setData] = useState<DerivedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const view = useStore(s => s.view)
  const lang = useStore(s => s.lang)
  const filters = useStore(s => s.filters)
  const focusedNodeId = useStore(s => s.focusedNodeId)
  const urlHydrated = useRef(false)

  useEffect(() => {
    loadData()
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang === 'ar' ? 'ar' : 'en'
  }, [lang])

  useEffect(() => {
    if (!data || urlHydrated.current) return
    const params = new URLSearchParams(window.location.search)
    const categoryParam = params.get('category')
    const focusParam = params.get('focus')
    const searchParam = params.get('q')

    if (categoryParam) {
      const categories = categoryParam.split(',').filter(Boolean)
      useStore.getState().setFilter('categories', categories as Category[])
    }
    if (searchParam) useStore.getState().setFilter('searchQuery', searchParam)

    const sf = Number(params.get('sf'))
    const st = Number(params.get('st'))
    const af = Number(params.get('af'))
    const at = Number(params.get('at'))
    const mc = Number(params.get('mc'))
    if (!Number.isNaN(sf) && sf >= 1 && sf <= 114) useStore.getState().setFilter('surahFrom', sf)
    if (!Number.isNaN(st) && st >= 1 && st <= 114) useStore.getState().setFilter('surahTo', st)
    if (!Number.isNaN(af) && af >= 1 && af <= 286) useStore.getState().setFilter('ayahFrom', af)
    if (!Number.isNaN(at) && at >= 1 && at <= 286) useStore.getState().setFilter('ayahTo', at)
    if (!Number.isNaN(mc) && mc >= 0 && mc <= 1) useStore.getState().setFilter('minConfidence', mc)

    if (focusParam) {
      const record = data.records.find(r =>
        `${r.verses.primary.surah}:${r.verses.primary.ayah}` === focusParam
        || r.verses.related.some(v => `${v.surah}:${v.ayah}` === focusParam)
      )
      if (record) useStore.getState().focusRecord(record)
    }
    urlHydrated.current = true
  }, [data])

  useEffect(() => {
    if (!urlHydrated.current) return
    const params = new URLSearchParams(window.location.search)
    if (filters.categories.length > 0) params.set('category', filters.categories.join(','))
    else params.delete('category')
    if (filters.searchQuery) params.set('q', filters.searchQuery)
    else params.delete('q')
    params.set('sf', String(filters.surahFrom))
    params.set('st', String(filters.surahTo))
    params.set('af', String(filters.ayahFrom))
    params.set('at', String(filters.ayahTo))
    params.set('mc', filters.minConfidence.toFixed(2))
    if (focusedNodeId) params.set('focus', focusedNodeId)
    else params.delete('focus')
    const next = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState({}, '', next)
  }, [filters, focusedNodeId])

  if (error) return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-center rounded-2xl p-8 max-w-sm" style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div className="text-2xl mb-3">⚠</div>
        <div className="text-slate-200 font-medium mb-1.5">
          {lang === 'ar' ? 'فشل تحميل بيانات الآيات' : 'Failed to load verse data'}
        </div>
        <div className="text-sm text-slate-500 mb-1">{error}</div>
        <div className="text-xs text-slate-600">
          {lang === 'ar'
            ? 'تأكد أن خادم التطوير يعمل من مجلد frontend/'
            : 'Make sure the dev server is running from the frontend/ directory'}
        </div>
      </div>
    </div>
  )

  if (!data) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-full border border-[var(--gold)] opacity-20 animate-ping" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-2 rounded-full border border-[var(--gold)] opacity-40 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
          <span className="text-[var(--gold)] font-bold text-3xl z-10" style={{ fontFamily: 'var(--font-arabic)' }}>آ</span>
        </div>
        <div>
          <div className="text-[var(--text-primary)] text-sm font-medium mb-1 tracking-wide">
            {lang === 'ar' ? 'جاري تحميل شبكة الآيات' : 'Loading The Infinite Ink'}
          </div>
          <div className="text-[var(--text-muted)] text-xs tracking-wider uppercase">
            {lang === 'ar' ? 'جاري تجهيز بحر المعرفة…' : 'Preparing the sea of knowledge…'}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="bg-geometric" />
      <div className="nebula" />
      <div className="mishkah-vignette" />
      <div className="nur-particles" />

      <Shell data={data}>
        <Suspense fallback={null}>
          {view === 'graph' && <CosmicGraph data={data} />}
          {view === 'browse' && <EntryBrowser data={data} />}
        </Suspense>
      </Shell>

      <VerseDetail data={data} />
    </div>
  )
}
