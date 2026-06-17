import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { fetchBilibiliSpaceVideos } from './lib/bilibili.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

async function main() {
  const creatorsPath = join(root, 'data', 'meta', 'curated-creators.json')
  const draftsPath = join(root, 'data', 'imports', 'drafts.json')
  const creators = JSON.parse(await readFile(creatorsPath, 'utf-8'))
  const maxPages = Number(process.env.BILI_MAX_PAGES ?? '3')

  const allItems = []

  for (const creator of creators) {
    if (!creator.enabled || creator.platform !== 'bilibili') continue

    console.log(`拉取 ${creator.displayName} 的投稿列表（最多 ${maxPages} 页）…`)
    const videos = await fetchBilibiliSpaceVideos(creator.authorId, maxPages)
    for (const v of videos) {
      allItems.push({
        id: randomUUID(),
        creatorAuthorId: creator.authorId,
        creatorDisplayName: creator.displayName,
        platform: 'bilibili',
        videoTitle: v.title,
        videoUrl: v.videoUrl,
        suggestedName: v.suggestedName,
        suggestedCity: v.suggestedCity,
        status: 'draft',
      })
    }
    console.log(`Bilibili ${creator.displayName}: ${videos.length} food videos`)
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
