<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useRestaurants } from '@/composables/useRestaurants'
import { useMeta } from '@/composables/useMeta'

const { restaurants, ensureLoaded } = useRestaurants()
const { hotCities, ensureMetaLoaded } = useMeta()

onMounted(async () => {
  await Promise.all([ensureLoaded(), ensureMetaLoaded()])
})

const cityStats = computed(() =>
  hotCities.value.map((city) => ({
    ...city,
    count: restaurants.value.filter((r) => r.city === city.name).length,
  })),
)
</script>

<template>
  <div>
    <header class="mb-6">
      <h1 class="text-2xl font-bold">热门城市</h1>
      <p class="mt-1 text-sm text-stone-500">探索不同城市的美食推荐</p>
    </header>

    <div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      <RouterLink
        v-for="city in cityStats"
        :key="city.slug"
        :to="{ path: `/cities/${encodeURIComponent(city.name)}` }"
        class="rounded-xl border border-stone-200 bg-white p-4 text-center transition hover:border-brand hover:shadow-md"
      >
        <div class="text-lg font-semibold text-stone-900">{{ city.name }}</div>
        <div class="mt-1 text-sm text-stone-500">{{ city.count }} 家推荐</div>
      </RouterLink>
    </div>
  </div>
</template>
