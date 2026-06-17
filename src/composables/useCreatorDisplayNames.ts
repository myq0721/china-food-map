import { ref, computed } from 'vue'
import type { CuratedCreator, Platform } from '@/types/restaurant'

const creators = ref<CuratedCreator[]>([])
let loaded = false

export function useCreatorDisplayNames() {
  async function ensureLoaded() {
    if (loaded) return
    try {
      const base = import.meta.env.BASE_URL
      const res = await fetch(`${base}data/meta/curated-creators.json`)
      if (res.ok) creators.value = await res.json()
    } catch {
      creators.value = []
    }
    loaded = true
  }

  function getDisplayName(platform: Platform, authorId: string, explicit?: string): string {
    if (explicit?.trim()) return explicit.trim()
    const hit = creators.value.find(
      (c) => c.platform === platform && c.authorId === authorId,
    )
    return hit?.displayName ?? authorId
  }

  return { ensureLoaded, getDisplayName, creators: computed(() => creators.value) }
}
