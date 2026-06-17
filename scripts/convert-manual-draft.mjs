/**
 * 将 data/imports/manual-draft.json 转为标准饭店卡片
 *
 * 用法：npm run convert:manual
 *       node scripts/convert-manual-draft.mjs --file data/imports/my-list.json
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinyin } from 'pinyin-pro'
import { fetchVideoComments } from './lib/bilibili-comments.mjs'
import { getBvidCityMap } from './lib/collections.mjs'
import { analyzeVideoContent } from './lib/sentiment.mjs'
import { extractBvid } from './lib/bilibili.mjs'
import { sleep } from './lib/wbi.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const DEFAULT_INPUT = join(root, 'data', 'imports', 'manual-draft.json')
const OUT_DIR = join(root, 'data', 'restaurants')

const DEFAULT_RECOMMENDER = {
  platform: 'bilibili',
  authorId: '3546888255048212',
  displayName: '特厨隋卞',
  profileUrl: 'https://space.bilibili.com/3546888255048212',
}

function toSlugPart(text) {
  const py = pinyin(String(text).trim(), { toneType: 'none', type: 'array' }).join('')
  return py.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown'
}

function buildId(city, name) {
  return `${toSlugPart(city)}-${toSlugPart(name)}`
}

function stripMeta(obj) {
  const { _说明, _字段说明, entries, ...rest } = obj
  if (entries) return entries
  if (Array.isArray(obj)) return obj
  if (rest.city && rest.name) return [rest]
  return []
}

async function main() {
  const fileArg = process.argv.find((a) => a.startsWith('--file='))?.split('=')[1]
  const inputPath = fileArg ? join(root, fileArg) : DEFAULT_INPUT
  const raw = JSON.parse(await readFile(inputPath, 'utf-8'))
  const entries = stripMeta(raw).filter((e) => e.city?.trim() && e.name?.trim())

  if (!entries.length) {
    console.error('未找到有效条目（需 city + name）')
    process.exit(1)
  }

  const collectionMap = await getBvidCityMap('3546888255048212').catch(() => null)
  await mkdir(OUT_DIR, { recursive: true })
  const today = new Date().toISOString().slice(0, 10)
  let n = 0

  for (const entry of entries) {
    let city = entry.city.trim()
    let name = entry.name.trim()
    let rating = entry.rating
    let ratingSummary = entry.ratingSummary
    let reason = entry.reason
    let cuisine = entry.cuisine
    let dishes = entry.dishes
    const videoUrl = entry.videoUrl?.trim()
    const recBase = { ...DEFAULT_RECOMMENDER, ...entry.recommender }

    if (videoUrl) {
      await sleep(n === 0 ? 0 : 1000)
      const bvid = extractBvid(videoUrl)
      const { meta, comments } = await fetchVideoComments(videoUrl, 20)
      const analysis = analyzeVideoContent({
        title: meta.title,
        desc: meta.desc,
        tags: meta.tags,
        comments,
        collectionCity: bvid && collectionMap ? collectionMap.bvidToCity?.[bvid] : '',
        bvid,
        collectionMap,
      })
      city = city || analysis.city
      name = name || analysis.name
      rating = rating ?? analysis.rating
      ratingSummary = ratingSummary || analysis.ratingSummary
      reason = reason || analysis.reason
      cuisine = cuisine?.length ? cuisine : analysis.cuisine
      dishes = dishes?.length ? dishes : analysis.dishes
    }

    const id = buildId(city, name)
    const restaurant = {
      id,
      city,
      name,
      cuisine: cuisine?.length ? cuisine : undefined,
      address: entry.address?.trim() || undefined,
      coordinates: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recommenders: [
        {
          authorId: recBase.authorId,
          platform: recBase.platform,
          profileUrl: recBase.profileUrl,
          displayName: recBase.displayName,
          recommendedAt: today,
          rating: Math.min(5, Math.max(1, Math.round(Number(rating) || 4))),
          ratingSummary: ratingSummary || `${name} 社区推荐`,
          reason: reason || ratingSummary || name,
          sourceVideoUrl: videoUrl || undefined,
          dishes: dishes?.length ? dishes : undefined,
        },
      ],
    }

    const outPath = join(OUT_DIR, `${id}.json`)
    await writeFile(outPath, JSON.stringify(restaurant, null, 2) + '\n', 'utf-8')
    n++
    console.log(`✓ ${restaurant.city} ${restaurant.name}`)
  }

  console.log(`\n写入 ${n} 家 → data/restaurants/，请运行 npm run build:index`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
