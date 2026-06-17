import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchBiliJson, sleep } from './wbi.mjs'
import { extractCityFromText } from './parse-video.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..')
const CACHE_PATH = join(root, 'data', 'meta', 'bilibili-collections.json')

/** 非地域类合集，不参与城市推断 */
const SKIP_COLLECTION = /做饭|测评|拼豆|汤姆|我跟你拼了|快递|难吃|野吃|下班|美国|美食探店|开小灶/i

/** 省份 / 区域 → 默认城市（合集只有省名时使用） */
const PROVINCE_TO_CITY = {
  安徽: '合肥',
  河北: '石家庄',
  山西: '太原',
  山东: '济南',
  东北: '沈阳',
  内蒙: '呼和浩特',
  内蒙古: '呼和浩特',
  新疆: '乌鲁木齐',
  西藏: '拉萨',
  宁夏: '银川',
  广西: '南宁',
  江苏: '南京',
  浙江: '杭州',
  广东: '广州',
  湖南: '长沙',
  湖北: '武汉',
  四川: '成都',
  福建: '福州',
  江西: '南昌',
  云南: '昆明',
  贵州: '贵阳',
  甘肃: '兰州',
  海南: '海口',
  河南: '郑州',
}

export function parseCollectionCity(seasonName) {
  if (!seasonName || SKIP_COLLECTION.test(seasonName)) return ''

  const label = seasonName
    .replace(/^合集[··.]?/, '')
    .replace(/[《》]/g, '')
    .trim()

  if (!label || SKIP_COLLECTION.test(label)) return ''

  // 「山东站」「北京站」等为栏目名，不是城市
  if (/站$/.test(label) && !extractCityFromText(label.replace(/站$/, ''))) return ''

  const fromText = extractCityFromText(label)
  if (fromText) return fromText

  if (PROVINCE_TO_CITY[label]) return PROVINCE_TO_CITY[label]

  // 短标签多为城市名（无锡、淮安、顺德等）
  if (label.length >= 2 && label.length <= 6 && /^[\u4e00-\u9fa5]+$/.test(label)) {
    return label
  }

  return ''
}

export async function discoverSeasonIds(mid, sampleBvids) {
  const bvids = Array.isArray(sampleBvids) ? sampleBvids : [sampleBvids]
  const all = new Set()

  for (const bvid of bvids) {
    const r = await fetch(`https://www.bilibili.com/video/${bvid}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    const html = await r.text()
    for (const m of html.matchAll(/season_id":(\d+)/g)) {
      if (m[1] !== '0') all.add(m[1])
    }
    await sleep(300)
  }

  return [...all]
}

export async function fetchSeasonArchives(mid, seasonId, delayMs = 400, retries = 3) {
  const referer = `https://space.bilibili.com/${mid}`
  const archives = []
  let page = 1
  const pageSize = 30
  let meta = null

  while (true) {
    const url = `https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?mid=${mid}&season_id=${seasonId}&page_num=${page}&page_size=${pageSize}`

    let data = null
    for (let attempt = 0; attempt < retries; attempt++) {
      data = await fetchBiliJson(url, referer)
      if (data.code === 0 && data.data?.meta?.name) break
      await sleep(delayMs * (attempt + 1))
    }

    if (!data || data.code !== 0 || !data.data?.meta?.name) return null

    const pageMeta = data.data.meta
    if (String(pageMeta.mid) !== String(mid)) return null

    if (!meta) meta = pageMeta
    const batch = data.data.archives ?? []
    archives.push(...batch)
    const total = data.data.page?.total ?? batch.length
    if (archives.length >= total || batch.length < pageSize) break
    page++
    await sleep(delayMs)
  }

  return {
    seasonId: Number(seasonId),
    name: meta.name,
    city: parseCollectionCity(meta.name),
    bvids: archives.map((a) => a.bvid),
  }
}

/**
 * 拉取 UP 主全部合集并建立 bvid → 城市映射。
 * 同一视频若在多个合集中，优先保留更具体的城市名（字数更长）。
 */
export async function buildCollectionMap(mid, { delayMs = 500, onProgress } = {}) {
  const referer = `https://space.bilibili.com/${mid}`
  const list = await fetchBiliJson(
    `https://api.bilibili.com/x/space/arc/list?mid=${mid}&ps=30&pn=1&order=pubdate`,
    referer,
  )
  if (list.code !== 0 || !list.data?.archives?.length) {
    throw new Error('无法获取 UP 主视频列表以发现合集')
  }

  const archives = list.data.archives
  const total = list.data?.page?.count ?? archives.length
  const sampleBvids = new Set(archives.map((a) => a.bvid))

  // 从更多投稿页取样，提高合集 ID 发现率（如新疆、东北等）
  const extraPages = Math.min(4, Math.ceil(total / 30))
  for (let pn = 2; pn <= extraPages; pn++) {
    await sleep(400)
    const page = await fetchBiliJson(
      `https://api.bilibili.com/x/space/arc/list?mid=${mid}&ps=30&pn=${pn}&order=pubdate`,
      referer,
    )
    for (const a of page.data?.archives ?? []) {
      if (sampleBvids.size >= 8) break
      sampleBvids.add(a.bvid)
    }
  }

  const seasonIds = await discoverSeasonIds(mid, [...sampleBvids].slice(0, 8))
  onProgress?.(`从 ${Math.min(8, sampleBvids.size)} 个视频页发现 ${seasonIds.length} 个合集 ID，正在逐个拉取…`)

  const seasons = []
  const bvidToCity = new Map()
  let skipped = 0

  for (let i = 0; i < seasonIds.length; i++) {
    const sid = seasonIds[i]
    await sleep(i === 0 ? 0 : delayMs)
    const season = await fetchSeasonArchives(mid, sid, delayMs)
    if (!season?.bvids?.length) {
      skipped++
      continue
    }
    if (!season.city) {
      onProgress?.(`  跳过非地域合集 ${season.name}`)
      continue
    }

    seasons.push(season)
    for (const bvid of season.bvids) {
      const prev = bvidToCity.get(bvid)
      if (!prev || season.city.length > prev.length) {
        bvidToCity.set(bvid, season.city)
      }
    }
    onProgress?.(`  ${season.name} → ${season.city}（${season.bvids.length} 条）`)
  }

  if (skipped) onProgress?.(`  ${skipped} 个 ID 无有效合集数据（可能为推荐位或非本 UP 合集）`)

  const raw = {
    generatedAt: new Date().toISOString(),
    mid,
    seasons,
    bvidToCity: Object.fromEntries(bvidToCity),
  }

  onProgress?.('校验合集视频是否属于该 UP 主投稿…')
  const creatorBvids = await fetchCreatorBvidSet(mid)
  const filtered = filterMapToCreatorBvids(raw, creatorBvids)
  onProgress?.(
    `校验后：${filtered.seasons.length} 个地域合集，${Object.keys(filtered.bvidToCity).length} 条视频`,
  )

  return filtered
}

/** 仅保留 UP 主投稿列表中出现的 BV 号，避免侧边栏推荐合集污染 */
export async function fetchCreatorBvidSet(mid, maxPages = 10) {
  const referer = `https://space.bilibili.com/${mid}`
  const bvids = new Set()
  let page = 1
  const pageSize = 30

  while (page <= maxPages) {
    const data = await fetchBiliJson(
      `https://api.bilibili.com/x/space/arc/list?mid=${mid}&ps=${pageSize}&pn=${page}&order=pubdate`,
      referer,
    )
    if (data.code !== 0) break
    const archives = data.data?.archives ?? []
    if (!archives.length) break
    for (const a of archives) bvids.add(a.bvid)
    const totalPages = Math.ceil((data.data?.page?.count ?? 0) / pageSize)
    if (page >= totalPages || archives.length < pageSize) break
    page++
    await sleep(400)
  }

  return bvids
}

function filterMapToCreatorBvids(map, creatorBvids) {
  const seasons = map.seasons
    .map((s) => ({
      ...s,
      bvids: s.bvids.filter((b) => creatorBvids.has(b)),
    }))
    .filter((s) => s.bvids.length > 0)

  const bvidToCity = {}
  for (const [bvid, city] of Object.entries(map.bvidToCity)) {
    if (creatorBvids.has(bvid)) bvidToCity[bvid] = city
  }

  return { ...map, seasons, bvidToCity }
}

export async function loadCollectionCache(mid) {
  try {
    const raw = JSON.parse(await readFile(CACHE_PATH, 'utf-8'))
    if (String(raw.mid) === String(mid) && raw.bvidToCity) return raw
  } catch {
    /* no cache */
  }
  return null
}

export async function saveCollectionCache(map) {
  await mkdir(dirname(CACHE_PATH), { recursive: true })
  await writeFile(CACHE_PATH, JSON.stringify(map, null, 2) + '\n', 'utf-8')
  return CACHE_PATH
}

export async function getBvidCityMap(mid, { refresh = false, delayMs = 500, onProgress } = {}) {
  if (!refresh) {
    const cached = await loadCollectionCache(mid)
    if (cached) {
      onProgress?.(`使用缓存合集映射（${Object.keys(cached.bvidToCity).length} 条视频）`)
      return cached
    }
  }

  const map = await buildCollectionMap(mid, { delayMs, onProgress })
  await saveCollectionCache(map)
  return map
}

export function cityFromCollection(bvid, collectionMap) {
  return collectionMap?.bvidToCity?.[bvid] ?? ''
}
