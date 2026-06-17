<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import RestaurantCard from '@/components/RestaurantCard.vue'
import { useRestaurants } from '@/composables/useRestaurants'

const route = useRoute()
const cityName = computed(() => decodeURIComponent(route.params.city as string))
const { filterByCity, ensureLoaded } = useRestaurants()

onMounted(ensureLoaded)

const list = computed(() => filterByCity(cityName.value))
</script>

<template>
  <div>
    <header class="mb-6">
      <h1 class="text-2xl font-bold">{{ cityName }}</h1>
      <p class="mt-1 text-sm text-stone-500">共 {{ list.length }} 家推荐饭店</p>
    </header>

    <div v-if="list.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <RestaurantCard v-for="r in list" :key="r.id" :restaurant="r" />
    </div>
    <div v-else class="py-12 text-center text-stone-500">该城市暂无推荐，欢迎投稿！</div>
  </div>
</template>
