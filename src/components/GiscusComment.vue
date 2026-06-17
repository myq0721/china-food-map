<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import {
  GISCUS_REPO,
  GISCUS_REPO_ID,
  GISCUS_CATEGORY,
  GISCUS_CATEGORY_ID,
} from '@/config'

const containerId = 'giscus-container'

onMounted(() => {
  if (document.getElementById('giscus-script')) return

  const script = document.createElement('script')
  script.id = 'giscus-script'
  script.src = 'https://giscus.app/client.js'
  script.setAttribute('data-repo', GISCUS_REPO)
  script.setAttribute('data-repo-id', GISCUS_REPO_ID)
  script.setAttribute('data-category', GISCUS_CATEGORY)
  script.setAttribute('data-category-id', GISCUS_CATEGORY_ID)
  script.setAttribute('data-mapping', 'pathname')
  script.setAttribute('data-strict', '0')
  script.setAttribute('data-reactions-enabled', '1')
  script.setAttribute('data-emit-metadata', '0')
  script.setAttribute('data-input-position', 'top')
  script.setAttribute('data-theme', 'light')
  script.setAttribute('data-lang', 'zh-CN')
  script.setAttribute('data-loading', 'lazy')
  script.crossOrigin = 'anonymous'
  script.async = true

  const container = document.getElementById(containerId)
  if (container) container.appendChild(script)
})

onUnmounted(() => {
  const script = document.getElementById('giscus-script')
  script?.remove()
  const container = document.getElementById(containerId)
  if (container) container.innerHTML = ''
})
</script>

<template>
  <div>
    <div v-if="!GISCUS_REPO_ID" class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      留言板尚未配置。请在仓库 Settings 启用 Discussions，并在
      <a href="https://giscus.app" target="_blank" rel="noopener" class="underline">giscus.app</a>
      获取配置后设置环境变量 <code>VITE_GISCUS_REPO_ID</code> 与 <code>VITE_GISCUS_CATEGORY_ID</code>。
    </div>
    <div :id="containerId" class="giscus mt-4" />
  </div>
</template>
