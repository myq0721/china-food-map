import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const FOOD_KEYWORDS = ['探店', '美食', '好吃', '必吃', '打卡', '餐厅', '饭店', '小吃', '火锅', '烧烤', '早茶', '面馆']
const CITIES = [
  '北京', '上海', '广州', '深圳', '成都', '杭州', '西安', '重庆', '南京', '武汉',
  '长沙', '厦门', '苏州', '天津', '青岛', '大连', '沈阳', '哈尔滨', '昆明', '贵阳',
]

function extractCity(title) {
  for (const city of CITIES) {
    if (title.includes(city)) return city
  }
  return ''
}

function extractRestaurantName(title) {
  const patterns = [
    /(?:探店|打卡|必吃|美食)[｜|]?(.{2,12}?)(?:！|!|？|\?|，|,|。| |$)/,
    /(.{2,10}?)(?:店|馆|楼|酒家|餐厅|火锅|烧烤|小吃)/,
  ]
  for (const p of patterns) {
    const m = title.match(p)
    if (m?.[1]) return m[1].replace(/[【】\[\]]/g, '').trim()
  }
  return ''
}

function isFoodVideo(title) {
  return FOOD_KEYWORDS.some((k) => title.includes(k))
}

async function fetchBilibiliVideos(mid) {
  const items = []
  let page = 1
  const pageSize = 30

  while (page <= 3) {
    const url = `https://api.bilibili.com/x/space/arc/search?mid=${mid}&ps=${pageSize}&tid=0&pn=${page}&order=pubdate`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: `https://space.bilibili.com/${mid}`,
      },
    })
    const data = await res.json()
    if (data.code !== 0) break

    const vlist = data.data?.list?.vlist ?? []
    if (!vlist.length) break

    for (const v of vlist) {
      if (!isFoodVideo(v.title)) continue
      items.push({
        id: randomUUID(),
        creatorAuthorId: String(mid),
        creatorDisplayName: '',
        platform: 'bilibili',
        videoTitle: v.title,
        videoUrl: `https://www.bilibili.com/video/${v.bvid}`,
        suggestedName: extractRestaurantName(v.title),
        suggestedCity: extractCity(v.title),
        status: 'draft',
      })
    }

    if (vlist.length < pageSize) break
    page++
  }

  return items
}

function parseDouyinUserId(profileUrl) {
  const m = profileUrl.match(/\/user\/([^/?]+)/)
  return m?.[1] ?? ''
}

async function main() {
  const creatorsPath = join(root, 'data', 'meta', 'curated-creators.json')
  const draftsPath = join(root, 'data', 'imports', 'drafts.json')
  const creators = JSON.parse(await readFile(creatorsPath, 'utf-8'))

  const allItems = []

  for (const creator of creators) {
    if (!creator.enabled) continue

    if (creator.platform === 'bilibili') {
      const videos = await fetchBilibiliVideos(creator.authorId)
      for (const v of videos) {
        v.creatorDisplayName = creator.displayName
      }
      allItems.push(...videos)
      console.log(`Bilibili ${creator.displayName}: ${videos.length} food videos`)
    }

    if (creator.platform === 'douyin') {
      const uid = parseDouyinUserId(creator.profileUrl) || creator.authorId
      allItems.push({
        id: randomUUID(),
        creatorAuthorId: uid,
        creatorDisplayName: creator.displayName,
        platform: 'douyin',
        videoTitle: `（请手动补充）${creator.displayName} 的探店视频`,
        videoUrl: creator.profileUrl,
        suggestedName: '',
        suggestedCity: '',
        status: 'draft',
        note: '抖音暂不支持自动拉取，请在导入页粘贴视频链接',
      })
      console.log(`Douyin ${creator.displayName}: placeholder draft (manual video URL needed)`)
    }
  }

  const existing = JSON.parse(await readFile(draftsPath, 'utf-8').catch(() => '{"items":[]}'))
  const importedUrls = new Set(
    (existing.items ?? []).filter((i) => i.status === 'imported').map((i) => i.videoUrl),
  )
  const mergedItems = [
    ...(existing.items ?? []).filter((i) => i.status === 'imported'),
    ...allItems.filter((i) => !importedUrls.has(i.videoUrl)),
  ]

  const drafts = {
    generatedAt: new Date().toISOString(),
    items: mergedItems,
  }

  await writeFile(draftsPath, JSON.stringify(drafts, null, 2) + '\n', 'utf-8')
  console.log(`Wrote ${mergedItems.length} draft items -> data/imports/drafts.json`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
