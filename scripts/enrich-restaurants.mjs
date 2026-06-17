/**
 * 批量核实并丰富饭店卡片：标题 + 简介 + 标签 + 合集 + B 站热评
 * → 差异化星级、简评、描述、菜系、推荐菜、城市校正
 *
 * 用法：node scripts/enrich-restaurants.mjs
 *       node scripts/enrich-restaurants.mjs --dry-run
 *       node scripts/enrich-restaurants.mjs --limit 5
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchVideoComments } from './lib/bilibili-comments.mjs'
import { getBvidCityMap } from './lib/collections.mjs'
import { analyzeVideoContent } from './lib/sentiment.mjs'
import { extractBvid } from './lib/bilibili.mjs'
import { sleep } from './lib/wbi.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const restaurantsDir = join(root, 'data', 'restaurants')

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? process.env.ENRICH_LIMIT ?? '0') || 0

  console.log('加载合集城市映射…')
  const collectionMap = await getBvidCityMap('3546888255048212', {
    onProgress: (m) => console.log(m),
  })

  const files = (await readdir(restaurantsDir)).filter((f) => f.endsWith('.json'))
  let done = 0
  const ratingDist = {}

  for (const file of files) {
    if (limit > 0 && done >= limit) break
    const path = join(restaurantsDir, file)
    const data = JSON.parse(await readFile(path, 'utf-8'))
    const rec = data.recommenders?.[0]
    if (!rec?.sourceVideoUrl) continue

    const bvid = extractBvid(rec.sourceVideoUrl)
    if (!bvid) continue

    try {
      await sleep(done === 0 ? 0 : 1200)
      const { meta, comments } = await fetchVideoComments(bvid, 25)
      const collectionCity = collectionMap.bvidToCity?.[bvid] ?? ''

      const analysis = analyzeVideoContent({
        title: meta.title,
        desc: meta.desc,
        tags: meta.tags,
        comments,
        collectionCity,
        bvid,
        collectionMap,
      })

      if (analysis.city && analysis.city !== data.city) {
        console.log(`  城市校正 ${data.city} → ${analysis.city} (${data.name})`)
        data.city = analysis.city
      }

      if (analysis.cuisine.length) data.cuisine = analysis.cuisine
      rec.rating = analysis.rating
      rec.ratingSummary = analysis.ratingSummary
      rec.reason = analysis.reason
      if (analysis.dishes.length) rec.dishes = analysis.dishes
      else delete rec.dishes
      if (rec.authorId === '3546888255048212') rec.displayName = '特厨隋卞'

      ratingDist[analysis.rating] = (ratingDist[analysis.rating] ?? 0) + 1

      if (!dryRun) {
        data.updatedAt = new Date().toISOString()
        await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf-8')
      }

      done++
      console.log(`${analysis.rating}★ ${data.city} ${data.name} | ${analysis.ratingSummary.slice(0, 36)}…`)
    } catch (e) {
      console.warn(`✗ ${file}: ${e.message}`)
    }
  }

  console.log(`\n完成 ${done} 家${dryRun ? '（dry-run）' : ''}`)
  console.log('星级分布:', ratingDist)
  if (!dryRun && done) console.log('请运行 npm run build:index')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
