import { ref, computed } from 'vue'
import type { RestaurantIndex, RestaurantIndexEntry } from '@/types/restaurant'
import { DATA_BASE } from '@/config'

const index = ref<RestaurantIndex | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

let loadPromise: Promise<void> | null = null

async function fetchIndex(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const res = await fetch(`${DATA_BASE}/index.json`)
    if (!res.ok) throw new Error(`加载数据失败 (${res.status})`)
    index.value = await res.json()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '未知错误'
  } finally {
    loading.value = false
  }
}

export function useRestaurants() {
  const ensureLoaded = () => {
    if (!loadPromise) {
      loadPromise = fetchIndex()
    }
    return loadPromise
  }

  const restaurants = computed(() => index.value?.restaurants ?? [])

  const getById = (id: string): RestaurantIndexEntry | undefined =>
    restaurants.value.find((r) => r.id === id)

  const filterByCity = (city: string) =>
    restaurants.value.filter((r) => r.city === city)

  const filterByCuisine = (cuisine: string) =>
    restaurants.value.filter((r) => (r.cuisine ?? ['未分类']).includes(cuisine))

  const latestRestaurants = computed(() =>
    [...restaurants.value].sort((a, b) =>
      b.latestRecommendedAt.localeCompare(a.latestRecommendedAt),
    ),
  )

  const allCities = computed(() => {
    const set = new Set(restaurants.value.map((r) => r.city))
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  })

  const allCuisines = computed(() => {
    const set = new Set<string>()
    for (const r of restaurants.value) {
      for (const c of r.cuisine ?? ['未分类']) set.add(c)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  })

  return {
    index,
    loading,
    error,
    restaurants,
    latestRestaurants,
    allCities,
    allCuisines,
    ensureLoaded,
    getById,
    filterByCity,
    filterByCuisine,
  }
}
