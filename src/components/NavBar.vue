<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import SearchBar from './SearchBar.vue'
import { useGitHubAuth } from '@/composables/useGitHubAuth'
import { MAINTAINER_LOGIN } from '@/config'

const { user, isAuthenticated } = useGitHubAuth()

const links = computed(() => {
  const base = [
    { to: '/', label: '首页' },
    { to: '/cities', label: '城市' },
    { to: '/cuisines', label: '菜系' },
    { to: '/about', label: '关于' },
    { to: '/guestbook', label: '留言板' },
    { to: '/submit', label: '投稿' },
  ]
  if (isAuthenticated.value && user.value?.login === MAINTAINER_LOGIN) {
    base.push({ to: '/import', label: '导入' })
  }
  return base
})
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
      <RouterLink to="/" class="text-lg font-bold text-brand">
        中国食物地图
      </RouterLink>
      <nav class="flex flex-wrap gap-1">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="rounded-md px-3 py-1.5 text-sm text-stone-600 transition hover:bg-stone-100 hover:text-brand"
          active-class="!bg-brand/10 !text-brand font-medium"
        >
          {{ link.label }}
        </RouterLink>
      </nav>
      <div class="ml-auto w-full sm:w-64">
        <SearchBar />
      </div>
    </div>
  </header>
</template>
