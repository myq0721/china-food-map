<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import Sidebar from '@/components/Sidebar.vue'

const route = useRoute()
const showSidebar = computed(() => !['submit', 'guestbook', 'about', 'import'].includes(route.name as string))
</script>

<template>
  <div class="min-h-screen bg-surface">
    <NavBar />
    <div class="mx-auto flex max-w-7xl gap-6 px-4 py-6">
      <div v-if="showSidebar" class="hidden w-56 shrink-0 lg:block">
        <Sidebar />
      </div>
      <main class="min-w-0 flex-1">
        <RouterView />
      </main>
    </div>
  </div>
</template>
