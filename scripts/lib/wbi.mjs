import { createHash } from 'node:crypto'

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 55, 40,
  33, 48, 23, 42, 10, 9, 40, 24, 37, 24, 10, 28,
]

const BILI_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
}

let cachedKeys = null
let cachedAt = 0
const KEY_TTL_MS = 55 * 60 * 1000

function getMixinKey(orig) {
  return MIXIN_KEY_ENC_TAB.map((n) => orig[n])
    .join('')
    .slice(0, 32)
}

function buildCookieHeader() {
  const sess = process.env.BILI_SESSDATA?.trim()
  return sess ? `SESSDATA=${sess}` : undefined
}

function requestHeaders(referer) {
  const headers = { ...BILI_HEADERS, Referer: referer }
  const cookie = buildCookieHeader()
  if (cookie) headers.Cookie = cookie
  return headers
}

export async function fetchBiliJson(url, referer, retries = 5) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers: requestHeaders(referer) })
    const text = await res.text()
    if (!text.trim().startsWith('{')) {
      if (i < retries - 1) {
        await sleep(3000 * (i + 1))
        continue
      }
      throw new Error('B 站 API 返回非 JSON（可能被限流，可设置 BILI_SESSDATA 后重试）')
    }
    const data = JSON.parse(text)
    if ((data.code === -799 || data.code === -352) && i < retries - 1) {
      await sleep(4000 * (i + 1))
      continue
    }
    return data
  }
  throw new Error('B 站 API 请求失败')
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function getWbiKeys() {
  if (cachedKeys && Date.now() - cachedAt < KEY_TTL_MS) return cachedKeys

  const data = await fetchBiliJson('https://api.bilibili.com/x/web-interface/nav', 'https://www.bilibili.com')
  if (!data.data?.wbi_img) {
    throw new Error('无法获取 B 站 WBI 密钥')
  }

  const imgKey = data.data.wbi_img.img_url.split('/').pop().split('.')[0]
  const subKey = data.data.wbi_img.sub_url.split('/').pop().split('.')[0]
  cachedKeys = { imgKey, subKey }
  cachedAt = Date.now()
  return cachedKeys
}

export function signWbiParams(params, imgKey, subKey) {
  const mixinKey = getMixinKey(imgKey + subKey)
  const signed = { ...params, wts: Math.floor(Date.now() / 1000) }
  const chrFilter = /[!'()*]/g

  const query = Object.keys(signed)
    .sort()
    .map((key) => {
      const value = String(signed[key]).replace(chrFilter, '')
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    })
    .join('&')

  const w_rid = createHash('md5')
    .update(query + mixinKey)
    .digest('hex')

  return `${query}&w_rid=${w_rid}`
}

export async function buildWbiUrl(basePath, params, referer) {
  const { imgKey, subKey } = await getWbiKeys()
  const query = signWbiParams(params, imgKey, subKey)
  return `https://api.bilibili.com${basePath}?${query}`
}

export { requestHeaders, BILI_HEADERS }
