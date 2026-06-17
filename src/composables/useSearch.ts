import { ref, computed } from 'vue'
import Fuse from 'fuse.js'
import type { RestaurantIndexEntry } from '@/types/restaurant'
import { useRestaurants } from './useRestaurants'

const query = ref('')

export function useSearch() {
  const { restaurants } = useRestaurants()

  const fuse = computed(
    () =>
      new Fuse(restaurants.value, {
        keys: ['name', 'city', 'cuisine', 'address'],
        threshold: 0.35,
      }),
  )

  const results = computed<RestaurantIndexEntry[]>(() => {
    const q = query.value.trim()
    if (!q) return restaurants.value
    return fuse.value.search(q).map((r) => r.item)
  })

  return { query, results }
}
