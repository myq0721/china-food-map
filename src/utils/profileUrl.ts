import type { Platform, Recommender } from '@/types/restaurant'

export function normalizeAuthorId(platform: Platform, authorId: string): string {
  const id = authorId.trim()
  if (platform === 'twitter') return id.replace(/^@/, '')
  return id
}

export function buildProfileUrl(
  platform: Platform,
  authorId: string,
  explicitUrl?: string,
): string | undefined {
  if (explicitUrl?.trim()) return explicitUrl.trim()
  const id = normalizeAuthorId(platform, authorId)
  switch (platform) {
    case 'github':
      return `https://github.com/${id}`
    case 'twitter':
      return `https://x.com/${id}`
    case 'bilibili':
      return `https://space.bilibili.com/${id}`
    case 'douyin':
      return `https://www.douyin.com/user/${id}`
    default:
      return undefined
  }
}

export function getRecommenderProfileUrl(rec: Recommender): string | undefined {
  return buildProfileUrl(rec.platform, rec.authorId, rec.profileUrl)
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  github: 'GitHub',
  twitter: 'Twitter / X',
  douyin: '抖音',
  bilibili: 'Bilibili',
}
