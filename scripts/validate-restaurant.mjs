import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const schemaPath = join(root, 'data', 'schema', 'restaurant.schema.json')

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)
const schema = JSON.parse(await readFile(schemaPath, 'utf-8'))
const validate = ajv.compile(schema)

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: node scripts/validate-restaurant.mjs <path-to-json>')
  process.exit(1)
}

const data = JSON.parse(await readFile(filePath, 'utf-8'))
const valid = validate(data)
if (!valid) {
  console.error(JSON.stringify(validate.errors, null, 2))
  process.exit(1)
}

console.log('OK')
