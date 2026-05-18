import type { MutashabihatRecord, DerivedData, VerseNode, RelationshipEdge, Category, RelationshipDirection, RelationshipRole, VersePairGroup, Source } from './types'
import { CATEGORY_TO_DISCIPLINE } from './types'
import { SURAH_MAP } from './quranMeta'

function nodeId(surah: number, ayah: number) {
  return `${surah}:${ayah}`
}

function makePairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

export async function loadData(): Promise<DerivedData> {
  const res = await fetch('/data/ayah_graph.json')
  if (!res.ok) throw new Error(`Failed to load ayah graph: ${res.status}`)
  const graph = await res.json() as {
    nodes?: Record<string, {
      surah: number
      ayah: number
      surah_name_ar?: string | null
      surah_name_en?: string | null
      text_uthmani?: string | null
      text_snippet?: string | null
      juz?: number | null
      hizb_quarter?: number | null
      ayah_no_quran?: number | null
      connections?: Record<string, {
        target_surah: number
        target_ayah: number
        target_text_uthmani?: string | null
        target_text_snippet?: string | null
        opinions?: Array<{
          record_id?: string | null
          book_id?: string | null
          book_title_ar?: string | null
          author_ar?: string | null
          category?: string | null
          secondary_categories?: string[] | null
          subcategory?: string | null
          role?: string | null
          relationship_direction?: string | null
          summary_ar?: string | null
          summary_en?: string | null
          confidence?: number | null
          source_page?: string | null
        }>
      }>
    }>
  }

  const byId = new Map<string, MutashabihatRecord>()
  const nodeMap = new Map<string, VerseNode>()
  const edges: RelationshipEdge[] = []
  const records: MutashabihatRecord[] = []

  function ensureNode(surah: number, ayah: number, autoFilled?: {
    surah_name_en?: string; surah_name_ar?: string; text_uthmani_full?: string
  }): VerseNode {
    const id = nodeId(surah, ayah)
    if (!nodeMap.has(id)) {
      const meta = SURAH_MAP.get(surah)
      nodeMap.set(id, {
        id,
        surah,
        ayah,
        surahNameEn: autoFilled?.surah_name_en ?? meta?.nameEn ?? `Surah ${surah}`,
        surahNameAr: autoFilled?.surah_name_ar ?? meta?.nameAr ?? '',
        uthmaniText: autoFilled?.text_uthmani_full ?? '',
        degree: 0,
        categories: new Set(),
        disciplines: new Set(),
        recordIds: [],
      })
    }
    return nodeMap.get(id)!
  }

  const nodesObj = graph.nodes ?? {}

  for (const [srcKey, srcNode] of Object.entries(nodesObj)) {
    const pNode = ensureNode(srcNode.surah, srcNode.ayah, {
      surah_name_ar: srcNode.surah_name_ar ?? undefined,
      surah_name_en: srcNode.surah_name_en ?? undefined,
      text_uthmani_full: srcNode.text_uthmani ?? undefined,
    })
    if (!pNode.uthmaniText && srcNode.text_uthmani) pNode.uthmaniText = srcNode.text_uthmani

    const connections = srcNode.connections ?? {}
    for (const [tgtKey, conn] of Object.entries(connections)) {
      const rNode = ensureNode(conn.target_surah, conn.target_ayah, {
        text_uthmani_full: conn.target_text_uthmani ?? undefined,
      })
      if (!rNode.uthmaniText && conn.target_text_uthmani) rNode.uthmaniText = conn.target_text_uthmani

      for (const opinion of conn.opinions ?? []) {
        const rawCategory = (opinion.category ?? 'semantic') as string
        const category = (
          ['lexical', 'structural', 'cross_surah_refrain', 'semantic', 'thematic', 'narrative', 'doctrinal']
            .includes(rawCategory)
            ? rawCategory
            : 'semantic'
        ) as Category

        const direction = (
          opinion.relationship_direction === 'bidirectional'
            ? 'bidirectional'
            : opinion.relationship_direction === 'group'
              ? 'group'
              : 'directed'
        ) as RelationshipDirection

        const role = (
          opinion.role === 'clarifying' || opinion.role === 'supporting' || opinion.role === 'contextual'
            ? opinion.role
            : 'mutashabih'
        ) as RelationshipRole

        const baseRecordId = opinion.record_id ?? `opinion-${srcKey}-${tgtKey}`
        const recordId = `${baseRecordId}::${srcKey}->${tgtKey}`

        const source: Source = {
          book_id: opinion.book_id ?? 'unknown',
          book_title_ar: opinion.book_title_ar ?? 'Unknown Source',
          author_ar: opinion.author_ar ?? 'Unknown Author',
          page_or_section: opinion.source_page ?? undefined,
        }

        const record: MutashabihatRecord = {
          id: recordId,
          category,
          secondary_categories: (opinion.secondary_categories ?? []) as Category[],
          subcategory: opinion.subcategory ?? null,
          parent_discipline: CATEGORY_TO_DISCIPLINE[category] ?? 'modern_analysis',
          verses: {
            primary: {
              surah: srcNode.surah,
              ayah: srcNode.ayah,
              text_snippet: srcNode.text_snippet ?? srcKey,
              _auto_filled: {
                surah_name_ar: srcNode.surah_name_ar ?? '',
                surah_name_en: srcNode.surah_name_en ?? '',
                text_uthmani_full: srcNode.text_uthmani ?? '',
                juz: srcNode.juz ?? 0,
                hizb_quarter: srcNode.hizb_quarter ?? 0,
                ayah_no_quran: srcNode.ayah_no_quran ?? undefined,
                verification_score: 1,
              },
            },
            related: [
              {
                surah: conn.target_surah,
                ayah: conn.target_ayah,
                text_snippet: conn.target_text_snippet ?? tgtKey,
                role,
                relationship_direction: direction,
                _auto_filled: {
                  surah_name_ar: nodesObj[tgtKey]?.surah_name_ar ?? '',
                  surah_name_en: nodesObj[tgtKey]?.surah_name_en ?? '',
                  text_uthmani_full: conn.target_text_uthmani ?? '',
                  juz: nodesObj[tgtKey]?.juz ?? 0,
                  hizb_quarter: nodesObj[tgtKey]?.hizb_quarter ?? 0,
                  ayah_no_quran: nodesObj[tgtKey]?.ayah_no_quran ?? undefined,
                  verification_score: 1,
                },
              },
            ],
          },
          source,
          summary_ar: opinion.summary_ar ?? null,
          summary_en: opinion.summary_en ?? null,
          confidence: opinion.confidence ?? null,
          human_verified: false,
          category_payload: {},
        }

        records.push(record)
        byId.set(record.id, record)

        pNode.recordIds.push(record.id)
        pNode.categories.add(category)
        pNode.disciplines.add(record.parent_discipline ?? 'modern_analysis')

        rNode.recordIds.push(record.id)
        rNode.categories.add(category)
        rNode.disciplines.add(record.parent_discipline ?? 'modern_analysis')

        edges.push({
          source: srcKey,
          target: tgtKey,
          category,
          recordId: record.id,
          confidence: record.confidence,
          direction,
          role,
        })
        pNode.degree++
        rNode.degree++
      }
    }
  }

  const pairGroups = new Map<string, VersePairGroup>()
  for (const record of records) {
    const primary = record.verses.primary
    if (primary.surah == null || primary.ayah == null) continue
    for (const related of record.verses.related) {
      if (related.surah == null || related.ayah == null) continue
      const srcId = nodeId(primary.surah, primary.ayah)
      const tgtId = nodeId(related.surah, related.ayah)
      const pk = makePairKey(srcId, tgtId)
      if (!pairGroups.has(pk)) {
        pairGroups.set(pk, {
          pairKey: pk,
          sourceNodeId: srcId,
          targetNodeId: tgtId,
          records: [],
          categories: new Set(),
          books: [],
          maxConfidence: 0,
          recordCount: 0,
        })
      }
      const group = pairGroups.get(pk)!
      group.records.push(record)
      group.categories.add(record.category as Category)
      if (!group.books.some(b => b.book_id === record.source.book_id)) {
        group.books.push(record.source)
      }
      if ((record.confidence ?? 0) > group.maxConfidence) {
        group.maxConfidence = record.confidence ?? 0
      }
      group.recordCount = group.records.length
    }
  }

  const nodes = Array.from(nodeMap.values())

  const bySurah = new Map<number, VerseNode[]>()
  for (const node of nodes) {
    if (!bySurah.has(node.surah)) bySurah.set(node.surah, [])
    bySurah.get(node.surah)!.push(node)
  }

  const bookSet = new Map<string, { titleAr: string; authorAr: string }>()
  for (const r of records) {
    if (!bookSet.has(r.source.book_id))
      bookSet.set(r.source.book_id, { titleAr: r.source.book_title_ar, authorAr: r.source.author_ar })
  }
  const books = Array.from(bookSet.entries()).map(([id, v]) => ({ id, ...v }))

  return { records, byId, nodes, nodeMap, edges, bySurah, books, pairGroups }
}
