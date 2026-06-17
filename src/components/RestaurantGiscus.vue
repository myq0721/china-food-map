<script setup lang="ts">
import { computed } from 'vue'
import GiscusComment from '@/components/GiscusComment.vue'

const props = defineProps<{
  restaurantId: string
  restaurantName: string
}>()

const term = computed(() => `restaurant:${props.restaurantId}`)
</script>

<template>
  <section class="mt-10 rounded-xl border border-stone-200 bg-white p-6">
    <h2 class="mb-2 text-xl font-semibold">评论区</h2>
    <p class="mb-4 text-sm text-stone-500">
      去过 {{ restaurantName }}？欢迎分享体验（需 GitHub 账号登录 Giscus）。
    </p>
    <GiscusComment :term="term" :title="`${restaurantName} - 中国食物地图`" />
  </section>
</template>
