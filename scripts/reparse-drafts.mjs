/**
 * 重新解析 data/imports/drafts.json 中的 suggestedCity / suggestedName
 * 会逐条请求 B 站标签 API（约 0.6s/条）
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { enrichVideoItem } from './lib/bilibili.mjs'
import { extractBvid } from './lib/bilibili.mjs'
import { getBvidCityMap, cityFromCollection } from './lib/collections.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const draftsPath = join(root, 'data', 'imports', 'drafts.json')

async function main() {
  const drafts = JSON.parse(await readFile(draftsPath, 'utf-8'))
  const items = drafts.items ?? []
  const draftOnly = items.filter((i) => i.status === 'draft')

  console.log(`重新解析 ${draftOnly.length} 条草稿…`)

  const mid = process.env.BILIBILI_MID ?? '3546888255048212'
  let collectionMap = null
  try {
    collectionMap = await getBvidCityMap(mid, {
      onProgress: (m) => console.log(m),
    })
  } catch (e) {
    console.warn(`合集映射跳过: ${e.message}`)
  }

  let withCity = 0
  let withName = 0

  for (let i = 0; i < draftOnly.length; i++) {
    const d = draftOnly[i]
    const bvid = extractBvid(d.videoUrl)
    if (!bvid) continue

    try {
      const enriched = await enrichVideoItem(
        {
          bvid,
          title: d.videoTitle,
          videoUrl: d.videoUrl,
          suggestedName: d.suggestedName,
          suggestedCity: d.suggestedCity,
          collectionCity: collectionMap ? cityFromCollection(bvid, collectionMap) : '',
        },
        i === 0 ? 0 : 600,
        collectionMap ? cityFromCollection(bvid, collectionMap) : '',
      )
      d.suggestedName = enriched.suggestedName
      d.suggestedCity = enriched.suggestedCity
      d.parseConfidence = enriched.parseConfidence
      if (d.suggestedCity) withCity++
      if (d.suggestedName) withName++
      if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${draftOnly.length}（有城市 ${withCity}，有店名 ${withName}）`)
    } catch (e) {
      console.warn(`  失败 ${d.videoTitle}: ${e.message}`)
    }
  }

  drafts.generatedAt = new Date().toISOString()
  await writeFile(draftsPath, JSON.stringify(drafts, null, 2) + '\n', 'utf-8')

  const missingCity = draftOnly.filter((d) => !d.suggestedCity?.trim()).length
  console.log(`完成。有店名 ${withName}/${draftOnly.length}，有城市 ${withCity}/${draftOnly.length}`)
  if (missingCity) {
    console.log(`仍有 ${missingCity} 条缺少城市，请在 /import 页手动补全，或检查视频是否打了地域标签。`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
