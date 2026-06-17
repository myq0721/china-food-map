<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import RestaurantCard from '@/components/RestaurantCard.vue'
import Sidebar from '@/components/Sidebar.vue'
import { useRestaurants } from '@/composables/useRestaurants'
import { useSearch } from '@/composables/useSearch'
import { useMeta } from '@/composables/useMeta'

const route = useRoute()
const { latestRestaurants, loading, error, ensureLoaded } = useRestaurants()
const { results, query } = useSearch()
const { ensureMetaLoaded } = useMeta()

onMounted(async () => {
  await Promise.all([ensureLoaded(), ensureMetaLoaded()])
})

watch(
  () => route.query.q,
  (q) => {
    if (typeof q === 'string') query.value = q
  },
  { immediate: true },
)

const displayed = computed(() => {
  let list = results.value.length && query.value.trim() ? results.value : latestRestaurants.value
  const city = route.query.city as string | undefined
  const cuisine = route.query.cuisine as string | undefined
  if (city) list = list.filter((r) => r.city === city)
  if (cuisine) list = list.filter((r) => (r.cuisine ?? ['未分类']).includes(cuisine))
  return list
})
</script>

<template>
  <div>
    <div class="mb-6 lg:hidden">
      <Sidebar />
    </div>

    <header class="mb-6">
      <h1 class="text-2xl font-bold text-stone-900">最新推荐</h1>
      <p class="mt-1 text-sm text-stone-500">社区共建的中国大陆美食推荐</p>
    </header>

    <div v-if="loading" class="py-12 text-center text-stone-500">加载中…</div>
    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
      {{ error }}
    </div>
    <div
      v-else-if="displayed.length"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <RestaurantCard
        v-for="r in displayed"
        :key="r.id"
        :restaurant="r"
      />
    </div>
    <div v-else class="py-12 text-center text-stone-500">暂无匹配的饭店推荐</div>
  </div>
</template>
