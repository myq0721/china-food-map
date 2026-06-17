import { ref } from 'vue'
import { DATA_BASE } from '@/config'
import type { CuratedCreator } from '@/types/restaurant'

export interface HotCity {
  name: string
  slug: string
}

export interface CuisineMeta {
  name: string
  slug: string
  description: string
}

const hotCities = ref<HotCity[]>([])
const cuisines = ref<CuisineMeta[]>([])
const curatedCreators = ref<CuratedCreator[]>([])
let loaded = false

export function useMeta() {
  async function ensureMetaLoaded() {
    if (loaded) return
    const [citiesRes, cuisinesRes, creatorsRes] = await Promise.all([
      fetch(`${DATA_BASE}/meta/hot-cities.json`),
      fetch(`${DATA_BASE}/meta/cuisines.json`),
      fetch(`${DATA_BASE}/meta/curated-creators.json`).catch(() => null),
    ])
    hotCities.value = await citiesRes.json()
    cuisines.value = await cuisinesRes.json()
    if (creatorsRes?.ok) {
      curatedCreators.value = await creatorsRes.json()
    }
    loaded = true
  }

  return { hotCities, cuisines, curatedCreators, ensureMetaLoaded }
}
