import {
  parseVideoFields,
  isFoodVideoTitle,
  heuristicRating,
  extractCityFromText,
} from './parse-video.mjs'
import {
  fetchBiliJson,
  buildWbiUrl,
  sleep,
  requestHeaders,
  BILI_HEADERS,
} from './wbi.mjs'

export { sleep, fetchBiliJson, requestHeaders, BILI_HEADERS }
export { parseVideoFields, isFoodVideoTitle, heuristicRating, extractCityFromText }
export { extractCityFromText as extractCity } from './parse-video.mjs'

export function extractBvid(url) {
  const m = String(url).match(/BV[\w]+/i)
  return m ? m[0] : null
}

export function extractAvId(url) {
  const m = String(url).match(/av(\d+)/i)
  return m ? m[1] : null
}

/** @deprecated 使用 parseVideoFields */
export function extractRestaurantName(title) {
  return parseVideoFields({ title }).name
}

export async function fetchBilibiliVideoTags(bvid) {
  const data = await fetchBiliJson(
    `https://api.bilibili.com/x/tag/archive/tags?bvid=${bvid}`,
    'https://www.bilibili.com',
  )
  if (data.code !== 0) return []
  return data.data ?? []
}

export async function fetchBilibiliVideo(bvidOrUrl) {
  const bvid = String(bvidOrUrl).startsWith('BV') ? bvidOrUrl : extractBvid(bvidOrUrl)
  const av = !bvid ? extractAvId(bvidOrUrl) : null
  const param = bvid ? `bvid=${bvid}` : `aid=${av}`
  if (!bvid && !av) throw new Error('无法识别 B 站视频链接')

  const res = await fetchBiliJson(
    `https://api.bilibili.com/x/web-interface/view?${param}`,
    'https://www.bilibili.com',
  )
  if (res.code !== 0) throw new Error(res.message ?? '获取视频信息失败')

  const d = res.data
  const tags = bvid ? await fetchBilibiliVideoTags(bvid).catch(() => []) : []

  return {
    bvid: d.bvid,
    title: d.title,
    desc: d.desc ?? '',
    ownerName: d.owner.name,
    ownerMid: d.owner.mid,
    pic: d.pic,
    videoUrl: `https://www.bilibili.com/video/${d.bvid}`,
    tags,
  }
}

export async function enrichVideoItem(item, delayMs = 600, collectionCity = '') {
  const bvid = item.bvid ?? extractBvid(item.videoUrl)
  if (!bvid) return item

  await sleep(delayMs)
  const meta = await fetchBilibiliVideo(bvid)
  const collCity = collectionCity || item.collectionCity || ''
  const parsed = parseVideoFields({
    title: meta.title,
    desc: meta.desc,
    tags: meta.tags,
    collectionCity: collCity,
  })

  return {
    ...item,
    title: meta.title,
    desc: meta.desc,
    videoUrl: meta.videoUrl,
    collectionCity: collCity || undefined,
    suggestedName: parsed.name,
    suggestedCity: parsed.city,
    parseConfidence: parsed.city && parsed.name ? 'high' : parsed.name ? 'medium' : 'low',
  }
}

function mapArchiveItem(v, collectionCity = '') {
  const parsed = parseVideoFields({
    title: v.title,
    desc: v.desc ?? '',
    collectionCity,
  })
  return {
    bvid: v.bvid,
    title: v.title,
    desc: v.desc ?? v.description ?? '',
    videoUrl: `https://www.bilibili.com/video/${v.bvid}`,
    collectionCity: collectionCity || undefined,
    suggestedName: parsed.name,
    suggestedCity: parsed.city,
    parseConfidence: parsed.city && parsed.name ? 'high' : parsed.name ? 'medium' : 'low',
  }
}

export async function fetchBilibiliSpaceVideos(
  mid,
  maxPages = 3,
  delayMs = 2000,
  enrichTags = true,
  { foodOnly = true, bvidToCity = null } = {},
) {
  const referer = `https://space.bilibili.com/${mid}`
  const items = []
  let page = 1
  const pageSize = 30

  while (page <= maxPages) {
    const listUrl = `https://api.bilibili.com/x/space/arc/list?mid=${mid}&ps=${pageSize}&pn=${page}&order=pubdate`
    const data = await fetchBiliJson(listUrl, referer)

    if (data.code !== 0) {
      console.warn(`arc/list 失败 (${data.message})，尝试 WBI 接口…`)
      return fetchBilibiliSpaceVideosWbi(mid, maxPages, delayMs, items, enrichTags, {
        foodOnly,
        bvidToCity,
      })
    }

    const archives = data.data?.archives ?? []
    if (!archives.length) break

    for (const v of archives) {
      if (foodOnly && !isFoodVideoTitle(v.title)) continue
      const collCity = bvidToCity?.[v.bvid] ?? ''
      items.push(mapArchiveItem(v, collCity))
    }

    const totalPages = Math.ceil((data.data?.page?.count ?? 0) / pageSize)
    if (page >= totalPages || archives.length < pageSize) break
    page++
    await sleep(delayMs)
  }

  if (!enrichTags || !items.length) return items

  console.log(`正在拉取 ${items.length} 条视频标签以补全城市…`)
  const enriched = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    try {
      enriched.push(await enrichVideoItem(item, i === 0 ? 0 : 600, item.collectionCity))
      if ((i + 1) % 10 === 0) console.log(`  已处理 ${i + 1}/${items.length}`)
    } catch (e) {
      console.warn(`  跳过 ${item.title}: ${e.message}`)
      enriched.push(item)
    }
  }
  return enriched
}

async function fetchBilibiliSpaceVideosWbi(mid, maxPages, delayMs, existing, enrichTags, opts = {}) {
  const { foodOnly = true, bvidToCity = null } = opts
  const referer = `https://space.bilibili.com/${mid}`
  const items = [...existing]
  let page = 1
  const pageSize = 30

  while (page <= maxPages) {
    const url = await buildWbiUrl(
      '/x/space/wbi/arc/search',
      { mid, ps: pageSize, tid: 0, pn: page, order: 'pubdate' },
      referer,
    )
    const data = await fetchBiliJson(url, referer)
    if (data.code !== 0) {
      if (items.length) {
        console.warn(`WBI 接口失败 (${data.message})，已返回 ${items.length} 条`)
        break
      }
      throw new Error(data.message ?? 'B 站空间列表失败')
    }

    const vlist = data.data?.list?.vlist ?? []
    if (!vlist.length) break

    for (const v of vlist) {
      if (foodOnly && !isFoodVideoTitle(v.title)) continue
      const collCity = bvidToCity?.[v.bvid] ?? ''
      items.push(mapArchiveItem(v, collCity))
    }

    if (vlist.length < pageSize) break
    page++
    if (page <= maxPages) await sleep(delayMs)
  }

  if (!enrichTags) return items
  const enriched = []
  for (const item of items) {
    try {
      enriched.push(await enrichVideoItem(item, 600, item.collectionCity))
    } catch {
      enriched.push(item)
    }
  }
  return enriched
}

export function parseBilibiliMeta(meta, collectionCity = '') {
  const parsed = parseVideoFields({
    title: meta.title,
    desc: meta.desc,
    tags: meta.tags ?? [],
    collectionCity,
  })
  return {
    city: parsed.city,
    name: parsed.name,
    cuisine: [],
    address: '',
    dishes: [],
    reason: meta.desc || meta.title,
    rating: heuristicRating(meta.title, meta.desc),
    ratingSummary: meta.title.slice(0, 80),
    videoTitle: meta.title,
  }
}
