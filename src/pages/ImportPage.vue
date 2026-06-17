<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useGitHubAuth } from '@/composables/useGitHubAuth'
import { buildPendingSubmission, submitBatchPendingPR } from '@/composables/useSubmit'
import { DATA_BASE, MAINTAINER_LOGIN } from '@/config'
import type { ImportDraftItem, ImportDrafts, Platform, SubmitFormData } from '@/types/restaurant'
import { PLATFORM_LABELS } from '@/utils/profileUrl'
import { randomUUID } from '@/utils/uuid'

const { user, isAuthenticated, loginWithDeviceFlow, loginWithPat, logout, octokit } = useGitHubAuth()

const drafts = ref<ImportDraftItem[]>([])
const loading = ref(true)
const error = ref('')
const successUrl = ref('')
const submitting = ref(false)
const patInput = ref('')

const manualDraft = ref({
  platform: 'douyin' as Platform,
  videoUrl: '',
  videoTitle: '',
  suggestedCity: '',
  suggestedName: '',
  creatorAuthorId: '',
  creatorDisplayName: '',
})

const isMaintainer = computed(
  () => isAuthenticated.value && user.value?.login === MAINTAINER_LOGIN,
)

const selectedIds = ref<Set<string>>(new Set())

onMounted(loadDrafts)

async function loadDrafts() {
  loading.value = true
  try {
    const res = await fetch(`${DATA_BASE}/imports/drafts.json`)
    const data: ImportDrafts = await res.json()
    drafts.value = (data.items ?? []).filter((i) => i.status === 'draft')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载草稿失败'
  } finally {
    loading.value = false
  }
}

function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
}

function addManualDraft() {
  if (!manualDraft.value.videoUrl.trim()) {
    error.value = '请填写视频链接'
    return
  }
  drafts.value.unshift({
    id: randomUUID(),
    creatorAuthorId: manualDraft.value.creatorAuthorId || 'manual',
    creatorDisplayName: manualDraft.value.creatorDisplayName || '手动添加',
    platform: manualDraft.value.platform,
    videoTitle: manualDraft.value.videoTitle || manualDraft.value.videoUrl,
    videoUrl: manualDraft.value.videoUrl.trim(),
    suggestedCity: manualDraft.value.suggestedCity,
    suggestedName: manualDraft.value.suggestedName,
    status: 'draft',
  })
  manualDraft.value.videoUrl = ''
  manualDraft.value.videoTitle = ''
  error.value = ''
}

function draftToForm(draft: ImportDraftItem): SubmitFormData {
  return {
    city: draft.suggestedCity ?? '',
    name: draft.suggestedName ?? '',
    cuisine: [],
    address: '',
    dishes: [],
    reason: draft.videoTitle,
    comments: [],
    platform: draft.platform,
    authorId: draft.creatorAuthorId,
    profileUrl: '',
    sourceVideoUrl: draft.videoUrl,
  }
}

async function handleImport() {
  error.value = ''
  if (!octokit.value || !isMaintainer.value) {
    error.value = '请使用维护者账号登录 GitHub'
    return
  }

  const selected = drafts.value.filter((d) => selectedIds.value.has(d.id))
  if (!selected.length) {
    error.value = '请至少选择一条草稿'
    return
  }

  for (const d of selected) {
    if (!d.suggestedCity?.trim() || !d.suggestedName?.trim()) {
      error.value = `请补全「${d.videoTitle}」的城市和店名`
      return
    }
  }

  submitting.value = true
  try {
    const submissions = selected.map((d) => buildPendingSubmission(draftToForm(d)))
    const url = await submitBatchPendingPR(
      octokit.value,
      submissions,
      `[导入] 博主探店 ${selected.length} 条`,
    )
    successUrl.value = url
  } catch (e) {
    error.value = e instanceof Error ? e.message : '导入失败'
  } finally {
    submitting.value = false
  }
}

async function handleLogin() {
  try {
    await loginWithDeviceFlow()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
  }
}
</script>

<template>
  <div class="max-w-5xl">
    <header class="mb-6">
      <h1 class="text-2xl font-bold">博主探店导入</h1>
      <p class="mt-1 text-sm text-stone-500">
        审阅同步脚本拉取的探店视频草稿，补全信息后批量提交待审核投稿。仅维护者可用。
      </p>
    </header>

    <div v-if="!isMaintainer" class="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p class="text-sm text-amber-800">请使用维护者 GitHub 账号（{{ MAINTAINER_LOGIN }}）登录后继续。</p>
      <div v-if="!isAuthenticated" class="mt-3 flex gap-2">
        <button type="button" class="rounded-lg bg-brand px-4 py-2 text-sm text-white" @click="handleLogin">GitHub 登录</button>
        <input v-model="patInput" type="password" class="rounded-lg border px-3 py-2 text-sm" placeholder="ghp_..." />
        <button type="button" class="rounded-lg border px-4 py-2 text-sm" @click="loginWithPat(patInput)">PAT</button>
      </div>
      <div v-else class="mt-3 text-sm">
        当前：{{ user?.login }}
        <button type="button" class="ml-2 text-brand" @click="logout">退出</button>
      </div>
    </div>

    <section v-if="isMaintainer" class="mb-8 rounded-xl border border-stone-200 bg-white p-4">
      <h2 class="mb-3 font-medium">手动添加抖音视频</h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <input v-model="manualDraft.videoUrl" class="rounded-lg border px-3 py-2 text-sm sm:col-span-2" placeholder="视频链接" />
        <input v-model="manualDraft.videoTitle" class="rounded-lg border px-3 py-2 text-sm" placeholder="视频标题" />
        <input v-model="manualDraft.creatorDisplayName" class="rounded-lg border px-3 py-2 text-sm" placeholder="博主名称" />
        <input v-model="manualDraft.suggestedCity" class="rounded-lg border px-3 py-2 text-sm" placeholder="城市" />
        <input v-model="manualDraft.suggestedName" class="rounded-lg border px-3 py-2 text-sm" placeholder="店名" />
      </div>
      <button type="button" class="mt-3 text-sm text-brand" @click="addManualDraft">+ 添加到列表</button>
    </section>

    <div v-if="loading" class="py-12 text-center text-stone-500">加载草稿…</div>

    <div v-else-if="drafts.length" class="space-y-3">
      <article
        v-for="draft in drafts"
        :key="draft.id"
        class="rounded-xl border border-stone-200 bg-white p-4"
      >
        <div class="flex items-start gap-3">
          <input type="checkbox" :checked="selectedIds.has(draft.id)" @change="toggleSelect(draft.id)" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs text-stone-400">{{ PLATFORM_LABELS[draft.platform] }}</span>
              <span class="text-xs text-stone-400">{{ draft.creatorDisplayName }}</span>
            </div>
            <a :href="draft.videoUrl" target="_blank" rel="noopener" class="font-medium text-brand hover:underline">
              {{ draft.videoTitle }}
            </a>
            <div class="mt-2 grid gap-2 sm:grid-cols-2">
              <input v-model="draft.suggestedCity" class="rounded border px-2 py-1 text-sm" placeholder="城市 *" />
              <input v-model="draft.suggestedName" class="rounded border px-2 py-1 text-sm" placeholder="店名 *" />
            </div>
          </div>
        </div>
      </article>

      <button
        type="button"
        class="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        :disabled="submitting || selectedIds.size === 0"
        @click="handleImport"
      >
        {{ submitting ? '提交中…' : `导入 ${selectedIds.size} 条到待审核区` }}
      </button>
    </div>

    <div v-else class="py-12 text-center text-stone-500">
      暂无草稿。请运行 <code class="rounded bg-stone-100 px-1">node scripts/fetch-creator-videos.mjs</code>
    </div>

    <p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
    <a v-if="successUrl" :href="successUrl" target="_blank" class="mt-4 inline-block text-brand hover:underline">
      查看 Pull Request →
    </a>
  </div>
</template>
