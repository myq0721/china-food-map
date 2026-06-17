<script setup lang="ts">
import GiscusComment from '@/components/GiscusComment.vue'
</script>

<template>
  <div class="max-w-3xl">
    <header class="mb-6">
      <h1 class="text-2xl font-bold">留言板</h1>
      <p class="mt-1 text-sm text-stone-500">欢迎留下建议、反馈或闲聊，需 GitHub 账号登录 Giscus 后留言。</p>
    </header>
    <GiscusComment />
  </div>
</template>
