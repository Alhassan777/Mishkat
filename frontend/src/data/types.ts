export type ParentDiscipline =
  | 'mutashabih_alfaz'
  | 'mutashabih_maani'
  | 'wujuh_nazair'
  | 'mushkil_quran'
  | 'modern_analysis'

export const DISCIPLINE_COLORS: Record<ParentDiscipline, string> = {
  mutashabih_alfaz: '#2196C9',
  mutashabih_maani: '#C43A3A',
  wujuh_nazair:     '#C9A84C',
  mushkil_quran:    '#3A5CC4',
  modern_analysis:  '#9C3FC4',
}

export const DISCIPLINE_LABELS: Record<ParentDiscipline, { ar: string; en: string }> = {
  mutashabih_alfaz: { ar: 'متشابه الألفاظ', en: 'Similar Wording' },
  mutashabih_maani: { ar: 'متشابه المعاني', en: 'Similar Meanings' },
  wujuh_nazair:     { ar: 'الوجوه والنظائر', en: 'Polysemy (Wujuh)' },
  mushkil_quran:    { ar: 'مشكل القرآن', en: 'Apparent Contradictions' },
  modern_analysis:  { ar: 'تحليل حديث', en: 'Modern Analysis' },
}

export type Category =
  | 'lexical'
  | 'structural'
  | 'cross_surah_refrain'
  | 'semantic'
  | 'thematic'
  | 'narrative'
  | 'doctrinal'

/*
  Islamic gemstone palette — each color maps to a stone or pigment
  used in historic Islamic jewelry, manuscripts, and architectural tilework.
  Brighter/more saturated than typical "dark mode" palettes because
  they sit on a deep emerald-green background, not black.
*/
export const CATEGORY_COLORS: Record<string, string> = {
  lexical:            '#2196C9',   // Faience blue — İznik tilework sky
  structural:         '#26A881',   // Malachite / Islamic turquoise glaze
  cross_surah_refrain:'#9C3FC4',   // Amethyst — Ottoman precious stone
  semantic:           '#C9A84C',   // Dhahab (gold) — Islamic gold ink
  thematic:           '#C43A3A',   // Carnelian / ʿAqīq — Prophet's ring stone
  narrative:          '#3A9C5A',   // Emerald — Zamurrud stone of paradise
  doctrinal:          '#3A5CC4',   // Lapis lazuli — Ultramarine of manuscripts
}

export const CATEGORY_LABELS: Record<string, { en: string; ar: string }> = {
  lexical:             { en: 'Lexical',             ar: 'تشابه ألفاظ' },
  structural:          { en: 'Structural',          ar: 'تشابه تراكيب' },
  cross_surah_refrain: { en: 'Cross-Surah Refrain', ar: 'تكرار بين السور' },
  semantic:            { en: 'Semantic',             ar: 'تشابه معاني' },
  thematic:            { en: 'Thematic',             ar: 'تشابه مواضيع' },
  narrative:           { en: 'Narrative',            ar: 'تشابه قصص' },
  doctrinal:           { en: 'Doctrinal',            ar: 'مسائل عقدية' },
}

export const CATEGORY_TOOLTIPS: Record<string, { en: string; ar: string }> = {
  lexical:             { en: 'Verses sharing the same or similar wording',                ar: 'آيات تتشابه في نفس الكلمات أو العبارات' },
  structural:          { en: 'Verses with similar grammatical patterns',                  ar: 'آيات لها نفس البناء النحوي أو نمط الجملة' },
  cross_surah_refrain: { en: 'Phrases or refrains repeated across different surahs',      ar: 'عبارات أو جمل تتكرر في سور مختلفة' },
  semantic:            { en: 'Verses with similar meaning but different wording',          ar: 'آيات بنفس المعنى لكن بكلمات مختلفة' },
  thematic:            { en: 'Verses discussing the same topic or theme',                 ar: 'آيات تتناول نفس الموضوع أو الفكرة' },
  narrative:           { en: 'The same story told in different places in the Quran',       ar: 'نفس القصة مذكورة في أكثر من موضع في القرآن' },
  doctrinal:           { en: 'Verses related to matters of creed and belief',             ar: 'آيات تتعلق بأمور العقيدة والإيمان' },
}

export function getCategoryLabel(cat: string, lang: 'ar' | 'en'): string {
  return CATEGORY_LABELS[cat]?.[lang] ?? CATEGORY_LABELS[cat]?.en ?? cat
}

export function getCategoryTooltip(cat: string, lang: 'ar' | 'en'): string {
  return CATEGORY_TOOLTIPS[cat]?.[lang] ?? CATEGORY_TOOLTIPS[cat]?.en ?? ''
}

export const CATEGORY_TO_DISCIPLINE: Record<Category, ParentDiscipline> = {
  lexical:            'mutashabih_alfaz',
  structural:         'mutashabih_alfaz',
  semantic:           'wujuh_nazair',
  thematic:           'mutashabih_maani',
  narrative:          'mutashabih_maani',
  doctrinal:          'mushkil_quran',
  cross_surah_refrain:'modern_analysis',
}

export interface AutoFilled {
  surah_name_ar: string
  surah_name_en: string
  text_uthmani_full: string
  juz: number
  hizb_quarter: number
  ayah_no_quran?: number
  verification_score: number
}

export interface VerseRef {
  surah: number
  ayah: number
  text_snippet: string
  role?: string
  relationship_direction?: string
  _auto_filled?: AutoFilled
}

export interface Source {
  book_id: string
  book_title_ar: string
  author_ar: string
  page_or_section?: string
  raw_text_snippet?: string
}

export interface MutashabihatRecord {
  id: string
  category: Category
  secondary_categories: Category[]
  subcategory?: string | null
  parent_discipline?: ParentDiscipline | null
  pair_keys?: string[]
  verses: {
    primary: VerseRef
    related: VerseRef[]
  }
  source: Source
  summary_ar?: string | null
  summary_en?: string | null
  confidence: number | null
  extraction_model?: string
  extraction_date?: string
  human_verified: boolean
  category_payload: Record<string, unknown>
}

// Graph node (one per unique surah:ayah)
export interface VerseNode {
  id: string           // "SURAH:AYAH"
  surah: number
  ayah: number
  surahNameEn: string
  surahNameAr: string
  uthmaniText: string
  degree: number       // number of connections
  categories: Set<Category>
  disciplines: Set<ParentDiscipline>
  recordIds: string[]  // records this node appears in
  // d3-force mutable fields
  x?: number; y?: number; z?: number
  vx?: number; vy?: number; vz?: number
  fx?: number | null; fy?: number | null; fz?: number | null
}

export type RelationshipDirection = 'bidirectional' | 'directed' | 'group'
export type RelationshipRole = 'mutashabih' | 'clarifying' | 'supporting' | 'contextual'

export interface RelationshipEdge {
  source: string   // node id
  target: string   // node id
  category: Category
  recordId: string
  confidence: number | null
  direction: RelationshipDirection
  role: RelationshipRole
}

export interface VersePairGroup {
  pairKey: string
  sourceNodeId: string
  targetNodeId: string
  records: MutashabihatRecord[]
  categories: Set<Category>
  books: Source[]
  maxConfidence: number
  recordCount: number
}

export interface DerivedData {
  records: MutashabihatRecord[]
  byId: Map<string, MutashabihatRecord>
  nodes: VerseNode[]
  nodeMap: Map<string, VerseNode>
  edges: RelationshipEdge[]
  bySurah: Map<number, VerseNode[]>
  books: { id: string; titleAr: string; authorAr: string }[]
  pairGroups: Map<string, VersePairGroup>
}

export interface FeedbackEntry {
  recordId: string
  vote: 'up' | 'down'
  note?: string
  timestamp: string
}

export interface SurahMeta {
  number: number
  nameAr: string
  nameEn: string
  nameTrans: string
  ayahCount: number
  revelationType: 'Meccan' | 'Medinan'
  juz: number
}
