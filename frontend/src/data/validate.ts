/**
 * Runtime schema validation for MutashabihatRecord.
 *
 * Auto-generated from Python Pydantic models via `python -m mutashabihat.generate_schema`.
 * Provides a lightweight check that loaded JSON records match the expected shape.
 */

import type { MutashabihatRecord } from './types'

const REQUIRED_FIELDS: (keyof MutashabihatRecord)[] = [
  'id', 'category', 'verses', 'source'
]

export function validateRecord(raw: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: ['Record is not an object'] }
  }

  const rec = raw as Record<string, unknown>

  for (const field of REQUIRED_FIELDS) {
    if (!(field in rec) || rec[field] === undefined) {
      errors.push(`Missing required field: ${field}`)
    }
  }

  if (typeof rec.id !== 'string') {
    errors.push(`id must be a string, got ${typeof rec.id}`)
  }

  if (typeof rec.category !== 'string') {
    errors.push(`category must be a string, got ${typeof rec.category}`)
  }

  if (rec.confidence !== null && rec.confidence !== undefined && typeof rec.confidence !== 'number') {
    errors.push(`confidence must be a number or null, got ${typeof rec.confidence}`)
  }

  if (rec.verses && typeof rec.verses === 'object') {
    const verses = rec.verses as Record<string, unknown>
    if (!verses.primary || typeof verses.primary !== 'object') {
      errors.push('verses.primary is required and must be an object')
    } else {
      const primary = verses.primary as Record<string, unknown>
      if (typeof primary.surah !== 'number') {
        errors.push(`verses.primary.surah must be a number, got ${typeof primary.surah}`)
      }
      if (typeof primary.ayah !== 'number') {
        errors.push(`verses.primary.ayah must be a number, got ${typeof primary.ayah}`)
      }
    }
    if (!Array.isArray(verses.related)) {
      errors.push('verses.related must be an array')
    }
  }

  if (rec.source && typeof rec.source === 'object') {
    const source = rec.source as Record<string, unknown>
    if (typeof source.book_id !== 'string') {
      errors.push(`source.book_id must be a string, got ${typeof source.book_id}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

export function validateRecords(records: unknown[]): {
  valid: number
  invalid: number
  errors: Array<{ index: number; errors: string[] }>
} {
  let valid = 0
  let invalid = 0
  const allErrors: Array<{ index: number; errors: string[] }> = []

  for (let i = 0; i < records.length; i++) {
    const result = validateRecord(records[i])
    if (result.valid) {
      valid++
    } else {
      invalid++
      allErrors.push({ index: i, errors: result.errors })
    }
  }

  return { valid, invalid, errors: allErrors }
}
