import type { PendingSubmission, Recommender, SubmitFormData } from '@/types/restaurant'
import { recommenderKey } from '@/types/restaurant'
import { buildProfileUrl, normalizeAuthorId } from '@/utils/profileUrl'
import { REPO_OWNER, REPO_NAME } from '@/config'
import type { Octokit } from '@octokit/rest'

interface SubmitOptions {
  form: SubmitFormData
  turnstileToken: string
  octokit: Octokit
  githubLogin: string
}

function buildRecommender(form: SubmitFormData): Recommender {
  const today = new Date().toISOString().slice(0, 10)
  const platform = form.platform
  const authorId =
    platform === 'github'
      ? form.authorId || ''
      : normalizeAuthorId(platform, form.authorId)

  const recommender: Recommender = {
    authorId,
    platform,
    profileUrl: buildProfileUrl(platform, authorId, form.profileUrl),
    recommendedAt: today,
  }

  if (form.dishes.length > 0) recommender.dishes = form.dishes.filter((d) => d.name.trim())
  if (form.reason.trim()) recommender.reason = form.reason.trim()
  if (form.comments.length > 0) {
    recommender.comments = form.comments.filter((c) => c.author.trim() && c.text.trim())
  }
  if (form.sourceVideoUrl.trim()) recommender.sourceVideoUrl = form.sourceVideoUrl.trim()
  if (typeof form.rating === 'number' && form.rating >= 1 && form.rating <= 5) {
    recommender.rating = form.rating
  }
  if (form.ratingSummary?.trim()) recommender.ratingSummary = form.ratingSummary.trim()

  return recommender
}

function buildPendingSubmission(form: SubmitFormData): PendingSubmission {
  const recommender = buildRecommender(form)
  return {
    id: crypto.randomUUID(),
    status: 'pending',
    submittedAt: new Date().toISOString(),
    restaurant: {
      city: form.city.trim(),
      name: form.name.trim(),
      cuisine: form.cuisine.length ? form.cuisine : undefined,
      address: form.address.trim() || undefined,
      coordinates: null,
    },
    recommender,
  }
}

async function ensureFork(octokit: Octokit): Promise<string> {
  try {
    const { data: fork } = await octokit.repos.createFork({
      owner: REPO_OWNER,
      repo: REPO_NAME,
    })
    return fork.full_name.split('/')[0]
  } catch {
    const { data: user } = await octokit.users.getAuthenticated()
    return user.login
  }
}

async function waitForFork(octokit: Octokit, owner: string, retries = 12): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await octokit.repos.get({ owner, repo: REPO_NAME })
      return
    } catch {
      await new Promise((r) => setTimeout(r, 3000))
    }
  }
  throw new Error('Fork 仓库尚未就绪，请稍后重试')
}

function encodeContent(content: string): string {
  return btoa(Array.from(new TextEncoder().encode(content), (b) => String.fromCharCode(b)).join(''))
}

async function getBaseBranch(octokit: Octokit, forkOwner: string): Promise<{ branch: string; sha: string }> {
  for (const branch of ['master', 'main']) {
    try {
      const { data: ref } = await octokit.git.getRef({
        owner: forkOwner,
        repo: REPO_NAME,
        ref: `heads/${branch}`,
      })
      return { branch, sha: ref.object.sha }
    } catch {
      // try next
    }
  }
  throw new Error('无法找到 master/main 分支')
}

export async function submitPendingPR(options: SubmitOptions): Promise<string> {
  const { form, turnstileToken, octokit, githubLogin } = options

  if (form.platform === 'github' && !form.authorId.trim()) {
    form.authorId = githubLogin
  }
  if (!form.authorId.trim()) {
    throw new Error('请填写推荐者 ID')
  }

  const pending = buildPendingSubmission(form)
  const content = JSON.stringify(pending, null, 2) + '\n'
  const filePath = `data/pending/${pending.id}.json`

  const forkOwner = await ensureFork(octokit)
  await waitForFork(octokit, forkOwner)

  const branch = `submit/pending-${pending.id.slice(0, 8)}-${Date.now()}`
  const { branch: baseBranch, sha: baseSha } = await getBaseBranch(octokit, forkOwner)

  await octokit.git.createRef({
    owner: forkOwner,
    repo: REPO_NAME,
    ref: `refs/heads/${branch}`,
    sha: baseSha,
  })

  await octokit.repos.createOrUpdateFileContents({
    owner: forkOwner,
    repo: REPO_NAME,
    path: filePath,
    message: `投稿(待审核): ${form.city} ${form.name}`,
    content: encodeContent(content),
    branch,
  })

  const rec = pending.recommender
  const prBody = [
    '## 投稿信息（待审核）',
    '',
    `- 城市：${form.city}`,
    `- 店名：${form.name}`,
    `- 推荐者：${rec.authorId}（${rec.platform}）`,
    `- Pending ID：\`${pending.id}\``,
    '',
    '## Turnstile',
    '',
    `<!-- turnstile-token: ${turnstileToken} -->`,
    '',
    '---',
    '合并后请运行 promote-pending 或等待维护者审核入库。',
  ].join('\n')

  const { data: pr } = await octokit.pulls.create({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    title: `[投稿] ${form.city}-${form.name}`,
    head: `${forkOwner}:${branch}`,
    base: baseBranch,
    body: prBody,
  })

  return pr.html_url
}

export async function submitBatchPendingPR(
  octokit: Octokit,
  submissions: PendingSubmission[],
  title: string,
): Promise<string> {
  const forkOwner = await ensureFork(octokit)
  await waitForFork(octokit, forkOwner)

  const branch = `import/batch-${Date.now()}`
  const { branch: baseBranch, sha: baseSha } = await getBaseBranch(octokit, forkOwner)

  await octokit.git.createRef({
    owner: forkOwner,
    repo: REPO_NAME,
    ref: `refs/heads/${branch}`,
    sha: baseSha,
  })

  for (const pending of submissions) {
    const content = JSON.stringify(pending, null, 2) + '\n'
    await octokit.repos.createOrUpdateFileContents({
      owner: forkOwner,
      repo: REPO_NAME,
      path: `data/pending/${pending.id}.json`,
      message: `导入待审核: ${pending.restaurant.name}`,
      content: encodeContent(content),
      branch,
    })
  }

  const ids = submissions.map((s) => s.id).join(', ')
  const { data: pr } = await octokit.pulls.create({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    title,
    head: `${forkOwner}:${branch}`,
    base: baseBranch,
    body: `## 博主探店批量导入\n\nPending IDs: ${ids}\n\n<!-- turnstile-token: maintainer-bypass -->`,
  })

  return pr.html_url
}

export { buildPendingSubmission, buildRecommender, recommenderKey }
