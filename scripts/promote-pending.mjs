import { readFile, writeFile, unlink, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinyin } from 'pinyin-pro'
import { recommenderKey } from './lib/recommender-key.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function toSlugPart(text) {
  const normalized = text.trim().replace(/\s+/g, '')
  const py = pinyin(normalized, { toneType: 'none', type: 'array' }).join('')
  return py.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown'
}

export function buildRestaurantId(city, name) {
  return `${toSlugPart(city)}-${toSlugPart(name)}`
}

export function mergeRestaurant(existing, pendingRestaurant, recommender) {
  const now = new Date().toISOString()
  const id = buildRestaurantId(pendingRestaurant.city, pendingRestaurant.name)

  if (!existing) {
    return {
      id,
      city: pendingRestaurant.city.trim(),
      name: pendingRestaurant.name.trim(),
      cuisine: pendingRestaurant.cuisine?.length ? pendingRestaurant.cuisine : undefined,
      address: pendingRestaurant.address?.trim() || undefined,
      coordinates: pendingRestaurant.coordinates ?? null,
      createdAt: now,
      updatedAt: now,
      recommenders: [recommender],
    }
  }

  const key = recommenderKey(recommender)
  if (existing.recommenders.some((r) => recommenderKey(r) === key)) {
    throw new Error(`推荐者 ${key} 已存在`)
  }

  const mergedCuisine = [...new Set([...(existing.cuisine ?? []), ...(pendingRestaurant.cuisine ?? [])])]

  return {
    ...existing,
    cuisine: mergedCuisine.length ? mergedCuisine : undefined,
    address: pendingRestaurant.address?.trim() || existing.address,
    updatedAt: now,
    recommenders: [...existing.recommenders, recommender],
  }
}

export async function promotePendingIds(ids) {
  const pendingDir = join(root, 'data', 'pending')
  const restaurantsDir = join(root, 'data', 'restaurants')
  const results = []

  for (const id of ids) {
    const pendingPath = join(pendingDir, `${id}.json`)
    const raw = await readFile(pendingPath, 'utf-8')
    const pending = JSON.parse(raw)

    if (pending.status !== 'pending') {
      throw new Error(`${id} 不是 pending 状态`)
    }

    const restaurantId = buildRestaurantId(pending.restaurant.city, pending.restaurant.name)
    const restaurantPath = join(restaurantsDir, `${restaurantId}.json`)

    let existing = null
    try {
      existing = JSON.parse(await readFile(restaurantPath, 'utf-8'))
    } catch {
      // new restaurant
    }

    const merged = mergeRestaurant(existing, pending.restaurant, pending.recommender)
    await writeFile(restaurantPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8')
    await unlink(pendingPath)
    results.push({ pendingId: id, restaurantId })
  }

  return results
}

const ids = process.argv.slice(2)
if (ids.length) {
  let targetIds = ids
  if (ids[0] === '--all') {
    const pendingDir = join(root, 'data', 'pending')
    const files = await readdir(pendingDir)
    targetIds = files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
  }
  const results = await promotePendingIds(targetIds)
  console.log('Promoted:', results)
}
