/**
 * 全量导入特厨隋卞等 B 站 UP 主探店视频 → data/restaurants/
 *
 * 城市优先级：合集 > 店名内嵌 > 标签 > 标题/简介
 * 推荐指数：有 OPENAI_API_KEY 时用 LLM；否则规则启发式
 *
 * 用法：
 *   node scripts/import-bilibili-full.mjs
 *   node scripts/import-bilibili-full.mjs --dry-run
 *   node scripts/import-bilibili-full.mjs --transcribe   # 对信息不足的视频 Whisper 转写
 *   node scripts/import-bilibili-full.mjs --to-drafts    # 缺字段写草稿
 *   BILI_MAX_PAGES=10 IMPORT_LIMIT=5 node scripts/import-bilibili-full.mjs
 */
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { pinyin } from 'pinyin-pro'
import { recommenderKey } from './lib/recommender-key.mjs'
import { fetchBilibiliSpaceVideos, fetchBilibiliVideo, sleep } from './lib/bilibili.mjs'
import { getBvidCityMap, cityFromCollection } from './lib/collections.mjs'
import { extractRestaurantFromText, hasOpenAI } from './lib/openai-extract.mjs'
import { buildBilibiliText } from './lib/whisper-audio.mjs'
import {
  parseVideoFields,
  parseSuibanTitle,
  isPlausibleRestaurantName,
  heuristicRating,
} from './lib/parse-video.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const DEFAULT_MID = '3546888255048212'
const CREATOR = {
  platform: 'bilibili',
  authorId: DEFAULT_MID,
  displayName: '特厨隋卞',
  profileUrl: `https://space.bilibili.com/${DEFAULT_MID}`,
}

function toSlugPart(text) {
  const normalized = text.trim().replace(/\s+/g, '')
  const py = pinyin(normalized, { toneType: 'none', type: 'array' }).join('')
  return py.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown'
}

function buildRestaurantId(city, name) {
  return `${toSlugPart(city)}-${toSlugPart(name)}`
}

async function loadExistingRestaurants() {
  const dir = join(root, 'data', 'restaurants')
  const { readdir } = await import('node:fs/promises')
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.json'))
  const map = new Map()
  for (const f of files) {
    const data = JSON.parse(await readFile(join(dir, f), 'utf-8'))
    map.set(data.id, data)
  }
  return map
}

function mergeRestaurant(existing, extracted, video, today) {
  const city = extracted.city?.trim() || video.suggestedCity?.trim()
  const name = extracted.name?.trim() || video.suggestedName?.trim()
  if (!city || !name) throw new Error('缺少城市或店名')

  const id = buildRestaurantId(city, name)
  const recommender = {
    authorId: CREATOR.authorId,
    platform: CREATOR.platform,
    profileUrl: CREATOR.profileUrl,
    recommendedAt: today,
    rating: extracted.rating,
    ratingSummary: extracted.ratingSummary,
    reason: extracted.reason,
    sourceVideoUrl: video.videoUrl,
  }
  if (extracted.dishes?.length) recommender.dishes = extracted.dishes

  if (!existing) {
    return {
      id,
      city,
      name,
      cuisine: extracted.cuisine?.length ? extracted.cuisine : undefined,
      address: extracted.address?.trim() || undefined,
      coordinates: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recommenders: [recommender],
    }
  }

  const key = recommenderKey(recommender)
  if (existing.recommenders.some((r) => r.sourceVideoUrl === video.videoUrl)) {
    throw new Error('该视频已导入')
  }
  if (existing.recommenders.some((r) => recommenderKey(r) === key)) {
    throw new Error(`推荐者 ${key} 已存在`)
  }

  const mergedCuisine = [...new Set([...(existing.cuisine ?? []), ...(extracted.cuisine ?? [])])]
  return {
    ...existing,
    cuisine: mergedCuisine.length ? mergedCuisine : undefined,
    address: extracted.address?.trim() || existing.address,
    updatedAt: new Date().toISOString(),
    recommenders: [...existing.recommenders, recommender],
  }
}

async function main() {
  const mid = process.env.BILIBILI_MID ?? DEFAULT_MID
  const limit = Number(process.env.IMPORT_LIMIT ?? '0') || 0
  const maxPages = Number(process.env.BILI_MAX_PAGES ?? '10') || 10
  const dryRun = process.argv.includes('--dry-run')
  const toDrafts = process.argv.includes('--to-drafts')
  const refreshCollections = process.argv.includes('--refresh-collections')
  const useTranscribe = process.argv.includes('--transcribe')
  const fresh = process.argv.includes('--fresh')

  if (fresh && !dryRun) {
    const dir = join(root, 'data', 'restaurants')
    const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.json'))
    for (const f of files) await rm(join(dir, f))
    console.log(`已清空 ${files.length} 个旧饭店文件\n`)
  }

  if (useTranscribe) process.env.USE_WHISPER = '1'

  if (!hasOpenAI()) {
    console.log('ℹ 未设置 OPENAI_API_KEY：使用标题/标签/合集 + 规则解析星级')
  } else if (useTranscribe) {
    console.log('ℹ 已启用 --transcribe：信息不足时将尝试 yt-dlp + Whisper（需本机安装 yt-dlp、ffmpeg）')
  }

  console.log('拉取 B 站合集城市映射…')
  const collectionMap = await getBvidCityMap(mid, {
    refresh: refreshCollections,
    onProgress: (m) => console.log(m),
  })
  const mapped = Object.keys(collectionMap.bvidToCity).length
  console.log(`合集映射就绪：${collectionMap.seasons.length} 个地域合集，${mapped} 条视频\n`)

  console.log(`拉取投稿列表 mid=${mid}（最多 ${maxPages} 页）…`)
  const videos = await fetchBilibiliSpaceVideos(mid, maxPages, 2000, true, {
    foodOnly: true,
    bvidToCity: collectionMap.bvidToCity,
  })
  console.log(`探店相关视频 ${videos.length} 条\n`)

  const restaurants = await loadExistingRestaurants()
  const failures = []
  const draftItems = []
  const imported = []
  const today = new Date().toISOString().slice(0, 10)
  let count = 0

  for (const video of videos) {
    if (limit > 0 && count >= limit) break
    try {
      await sleep(800)
      const meta = await fetchBilibiliVideo(video.bvid)
      const collectionCity = cityFromCollection(video.bvid, collectionMap)

      const parsed = parseVideoFields({
        title: meta.title,
        desc: meta.desc,
        tags: meta.tags,
        collectionCity,
      })

      const extracted = await extractRestaurantFromText(
        `${meta.title}\n${meta.desc ?? ''}`,
        { title: meta.title, platform: 'bilibili' },
      )

      const suiban = parseSuibanTitle(meta.title)
      let city = parsed.city || collectionCity || extracted.city?.trim() || ''
      let name =
        (suiban.name && isPlausibleRestaurantName(suiban.name, meta.title) ? suiban.name : '') ||
        (isPlausibleRestaurantName(parsed.name, meta.title) ? parsed.name : '') ||
        (isPlausibleRestaurantName(extracted.name?.trim(), meta.title) ? extracted.name.trim() : '')

      if (city === '河南') city = '郑州'

      if (!city || !name || !isPlausibleRestaurantName(name, meta.title)) {
        if (toDrafts) {
          draftItems.push({
            id: randomUUID(),
            creatorAuthorId: CREATOR.authorId,
            creatorDisplayName: CREATOR.displayName,
            platform: 'bilibili',
            videoTitle: meta.title,
            videoUrl: meta.videoUrl,
            suggestedCity: city,
            suggestedName: name,
            collectionCity: collectionCity || undefined,
            status: 'draft',
          })
          console.log(`→ 草稿 ${meta.title}`)
          continue
        }
        throw new Error('缺少城市或店名（可加 --to-drafts）')
      }

      const existing = restaurants.get(buildRestaurantId(city, name))
      const merged = mergeRestaurant(
        existing,
        {
          ...extracted,
          city,
          name,
          rating: extracted.rating ?? heuristicRating(meta.title, meta.desc),
          ratingSummary: extracted.ratingSummary || meta.title.slice(0, 80),
          reason: meta.desc?.trim() || meta.title,
        },
        { ...video, videoUrl: meta.videoUrl },
        today,
      )

      if (!dryRun) {
        const outPath = join(root, 'data', 'restaurants', `${merged.id}.json`)
        await writeFile(outPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8')
        restaurants.set(merged.id, merged)
      }
      imported.push({ id: merged.id, rating: merged.recommenders.at(-1)?.rating, video: video.title })
      count++
      const star = merged.recommenders.at(-1)?.rating
      console.log(`✓ ${star}★ ${merged.city} ${merged.name}`)
    } catch (e) {
      failures.push({ video: video.title, url: video.videoUrl, error: e.message })
      console.warn(`✗ ${video.title}: ${e.message}`)
    }
  }

  if (!dryRun && (failures.length || draftItems.length)) {
    await mkdir(join(root, 'data', 'imports'), { recursive: true })
    if (failures.length) {
      await writeFile(
        join(root, 'data', 'imports', 'failures.json'),
        JSON.stringify({ generatedAt: new Date().toISOString(), items: failures }, null, 2) + '\n',
        'utf-8',
      )
    }
    if (draftItems.length) {
      const draftsPath = join(root, 'data', 'imports', 'drafts.json')
      const existing = JSON.parse(await readFile(draftsPath, 'utf-8').catch(() => '{"items":[]}'))
      const urls = new Set((existing.items ?? []).map((i) => i.videoUrl))
      const merged = {
        generatedAt: new Date().toISOString(),
        items: [...(existing.items ?? []), ...draftItems.filter((d) => !urls.has(d.videoUrl))],
      }
      await writeFile(draftsPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8')
    }
  }

  console.log(
    `\n完成：导入 ${imported.length}，草稿 ${draftItems.length}，失败 ${failures.length}${dryRun ? '（dry-run）' : ''}`,
  )
  if (imported.length && !dryRun) {
    console.log('运行 npm run build:index 更新站点索引')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
