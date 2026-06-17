import { copyFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dist = join(__dirname, '..', 'dist')

await copyFile(join(dist, 'index.html'), join(dist, '404.html'))
await writeFile(join(dist, '.nojekyll'), '', 'utf-8')
console.log('Created dist/404.html and dist/.nojekyll for GitHub Pages')
