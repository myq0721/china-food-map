/**
 * 清理导入数据：删除缺城市或店名的草稿，移除 failures.json
 */
import { readFile, writeFile, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdir } from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

async function main() {
  const draftsPath = join(root, 'data', 'imports', 'drafts.json')
  const failuresPath = join(root, 'data', 'imports', 'failures.json')
  const restaurantsDir = join(root, 'data', 'restaurants')

  const importedUrls = new Set()
  for (const f of (await readdir(restaurantsDir).catch(() => [])).filter((x) => x.endsWith('.json'))) {
    const data = JSON.parse(await readFile(join(restaurantsDir, f), 'utf-8'))
    for (const r of data.recommenders ?? []) {
      if (r.sourceVideoUrl) importedUrls.add(r.sourceVideoUrl)
    }
  }

  let drafts = { items: [] }
  try {
    drafts = JSON.parse(await readFile(draftsPath, 'utf-8'))
  } catch {
    /* empty */
  }

  const before = drafts.items?.length ?? 0
  const kept = (drafts.items ?? []).filter((item) => {
    const city = item.suggestedCity?.trim()
    const name = item.suggestedName?.trim()
    if (!city || !name) return false
    if (importedUrls.has(item.videoUrl)) return false
    return true
  })

  await writeFile(
    draftsPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), items: kept }, null, 2) + '\n',
    'utf-8',
  )
  console.log(`草稿：${before} → ${kept.length}（删除缺字段或已入库 ${before - kept.length} 条）`)

  try {
    await rm(failuresPath)
    console.log('已删除 data/imports/failures.json')
  } catch {
    /* ok */
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
