import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchBilibiliVideo } from './lib/bilibili.mjs'
import { extractRestaurantFromText, rateTextSubmission, hasOpenAI } from './lib/openai-extract.mjs'
import { buildBilibiliText } from './lib/whisper-audio.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const pendingDir = join(root, 'data', 'pending')

const PLACEHOLDER_CITY = '待确认'
const PLACEHOLDER_NAME_PREFIX = '待确认'

function needsEnrichment(pending) {
  const rec = pending.recommender
  const r = pending.restaurant

  if (!rec.rating || rec.rating < 1 || rec.rating > 5) return true
  if (r.city === PLACEHOLDER_CITY || r.name.startsWith(PLACEHOLDER_NAME_PREFIX)) return true
  if (rec.platform === 'bilibili' && rec.sourceVideoUrl) {
    if (!r.city?.trim() || !r.name?.trim()) return true
  }
  return false
}

function applyExtracted(pending, extracted) {
  const rec = pending.recommender
  const r = pending.restaurant

  if ((!r.city?.trim() || r.city === PLACEHOLDER_CITY) && extracted.city?.trim()) {
    r.city = extracted.city.trim()
  }
  if ((!r.name?.trim() || r.name.startsWith(PLACEHOLDER_NAME_PREFIX)) && extracted.name?.trim()) {
    r.name = extracted.name.trim()
  }
  if (!r.cuisine?.length && extracted.cuisine?.length) r.cuisine = extracted.cuisine
  if (!r.address?.trim() && extracted.address?.trim()) r.address = extracted.address.trim()
  if (!rec.reason?.trim() && extracted.reason) rec.reason = extracted.reason
  if (!rec.dishes?.length && extracted.dishes?.length) rec.dishes = extracted.dishes
  rec.rating = extracted.rating
  rec.ratingSummary = extracted.ratingSummary
}

async function enrichPending(filePath) {
  const raw = await readFile(filePath, 'utf-8')
  const pending = JSON.parse(raw)

  if (!needsEnrichment(pending)) {
    return { skipped: true, id: pending.id }
  }

  const rec = pending.recommender

  if (rec.platform === 'bilibili' && rec.sourceVideoUrl) {
    const meta = await fetchBilibiliVideo(rec.sourceVideoUrl)
    const preliminary = `${meta.title}\n${meta.desc}`
    const text = await buildBilibiliText(meta, rec.sourceVideoUrl, {
      city: pending.restaurant.city,
      name: pending.restaurant.name,
    })
    const extracted = await extractRestaurantFromText(text, {
      title: meta.title,
      platform: 'bilibili',
    })
    applyExtracted(pending, extracted)
  } else {
    const text = [
      pending.restaurant.city,
      pending.restaurant.name,
      rec.reason,
      rec.dishes?.map((d) => d.name).join('、'),
    ]
      .filter(Boolean)
      .join('\n')
    const rated = await rateTextSubmission(text)
    rec.rating = rated.rating
    rec.ratingSummary = rated.ratingSummary
  }

  await writeFile(filePath, JSON.stringify(pending, null, 2) + '\n', 'utf-8')
  return { enriched: true, id: pending.id }
}

async function main() {
  const arg = process.argv[2]
  if (!hasOpenAI()) {
    console.warn('未设置 OPENAI_API_KEY，将使用启发式规则打分')
  }

  let files = []
  if (arg) {
    files = [`${arg}.json`]
  } else {
    const all = await readdir(pendingDir).catch(() => [])
    files = all.filter((f) => f.endsWith('.json'))
  }

  const results = []
  for (const file of files) {
    try {
      const r = await enrichPending(join(pendingDir, file))
      results.push(r)
      console.log(r)
    } catch (e) {
      console.error(`Failed ${file}:`, e.message)
    }
  }
  console.log(`Done. Processed ${results.length} files.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
