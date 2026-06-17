import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const prBody = process.env.PR_BODY ?? ''
const changedFiles = (process.env.CHANGED_FILES ?? '').split('\n').filter(Boolean)

const turnstileMatch = prBody.match(/<!-- turnstile-token: (.+?) -->/)
const turnstileToken = turnstileMatch?.[1]

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)

const restaurantSchema = JSON.parse(
  await readFile(join(root, 'data', 'schema', 'restaurant.schema.json'), 'utf-8'),
)
const pendingSchema = JSON.parse(
  await readFile(join(root, 'data', 'schema', 'pending-submission.schema.json'), 'utf-8'),
)
const validateRestaurant = ajv.compile(restaurantSchema)
const validatePending = ajv.compile(pendingSchema)

const pendingFiles = changedFiles.filter(
  (f) => f.startsWith('data/pending/') && f.endsWith('.json'),
)
const restaurantFiles = changedFiles.filter(
  (f) => f.startsWith('data/restaurants/') && f.endsWith('.json'),
)

if (pendingFiles.length === 0 && restaurantFiles.length === 0) {
  console.log('No data files changed, skipping validation.')
  process.exit(0)
}

const needsTurnstile = pendingFiles.length > 0
if (needsTurnstile) {
  if (!turnstileToken) {
    console.error('Missing Turnstile token in PR body')
    process.exit(1)
  }
  if (turnstileToken !== 'maintainer-bypass') {
    const secret = process.env.TURNSTILE_SECRET
    if (secret) {
      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, response: turnstileToken }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyData.success) {
        console.error('Turnstile verification failed', verifyData)
        process.exit(1)
      }
      console.log('Turnstile OK')
    } else {
      console.warn('TURNSTILE_SECRET not set, skipping Turnstile verification')
    }
  }
}

let failed = false

for (const file of pendingFiles) {
  const fullPath = join(root, file)
  let data
  try {
    data = JSON.parse(await readFile(fullPath, 'utf-8'))
  } catch (e) {
    console.error(`Failed to parse ${file}:`, e)
    failed = true
    continue
  }

  const valid = validatePending(data)
  if (!valid) {
    console.error(`Pending schema validation failed for ${file}:`, validatePending.errors)
    failed = true
    continue
  }

  const expectedId = file.replace('data/pending/', '').replace(/\.json$/, '')
  if (data.id !== expectedId) {
    console.error(`ID mismatch in ${file}`)
    failed = true
    continue
  }

  console.log(`OK pending: ${file}`)
}

for (const file of restaurantFiles) {
  const fullPath = join(root, file)
  let data
  try {
    data = JSON.parse(await readFile(fullPath, 'utf-8'))
  } catch (e) {
    console.error(`Failed to parse ${file}:`, e)
    failed = true
    continue
  }

  const valid = validateRestaurant(data)
  if (!valid) {
    console.error(`Schema validation failed for ${file}:`, validateRestaurant.errors)
    failed = true
    continue
  }

  const expectedId = file.replace('data/restaurants/', '').replace(/\.json$/, '')
  if (data.id !== expectedId) {
    console.error(`ID mismatch in ${file}`)
    failed = true
    continue
  }

  const keys = data.recommenders.map((r) => `${r.platform}:${r.authorId}`)
  if (new Set(keys).size !== keys.length) {
    console.error(`Duplicate recommender in ${file}`)
    failed = true
    continue
  }

  console.log(`OK restaurant: ${file}`)
}

if (failed) process.exit(1)
console.log('All validations passed')
