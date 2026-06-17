import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinyin } from 'pinyin-pro'
import { recommenderKey } from './lib/recommender-key.mjs'
import { fetchBilibiliSpaceVideos, fetchBilibiliVideo } from './lib/bilibili.mjs'
import { extractRestaurantFromText, hasOpenAI } from './lib/openai-extract.mjs'
import { buildBilibiliText } from './lib/whisper-audio.mjs'

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
  const limit = Number(process.env.IMPORT_LIMIT ?? '0')
  const dryRun = process.argv.includes('--dry-run')

  if (!hasOpenAI()) {
    console.warn('未设置 OPENAI_API_KEY，将使用启发式规则')
  }

  console.log(`Fetching videos for mid=${mid}...`)
  const videos = await fetchBilibiliSpaceVideos(mid)
  console.log(`Found ${videos.length} food-related videos`)

  const restaurants = await loadExistingRestaurants()
  const failures = []
  const imported = []
  const today = new Date().toISOString().slice(0, 10)
  let count = 0

  for (const video of videos) {
    if (limit > 0 && count >= limit) break
    try {
      const meta = await fetchBilibiliVideo(video.bvid)
      const text = await buildBilibiliText(meta, meta.videoUrl, {
        city: video.suggestedCity,
        name: video.suggestedName,
      })
      const extracted = await extractRestaurantFromText(text, {
        title: meta.title,
        platform: 'bilibili',
      })

      const existing = restaurants.get(buildRestaurantId(extracted.city || video.suggestedCity, extracted.name || video.suggestedName))
      const merged = mergeRestaurant(existing, extracted, { ...video, videoUrl: meta.videoUrl }, today)

      if (!dryRun) {
        const outPath = join(root, 'data', 'restaurants', `${merged.id}.json`)
        await writeFile(outPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8')
        restaurants.set(merged.id, merged)
      }
      imported.push({ id: merged.id, video: video.title })
      count++
      console.log(`✓ ${merged.city} ${merged.name} <- ${video.title}`)
    } catch (e) {
      failures.push({ video: video.title, url: video.videoUrl, error: e.message })
      console.warn(`✗ ${video.title}: ${e.message}`)
    }
  }

  if (!dryRun) {
    await mkdir(join(root, 'data', 'imports'), { recursive: true })
    await writeFile(
      join(root, 'data', 'imports', 'failures.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), items: failures }, null, 2) + '\n',
      'utf-8',
    )
  }

  console.log(`Imported: ${imported.length}, Failed: ${failures.length}${dryRun ? ' (dry-run)' : ''}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
