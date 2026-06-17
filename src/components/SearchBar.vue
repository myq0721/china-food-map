<script setup lang="ts">
import { useSearch } from '@/composables/useSearch'
import { useRouter } from 'vue-router'

const { query } = useSearch()
const router = useRouter()

function onSubmit() {
  if (query.value.trim()) {
    router.push({ path: '/', query: { q: query.value.trim() } })
  }
}
</script>

<template>
  <form class="relative" @submit.prevent="onSubmit">
    <input
      v-model="query"
      type="search"
      placeholder="搜索饭店、城市…"
      class="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
    />
  </form>
</template>
