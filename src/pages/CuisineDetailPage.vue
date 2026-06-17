<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import RestaurantCard from '@/components/RestaurantCard.vue'
import { useMeta } from '@/composables/useMeta'
import { useRestaurants } from '@/composables/useRestaurants'

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const { cuisines, ensureMetaLoaded } = useMeta()
const { restaurants, ensureLoaded } = useRestaurants()

onMounted(async () => {
  await Promise.all([ensureMetaLoaded(), ensureLoaded()])
})

const cuisine = computed(() => cuisines.value.find((c) => c.slug === slug.value))
const list = computed(() =>
  restaurants.value.filter((r) => cuisine.value && (r.cuisine ?? []).includes(cuisine.value.name)),
)
</script>

<template>
  <div>
    <header v-if="cuisine" class="mb-6">
      <h1 class="text-2xl font-bold">{{ cuisine.name }}</h1>
      <p class="mt-1 text-sm text-stone-500">{{ cuisine.description }}</p>
      <p class="mt-2 text-xs text-stone-400">共 {{ list.length }} 家推荐</p>
    </header>

    <div v-if="list.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <RestaurantCard v-for="r in list" :key="r.id" :restaurant="r" />
    </div>
    <div v-else class="py-12 text-center text-stone-500">该菜系暂无推荐</div>
  </div>
</template>
