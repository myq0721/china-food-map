<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useMeta } from '@/composables/useMeta'
import { useRestaurants } from '@/composables/useRestaurants'

const { cuisines, ensureMetaLoaded } = useMeta()
const { restaurants, ensureLoaded } = useRestaurants()

onMounted(async () => {
  await Promise.all([ensureMetaLoaded(), ensureLoaded()])
})

const cuisineStats = computed(() =>
  cuisines.value.map((c) => ({
    ...c,
    count: restaurants.value.filter((r) => (r.cuisine ?? []).includes(c.name)).length,
  })),
)
</script>

<template>
  <div>
    <header class="mb-6">
      <h1 class="text-2xl font-bold">八大菜系</h1>
      <p class="mt-1 text-sm text-stone-500">按菜系探索美食推荐</p>
    </header>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="c in cuisineStats"
        :key="c.slug"
        :to="`/cuisines/${c.slug}`"
        class="rounded-xl border border-stone-200 bg-white p-5 transition hover:border-brand hover:shadow-md"
      >
        <h2 class="text-lg font-semibold text-stone-900">{{ c.name }}</h2>
        <p class="mt-2 text-sm text-stone-500">{{ c.description }}</p>
        <p class="mt-3 text-xs text-brand">{{ c.count }} 家相关推荐</p>
      </RouterLink>
    </div>
  </div>
</template>
