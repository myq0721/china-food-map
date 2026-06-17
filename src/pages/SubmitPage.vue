<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useGitHubAuth } from '@/composables/useGitHubAuth'
import { submitPendingPR } from '@/composables/useSubmit'
import { useMeta } from '@/composables/useMeta'
import { TURNSTILE_SITE_KEY } from '@/config'
import type { Platform, SubmitFormData, BilibiliParseResult } from '@/types/restaurant'
import { buildRestaurantId } from '@/utils/slug'
import { PLATFORM_LABELS, normalizeAuthorId } from '@/utils/profileUrl'
import { fetchBilibiliVideo, parseBilibiliMeta } from '@/utils/bilibili'
import StarRating from '@/components/StarRating.vue'

const { user, isAuthenticated, loginWithDeviceFlow, loginWithPat, logout, octokit } = useGitHubAuth()
const { cuisines, curatedCreators, ensureMetaLoaded } = useMeta()

const platforms: Platform[] = ['github', 'twitter', 'bilibili']

const form = ref<SubmitFormData>({
  city: '',
  name: '',
  cuisine: [],
  address: '',
  dishes: [{ name: '', price: '' }],
  reason: '',
  comments: [],
  platform: 'github',
  authorId: '',
  profileUrl: '',
  sourceVideoUrl: '',
  rating: 4,
  ratingSummary: '',
})

const bilibiliUrl = ref('')
const bilibiliParsing = ref(false)
const bilibiliParsed = ref<BilibiliParseResult | null>(null)
const bilibiliVideoUrl = ref('')

const patInput = ref('')
const turnstileToken = ref('')
const submitting = ref(false)
const error = ref('')
const successUrl = ref('')
const step = ref(1)

const isBilibili = computed(() => form.value.platform === 'bilibili')

const bilibiliCreator = computed(() =>
  curatedCreators.value.find((c) => c.platform === 'bilibili' && c.enabled),
)

const previewId = computed(() => {
  const city = isBilibili.value ? bilibiliParsed.value?.city : form.value.city
  const name = isBilibili.value ? bilibiliParsed.value?.name : form.value.name
  return city && name ? buildRestaurantId(city, name) : ''
})

watch(
  () => user.value?.login,
  (login) => {
    if (login && form.value.platform === 'github') {
      form.value.authorId = login
    }
  },
  { immediate: true },
)

watch(
  () => form.value.platform,
  (platform) => {
    error.value = ''
    bilibiliParsed.value = null
    bilibiliUrl.value = ''
    if (platform === 'github' && user.value) {
      form.value.authorId = user.value.login
    } else if (platform !== 'github') {
      form.value.authorId = ''
    }
    form.value.profileUrl = ''
    if (platform === 'bilibili' && bilibiliCreator.value) {
      form.value.authorId = bilibiliCreator.value.authorId
      form.value.profileUrl = bilibiliCreator.value.profileUrl
    }
  },
)

onMounted(async () => {
  await ensureMetaLoaded()
  if (form.value.platform === 'bilibili' && bilibiliCreator.value) {
    form.value.authorId = bilibiliCreator.value.authorId
    form.value.profileUrl = bilibiliCreator.value.profileUrl
  }
  loadTurnstile()
})

function loadTurnstile() {
  if (!TURNSTILE_SITE_KEY) return
  if (document.getElementById('turnstile-script')) {
    renderTurnstile()
    return
  }
  const script = document.createElement('script')
  script.id = 'turnstile-script'
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  script.async = true
  script.onload = () => renderTurnstile()
  document.head.appendChild(script)
}

function renderTurnstile() {
  const w = window as Window & { turnstile?: { render: (el: string, opts: object) => void } }
  if (!w.turnstile || !TURNSTILE_SITE_KEY) return
  w.turnstile.render('#turnstile-widget', {
    sitekey: TURNSTILE_SITE_KEY,
    callback: (token: string) => {
      turnstileToken.value = token
    },
    'expired-callback': () => {
      turnstileToken.value = ''
    },
  })
}

function addDish() {
  form.value.dishes.push({ name: '', price: '' })
}

function removeDish(i: number) {
  form.value.dishes.splice(i, 1)
}

function toggleCuisine(name: string) {
  const idx = form.value.cuisine.indexOf(name)
  if (idx >= 0) form.value.cuisine.splice(idx, 1)
  else form.value.cuisine.push(name)
}

async function handleParseBilibili() {
  error.value = ''
  bilibiliParsing.value = true
  bilibiliParsed.value = null
  try {
    const meta = await fetchBilibiliVideo(bilibiliUrl.value.trim())
    bilibiliVideoUrl.value = `https://www.bilibili.com/video/${meta.bvid}`
    bilibiliParsed.value = parseBilibiliMeta(meta)
    if (bilibiliCreator.value) {
      form.value.authorId = bilibiliCreator.value.authorId
      form.value.profileUrl = bilibiliCreator.value.profileUrl
    }
  } catch (e) {
    error.value =
      e instanceof Error
        ? `${e.message}（若浏览器无法访问 B 站 API，可先提交链接，由维护者 AI 补全）`
        : '解析失败'
  } finally {
    bilibiliParsing.value = false
  }
}

async function handleLogin() {
  error.value = ''
  try {
    await loginWithDeviceFlow()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
  }
}

async function handlePatLogin() {
  error.value = ''
  try {
    await loginWithPat(patInput.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Token 无效'
  }
}

function buildSubmitForm(): SubmitFormData {
  if (isBilibili.value && bilibiliParsed.value) {
    const p = bilibiliParsed.value
    return {
      city: p.city.trim() || '待确认',
      name: p.name.trim() || p.videoTitle.slice(0, 30) || '待确认店名',
      cuisine: p.cuisine,
      address: p.address,
      dishes: p.dishes.length ? p.dishes : [{ name: '', price: '' }],
      reason: p.reason,
      comments: [],
      platform: 'bilibili',
      authorId: form.value.authorId || bilibiliCreator.value?.authorId || '',
      profileUrl: form.value.profileUrl || bilibiliCreator.value?.profileUrl,
      sourceVideoUrl: bilibiliVideoUrl.value,
      rating: p.rating,
      ratingSummary: p.ratingSummary,
    }
  }
  return { ...form.value }
}

function validateForm(): string | null {
  if (isBilibili.value) {
    if (!bilibiliUrl.value.trim()) return '请填写 B 站视频链接'
    if (!bilibiliParsed.value) return '请先点击「解析视频」'
  } else {
    if (!form.value.city.trim()) return '请填写城市'
    if (!form.value.name.trim()) return '请填写饭店名称'
    if (form.value.platform === 'github' && !form.value.authorId.trim()) {
      return 'GitHub 推荐需登录或填写 ID'
    }
    if (form.value.platform === 'twitter' && !normalizeAuthorId('twitter', form.value.authorId)) {
      return '请填写 Twitter 用户名'
    }
    if (!form.value.rating || form.value.rating < 1 || form.value.rating > 5) {
      return '请选择 1-5 星综合推荐指数'
    }
  }
  if (!TURNSTILE_SITE_KEY) return '未配置人机验证，请联系维护者'
  if (!turnstileToken.value) return '请完成人机验证'
  return null
}

async function handleSubmit() {
  error.value = ''
  const msg = validateForm()
  if (msg) {
    error.value = msg
    return
  }
  if (!octokit.value || !user.value) {
    error.value = '请先登录 GitHub（用于创建 PR）'
    return
  }

  submitting.value = true
  try {
    const submitForm = buildSubmitForm()
    if (submitForm.platform === 'github') {
      submitForm.authorId = submitForm.authorId || user.value.login
    }

    const url = await submitPendingPR({
      form: submitForm,
      turnstileToken: turnstileToken.value,
      octokit: octokit.value,
      githubLogin: user.value.login,
    })
    successUrl.value = url
    step.value = 3
  } catch (e) {
    error.value = e instanceof Error ? e.message : '投稿失败'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <header class="mb-6">
      <h1 class="text-2xl font-bold">投稿入口</h1>
      <p class="mt-1 text-sm text-stone-500">
        投稿将进入待审核区，维护者确认后才会展示。需 GitHub 登录以创建 Pull Request。
      </p>
    </header>

    <div v-if="step === 3 && successUrl" class="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
      <h2 class="text-lg font-semibold text-green-800">投稿已提交！</h2>
      <p class="mt-2 text-sm text-green-700">已创建 PR 并写入待审核区，维护者审核通过后将展示在网站上。</p>
      <a :href="successUrl" target="_blank" rel="noopener" class="mt-4 inline-block text-brand hover:underline">
        查看 Pull Request →
      </a>
    </div>

    <template v-else>
      <div class="mb-6 flex gap-2 text-sm">
        <span :class="step >= 1 ? 'text-brand font-medium' : 'text-stone-400'">1. 填写信息</span>
        <span class="text-stone-300">→</span>
        <span :class="step >= 2 ? 'text-brand font-medium' : 'text-stone-400'">2. 登录并提交</span>
      </div>

      <form class="space-y-5" @submit.prevent="step === 1 ? (step = 2) : handleSubmit()">
        <fieldset :disabled="step > 1 && submitting" class="space-y-5">
          <div>
            <label class="mb-1 block text-sm font-medium">推荐者平台 *</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="p in platforms"
                :key="p"
                type="button"
                class="rounded-full border px-3 py-1 text-xs"
                :class="form.platform === p ? 'border-brand bg-brand text-white' : 'border-stone-200'"
                @click="form.platform = p"
              >
                {{ PLATFORM_LABELS[p] }}
              </button>
            </div>
          </div>

          <!-- B 站：仅视频链接 -->
          <template v-if="isBilibili">
            <div class="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
              推荐者：<strong>{{ bilibiliCreator?.displayName ?? '特厨隋卞' }}</strong>
              <span v-if="bilibiliCreator" class="text-blue-600">（B 站 UP 主）</span>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">B 站探店视频链接 *</label>
              <div class="flex gap-2">
                <input
                  v-model="bilibiliUrl"
                  class="w-full flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  placeholder="https://www.bilibili.com/video/BV..."
                />
                <button
                  type="button"
                  class="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-50"
                  :disabled="bilibiliParsing || !bilibiliUrl.trim()"
                  @click="handleParseBilibili"
                >
                  {{ bilibiliParsing ? '解析中…' : '解析视频' }}
                </button>
              </div>
            </div>
            <div v-if="bilibiliParsed" class="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm">
              <h3 class="mb-2 font-medium">解析预览</h3>
              <dl class="space-y-1 text-stone-600">
                <div class="flex gap-2"><dt class="text-stone-400">视频</dt><dd>{{ bilibiliParsed.videoTitle }}</dd></div>
                <div class="flex gap-2"><dt class="text-stone-400">城市</dt><dd>{{ bilibiliParsed.city || '（待 AI 补全）' }}</dd></div>
                <div class="flex gap-2"><dt class="text-stone-400">店名</dt><dd>{{ bilibiliParsed.name || '（待 AI 补全）' }}</dd></div>
                <div class="flex items-center gap-2">
                  <dt class="text-stone-400">推荐指数</dt>
                  <dd><StarRating :rating="bilibiliParsed.rating" size="sm" /></dd>
                </div>
                <div v-if="bilibiliParsed.ratingSummary" class="flex gap-2">
                  <dt class="text-stone-400">简评</dt><dd>{{ bilibiliParsed.ratingSummary }}</dd>
                </div>
              </dl>
              <p v-if="previewId" class="mt-2 text-xs text-stone-400">ID: {{ previewId }}</p>
            </div>
          </template>

          <!-- GitHub / Twitter：完整表单 -->
          <template v-else>
            <div v-if="form.platform === 'github'">
              <label class="mb-1 block text-sm font-medium">GitHub 用户名</label>
              <input
                v-model="form.authorId"
                class="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                :placeholder="user?.login ?? '登录后自动填充'"
                :readonly="!!user"
              />
            </div>

            <div v-else-if="form.platform === 'twitter'">
              <label class="mb-1 block text-sm font-medium">Twitter / X 用户名 *</label>
              <input
                v-model="form.authorId"
                class="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                placeholder="不含 @，如 foodlover"
              />
              <p class="mt-1 text-xs text-stone-400">无需验证账号归属，维护者审核后展示。</p>
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium">城市 *</label>
              <input v-model="form.city" required class="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="例如：杭州" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">饭店名称 *</label>
              <input v-model="form.name" required class="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="例如：杭州酒家" />
              <p v-if="previewId" class="mt-1 text-xs text-stone-400">ID: {{ previewId }}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">菜系（可多选）</label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="c in cuisines"
                  :key="c.slug"
                  type="button"
                  class="rounded-full border px-3 py-1 text-xs"
                  :class="form.cuisine.includes(c.name) ? 'border-brand bg-brand text-white' : 'border-stone-200'"
                  @click="toggleCuisine(c.name)"
                >
                  {{ c.name }}
                </button>
              </div>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">地址（选填）</label>
              <input v-model="form.address" class="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="详细地址" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">推荐菜与价格（选填）</label>
              <div v-for="(dish, i) in form.dishes" :key="i" class="mb-2 flex gap-2">
                <input v-model="dish.name" class="w-full flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="菜名" />
                <input v-model="dish.price" class="w-28 rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="价格" />
                <button v-if="form.dishes.length > 1" type="button" class="text-stone-400" @click="removeDish(i)">删</button>
              </div>
              <button type="button" class="text-sm text-brand" @click="addDish">+ 添加菜品</button>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">推荐理由（选填）</label>
              <textarea v-model="form.reason" rows="3" class="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="为什么推荐这家店？" />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium">综合推荐指数 *</label>
              <StarRating v-model:rating="form.rating!" interactive size="md" />
              <input
                v-model="form.ratingSummary"
                class="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                placeholder="一句话简评（选填）"
              />
            </div>
          </template>
        </fieldset>

        <div v-if="step >= 2" class="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <h3 class="mb-3 font-medium">GitHub 登录（创建 PR）</h3>
          <div v-if="isAuthenticated && user" class="flex items-center gap-3">
            <img :src="user.avatar_url" alt="" class="h-8 w-8 rounded-full" />
            <span>已登录：<a :href="user.html_url" class="text-brand">{{ user.login }}</a></span>
            <button type="button" class="ml-auto text-sm text-stone-500" @click="logout">退出</button>
          </div>
          <div v-else class="space-y-3">
            <button type="button" class="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white" @click="handleLogin">使用 GitHub 设备码登录</button>
            <div class="flex gap-2">
              <input v-model="patInput" type="password" class="w-full flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="ghp_..." />
              <button type="button" class="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm" @click="handlePatLogin">验证</button>
            </div>
          </div>
        </div>

        <div v-if="step >= 2">
          <label class="mb-2 block text-sm font-medium">人机验证 *</label>
          <div v-if="!TURNSTILE_SITE_KEY" class="text-sm text-amber-600">未配置 VITE_TURNSTILE_SITE_KEY</div>
          <div id="turnstile-widget" />
        </div>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <div class="flex gap-3">
          <button v-if="step > 1" type="button" class="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm" @click="step = 1">上一步</button>
          <button v-if="step === 1" type="submit" class="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">下一步</button>
          <button v-else type="submit" class="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50" :disabled="submitting || !isAuthenticated">
            {{ submitting ? '提交中…' : '提交待审核投稿' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>
