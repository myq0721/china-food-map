<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="prose prose-stone max-w-3xl">
    <h1>关于中国食物地图</h1>
    <p>
      中国食物地图是一个由社区共建的美食推荐项目。每个人都可以投稿自己认可的好饭店，
      数据存储在 GitHub 仓库中，完全开放透明。
    </p>

    <h2>共建规则</h2>
    <ul>
      <li>投稿须为真实就餐体验，禁止广告与虚假推荐</li>
      <li>推荐者支持 GitHub、Twitter、抖音、B站等平台</li>
      <li>投稿先进入待审核区，维护者审核 promote 后才展示</li>
      <li>同一推荐者（平台+ID）对同一饭店仅可推荐一次</li>
    </ul>

    <h2>推荐者平台</h2>
    <ul>
      <li><strong>GitHub</strong> — 登录后自动填充用户名</li>
      <li><strong>Twitter / X</strong> — 填写用户名，链接指向 x.com 主页</li>
      <li><strong>抖音 / B站</strong> — 可从维护者配置的博主列表选择，或手动填写</li>
    </ul>

    <h2>博主探店导入</h2>
    <p>
      维护者可在配置文件中指定抖音/B站博主，系统半自动拉取探店视频草稿，
      经人工确认后导入待审核区。
    </p>

    <h2>参与方式</h2>
    <p>
      <RouterLink to="/submit" class="text-brand hover:underline">点击投稿</RouterLink>
      填写表单并创建 Pull Request。
    </p>

    <h2>数据许可</h2>
    <p>本项目采用 Apache License 2.0 开源协议。</p>
  </div>
</template>

<style scoped>
.prose h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 1rem; }
.prose h2 { font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; }
.prose p, .prose li { color: #57534e; line-height: 1.7; }
.prose ul { padding-left: 1.25rem; list-style: disc; }
</style>
