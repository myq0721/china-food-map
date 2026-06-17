<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useRestaurants } from '@/composables/useRestaurants'
import { recommenderKey } from '@/types/restaurant'
import { formatDate } from '@/utils/slug'
import RecommenderLink from '@/components/RecommenderLink.vue'
import StarRating from '@/components/StarRating.vue'
import RestaurantGiscus from '@/components/RestaurantGiscus.vue'

const route = useRoute()
const id = computed(() => route.params.id as string)
const { getById, ensureLoaded } = useRestaurants()

onMounted(ensureLoaded)

const restaurant = computed(() => getById(id.value))
</script>

<template>
  <div v-if="restaurant" class="max-w-3xl">
    <RouterLink to="/" class="mb-4 inline-block text-sm text-brand hover:underline">← 返回</RouterLink>

    <header class="mb-6 rounded-xl border border-stone-200 bg-white p-6">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <h1 class="text-3xl font-bold text-stone-900">{{ restaurant.name }}</h1>
        <span class="rounded-full bg-brand/10 px-3 py-1 text-sm text-brand">{{ restaurant.city }}</span>
      </div>
      <div v-if="restaurant.averageRating" class="mt-2 flex items-center gap-2">
        <StarRating :rating="restaurant.averageRating" show-value />
        <span class="text-sm text-stone-500">综合推荐指数</span>
      </div>
      <p v-if="restaurant.cuisine?.length" class="mt-2 text-stone-600">
        {{ restaurant.cuisine.join(' · ') }}
      </p>
      <p v-if="restaurant.address" class="mt-2 text-sm text-stone-500">{{ restaurant.address }}</p>
      <p class="mt-3 text-sm text-stone-400">
        {{ restaurant.recommenderCount }} 位社区成员推荐
      </p>
    </header>

    <section class="space-y-4">
      <h2 class="text-xl font-semibold">推荐详情</h2>
      <article
        v-for="rec in restaurant.recommenders"
        :key="recommenderKey(rec)"
        class="rounded-xl border border-stone-200 bg-white p-5"
      >
        <div class="mb-3 flex flex-wrap items-center gap-3">
          <RecommenderLink :recommender="rec" show-platform />
          <span class="text-xs text-stone-400">{{ formatDate(rec.recommendedAt) }}</span>
          <StarRating v-if="rec.rating" :rating="rec.rating" size="sm" />
        </div>

        <p v-if="rec.ratingSummary" class="mb-1 text-sm font-medium text-stone-700">
          {{ rec.ratingSummary }}
        </p>

        <p v-if="rec.sourceVideoUrl" class="mb-3 text-sm">
          <a :href="rec.sourceVideoUrl" target="_blank" rel="noopener noreferrer" class="text-brand hover:underline">
            查看探店视频 →
          </a>
        </p>

        <p v-if="rec.reason && rec.reason !== rec.ratingSummary" class="mb-3 text-sm leading-relaxed text-stone-600">
          {{ rec.reason }}
        </p>

        <div v-if="rec.dishes?.length" class="mb-3">
          <h4 class="mb-1 text-sm font-medium text-stone-600">推荐菜</h4>
          <ul class="space-y-1 text-sm">
            <li v-for="dish in rec.dishes" :key="dish.name">
              {{ dish.name }}
              <span v-if="dish.price" class="text-stone-400">（{{ dish.price }}）</span>
            </li>
          </ul>
        </div>

        <div v-if="rec.comments?.length">
          <h4 class="mb-1 text-sm font-medium text-stone-600">评论</h4>
          <ul class="space-y-2 text-sm text-stone-600">
            <li v-for="(c, i) in rec.comments" :key="i">
              <span class="font-medium">{{ c.author }}：</span>{{ c.text }}
            </li>
          </ul>
        </div>
      </article>
    </section>

    <RestaurantGiscus :restaurant-id="restaurant.id" :restaurant-name="restaurant.name" />
  </div>

  <div v-else class="py-12 text-center text-stone-500">未找到该饭店</div>
</template>
