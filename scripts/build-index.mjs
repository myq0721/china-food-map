import { readdir, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const restaurantsDir = join(root, 'data', 'restaurants')
const publicDataDir = join(root, 'public', 'data')
const schemaPath = join(root, 'data', 'schema', 'restaurant.schema.json')

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)

const schema = JSON.parse(await readFile(schemaPath, 'utf-8'))
const validate = ajv.compile(schema)

const files = (await readdir(restaurantsDir)).filter((f) => f.endsWith('.json'))
const restaurants = []

for (const file of files) {
  const raw = await readFile(join(restaurantsDir, file), 'utf-8')
  const data = JSON.parse(raw)
  const valid = validate(data)
  if (!valid) {
    console.error(`Invalid restaurant file: ${file}`)
    console.error(validate.errors)
    process.exit(1)
  }
  if (data.id !== file.replace(/\.json$/, '')) {
    console.error(`ID mismatch in ${file}: expected ${file.replace(/\.json$/, '')}, got ${data.id}`)
    process.exit(1)
  }
  const latestRecommendedAt = data.recommenders
    .map((r) => r.recommendedAt)
    .sort()
    .at(-1)
  const rated = data.recommenders.filter((r) => typeof r.rating === 'number')
  const averageRating =
    rated.length > 0
      ? Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 10) / 10
      : undefined
  restaurants.push({
    ...data,
    recommenderCount: data.recommenders.length,
    latestRecommendedAt,
    averageRating,
  })
}

restaurants.sort((a, b) => b.latestRecommendedAt.localeCompare(a.latestRecommendedAt))

const index = {
  generatedAt: new Date().toISOString(),
  count: restaurants.length,
  restaurants,
}

await mkdir(publicDataDir, { recursive: true })
await mkdir(join(publicDataDir, 'meta'), { recursive: true })
await mkdir(join(publicDataDir, 'imports'), { recursive: true })

await writeFile(join(publicDataDir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8')
await copyFile(join(root, 'data', 'meta', 'hot-cities.json'), join(publicDataDir, 'meta', 'hot-cities.json'))
await copyFile(join(root, 'data', 'meta', 'cuisines.json'), join(publicDataDir, 'meta', 'cuisines.json'))

const optionalCopies = [
  ['data/meta/curated-creators.json', 'meta/curated-creators.json'],
  ['data/imports/drafts.json', 'imports/drafts.json'],
]

  for (const [src, dest] of optionalCopies) {
    try {
      await mkdir(join(publicDataDir, dirname(dest)), { recursive: true })
      await copyFile(join(root, src), join(publicDataDir, dest))
    } catch {
      // optional file missing
    }
  }

  try {
    await copyFile(join(root, 'data', 'meta', 'giscus.json'), join(publicDataDir, 'meta', 'giscus.json'))
  } catch {
    // optional
  }

console.log(`Built index with ${restaurants.length} restaurants -> public/data/index.json`)
