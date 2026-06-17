import { ref, computed } from 'vue'
import { Octokit } from '@octokit/rest'
import { GITHUB_CLIENT_ID, REPO_OWNER, REPO_NAME } from '@/config'

const TOKEN_KEY = 'china-food-map-github-token'
const USER_KEY = 'china-food-map-github-user'

export interface GitHubUser {
  login: string
  avatar_url: string
  html_url: string
}

const token = ref<string | null>(sessionStorage.getItem(TOKEN_KEY))
const user = ref<GitHubUser | null>(
  sessionStorage.getItem(USER_KEY)
    ? JSON.parse(sessionStorage.getItem(USER_KEY)!)
    : null,
)

export function useGitHubAuth() {
  const isAuthenticated = computed(() => !!token.value && !!user.value)

  const octokit = computed(() =>
    token.value ? new Octokit({ auth: token.value }) : null,
  )

  async function setToken(accessToken: string) {
    const octo = new Octokit({ auth: accessToken })
    const { data: me } = await octo.users.getAuthenticated()
    token.value = accessToken
    user.value = {
      login: me.login,
      avatar_url: me.avatar_url,
      html_url: me.html_url,
    }
    sessionStorage.setItem(TOKEN_KEY, accessToken)
    sessionStorage.setItem(USER_KEY, JSON.stringify(user.value))
  }

  async function loginWithDeviceFlow(): Promise<void> {
    if (!GITHUB_CLIENT_ID) {
      throw new Error('未配置 VITE_GITHUB_CLIENT_ID')
    }

    const res = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        scope: 'public_repo',
      }),
    })

    const data = await res.json()
    if (data.error) throw new Error(data.error_description ?? data.error)

    const opened = window.open(data.verification_uri, '_blank')
    if (!opened) {
      window.location.href = data.verification_uri
    }

    const confirmed = window.confirm(
      `请在 GitHub 页面输入验证码：${data.user_code}\n\n完成后点击「确定」继续等待授权…`,
    )
    if (!confirmed) throw new Error('已取消授权')

    const interval = (data.interval ?? 5) * 1000
    const deadline = Date.now() + (data.expires_in ?? 900) * 1000

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, interval))
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: data.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      })
      const tokenData = await tokenRes.json()
      if (tokenData.access_token) {
        await setToken(tokenData.access_token)
        return
      }
      if (tokenData.error && tokenData.error !== 'authorization_pending') {
        throw new Error(tokenData.error_description ?? tokenData.error)
      }
    }

    throw new Error('授权超时，请重试')
  }

  async function loginWithPat(pat: string) {
    await setToken(pat.trim())
  }

  function logout() {
    token.value = null
    user.value = null
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
  }

  return {
    token,
    user,
    isAuthenticated,
    octokit,
    loginWithDeviceFlow,
    loginWithPat,
    logout,
    repo: { owner: REPO_OWNER, name: REPO_NAME },
  }
}
