<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { RestaurantIndexEntry } from '@/types/restaurant'
import { recommenderKey } from '@/types/restaurant'
import RecommendersModal from './RecommendersModal.vue'
import RecommenderLink from './RecommenderLink.vue'
import StarRating from './StarRating.vue'

defineProps<{
  restaurant: RestaurantIndexEntry
}>()

const showModal = ref(false)
</script>

<template>
  <article class="flex flex-col rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition hover:shadow-md">
    <RouterLink :to="`/r/${restaurant.id}`" class="group flex-1">
      <div class="mb-2 flex items-start justify-between gap-2">
        <h3 class="text-lg font-semibold text-stone-900 group-hover:text-brand">
          {{ restaurant.name }}
        </h3>
        <div class="flex shrink-0 flex-col items-end gap-1">
          <span class="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">
            {{ restaurant.city }}
          </span>
          <StarRating
            v-if="restaurant.averageRating"
            :rating="restaurant.averageRating"
            size="sm"
            show-value
          />
        </div>
      </div>
      <p v-if="restaurant.cuisine?.length" class="mb-2 text-xs text-stone-500">
        {{ restaurant.cuisine.join(' · ') }}
      </p>
      <p v-if="restaurant.address" class="mb-3 line-clamp-1 text-sm text-stone-500">
        {{ restaurant.address }}
      </p>
    </RouterLink>

    <div class="mt-auto border-t border-stone-100 pt-3 text-sm text-stone-600">
      <span class="text-stone-400">推荐：</span>
      <template v-for="(rec, i) in restaurant.recommenders.slice(0, 3)" :key="recommenderKey(rec)">
        <RecommenderLink :recommender="rec" show-platform />
        <span v-if="i < Math.min(2, restaurant.recommenders.length - 1)">、</span>
      </template>
      <button
        v-if="restaurant.recommenders.length > 3"
        type="button"
        class="ml-1 text-brand hover:underline"
        @click="showModal = true"
      >
        等 {{ restaurant.recommenderCount }} 人推荐
      </button>
      <span v-else-if="restaurant.recommenderCount > 1" class="ml-1 text-stone-400">
        共 {{ restaurant.recommenderCount }} 人推荐
      </span>
    </div>

    <RecommendersModal
      v-if="showModal"
      :restaurant="restaurant"
      @close="showModal = false"
    />
  </article>
</template>
