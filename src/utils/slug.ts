import { pinyin } from 'pinyin-pro'

function toSlugPart(text: string): string {
  const normalized = text.trim().replace(/\s+/g, '')
  const py = pinyin(normalized, { toneType: 'none', type: 'array' }).join('')
  const slug = py
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'unknown'
}

export function buildRestaurantId(city: string, name: string): string {
  return `${toSlugPart(city)}-${toSlugPart(name)}`
}

export function normalizeKey(city: string, name: string): string {
  return `${city.trim().toLowerCase()}::${name.trim().toLowerCase()}`
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
