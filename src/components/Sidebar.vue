<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRestaurants } from '@/composables/useRestaurants'
import { useMeta } from '@/composables/useMeta'

const route = useRoute()
const router = useRouter()
const { allCities, allCuisines } = useRestaurants()
const { hotCities, cuisines } = useMeta()

const currentCity = computed(() => route.query.city as string | undefined)
const currentCuisine = computed(() => route.query.cuisine as string | undefined)

function setFilter(key: 'city' | 'cuisine', value: string | null) {
  const query = { ...route.query }
  if (value) query[key] = value
  else delete query[key]
  router.push({ path: route.path, query })
}
</script>

<template>
  <aside class="space-y-6">
    <section>
      <h3 class="mb-2 text-sm font-semibold text-stone-800">热门城市</h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="city in hotCities"
          :key="city.slug"
          type="button"
          class="rounded-full border px-3 py-1 text-xs transition"
          :class="
            currentCity === city.name
              ? 'border-brand bg-brand text-white'
              : 'border-stone-200 bg-white text-stone-600 hover:border-brand hover:text-brand'
          "
          @click="setFilter('city', currentCity === city.name ? null : city.name)"
        >
          {{ city.name }}
        </button>
      </div>
    </section>

    <section>
      <h3 class="mb-2 text-sm font-semibold text-stone-800">全部城市</h3>
      <div class="max-h-40 space-y-1 overflow-y-auto text-sm">
        <button
          v-for="city in allCities"
          :key="city"
          type="button"
          class="block w-full rounded px-2 py-1 text-left text-stone-600 hover:bg-stone-100"
          :class="{ 'bg-brand/10 text-brand': currentCity === city }"
          @click="setFilter('city', currentCity === city ? null : city)"
        >
          {{ city }}
        </button>
      </div>
    </section>

    <section>
      <h3 class="mb-2 text-sm font-semibold text-stone-800">菜系</h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="c in cuisines"
          :key="c.slug"
          type="button"
          class="rounded-full border px-3 py-1 text-xs transition"
          :class="
            currentCuisine === c.name
              ? 'border-brand bg-brand text-white'
              : 'border-stone-200 bg-white text-stone-600 hover:border-brand hover:text-brand'
          "
          @click="setFilter('cuisine', currentCuisine === c.name ? null : c.name)"
        >
          {{ c.name }}
        </button>
      </div>
      <div class="mt-2 max-h-32 space-y-1 overflow-y-auto text-sm">
        <button
          v-for="c in allCuisines"
          :key="c"
          type="button"
          class="block w-full rounded px-2 py-1 text-left text-stone-600 hover:bg-stone-100"
          :class="{ 'bg-brand/10 text-brand': currentCuisine === c }"
          @click="setFilter('cuisine', currentCuisine === c ? null : c)"
        >
          {{ c }}
        </button>
      </div>
    </section>
  </aside>
</template>
