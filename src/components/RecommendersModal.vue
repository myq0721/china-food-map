<script setup lang="ts">
import type { RestaurantIndexEntry } from '@/types/restaurant'
import { recommenderKey } from '@/types/restaurant'
import { formatDate } from '@/utils/slug'
import RecommenderLink from './RecommenderLink.vue'

defineProps<{
  restaurant: RestaurantIndexEntry
}>()

defineEmits<{
  close: []
}>()
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="$emit('close')">
    <div class="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold">{{ restaurant.name }} — 全部推荐者</h3>
        <button type="button" class="text-stone-400 hover:text-stone-600" @click="$emit('close')">✕</button>
      </div>
      <ul class="space-y-3">
        <li
          v-for="rec in restaurant.recommenders"
          :key="recommenderKey(rec)"
          class="rounded-lg border border-stone-100 p-3"
        >
          <RecommenderLink :recommender="rec" show-platform />
          <span class="ml-2 text-xs text-stone-400">{{ formatDate(rec.recommendedAt) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
