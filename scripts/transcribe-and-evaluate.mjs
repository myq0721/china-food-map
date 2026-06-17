/**
 * 单条 B 站视频：下载音频 → Whisper 转写 → LLM 提取店名/城市/推荐指数
 *
 * 依赖：yt-dlp、ffmpeg（PATH 可访问）、OPENAI_API_KEY
 * 用法：node scripts/transcribe-and-evaluate.mjs BV1xxx
 *       node scripts/transcribe-and-evaluate.mjs "https://www.bilibili.com/video/BV1xxx"
 *       node scripts/transcribe-and-evaluate.mjs BV1xxx --write   # 写入 data/restaurants/
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinyin } from 'pinyin-pro'
import { fetchBilibiliVideo, extractBvid } from './lib/bilibili.mjs'
import { getBvidCityMap, cityFromCollection } from './lib/collections.mjs'
import { parseVideoFields } from './lib/parse-video.mjs'
import { transcribeVideoUrl, whisperEnabled } from './lib/whisper-audio.mjs'
import { extractRestaurantFromText, hasOpenAI } from './lib/openai-extract.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function toSlugPart(text) {
  const normalized = text.trim().replace(/\s+/g, '')
  const py = pinyin(normalized, { toneType: 'none', type: 'array' }).join('')
  return py.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown'
}

function buildRestaurantId(city, name) {
  return `${toSlugPart(city)}-${toSlugPart(name)}`
}

async function main() {
  const arg = process.argv.find((a) => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1])
  if (!arg) {
    console.error('用法: node scripts/transcribe-and-evaluate.mjs <BV号或链接> [--write]')
    process.exit(1)
  }

  const writeOut = process.argv.includes('--write')
  const bvid = extractBvid(arg) ?? (arg.startsWith('BV') ? arg : null)
  if (!bvid) {
    console.error('无法识别 BV 号')
    process.exit(1)
  }

  if (!hasOpenAI()) {
    console.warn('⚠ 未设置 OPENAI_API_KEY：将仅用标题/标签规则解析，转写后也无法 LLM 总结')
  }

  process.env.USE_WHISPER = '1'
  if (!whisperEnabled()) {
    console.error('需要 OPENAI_API_KEY 才能使用 Whisper 转写（设置 USE_WHISPER=1 且 API Key 有效）')
    process.exit(1)
  }

  console.log(`获取视频元数据 ${bvid}…`)
  const meta = await fetchBilibiliVideo(bvid)

  let collectionCity = ''
  try {
    const map = await getBvidCityMap(meta.ownerMid, {
      onProgress: (m) => console.log(m),
    })
    collectionCity = cityFromCollection(bvid, map)
    if (collectionCity) console.log(`合集城市: ${collectionCity}`)
  } catch (e) {
    console.warn(`合集映射跳过: ${e.message}`)
  }

  const ruleParsed = parseVideoFields({
    title: meta.title,
    desc: meta.desc,
    tags: meta.tags,
    collectionCity,
  })

  console.log('下载音频并转写（yt-dlp + Whisper）…')
  const transcript = await transcribeVideoUrl(meta.videoUrl)
  if (!transcript) {
    console.error('转写失败：请确认已安装 yt-dlp 与 ffmpeg')
    process.exit(1)
  }
  console.log(`转写完成，${transcript.length} 字`)

  const text = [
    `标题：${meta.title}`,
    meta.desc ? `简介：${meta.desc}` : '',
    collectionCity ? `合集城市：${collectionCity}` : '',
    ruleParsed.name ? `规则解析店名：${ruleParsed.name}` : '',
    `\n【视频转写】\n${transcript}`,
  ]
    .filter(Boolean)
    .join('\n')

  console.log('LLM 提取综合评价…')
  const extracted = await extractRestaurantFromText(text, {
    title: meta.title,
    platform: 'bilibili',
  })

  const city = extracted.city?.trim() || collectionCity || ruleParsed.city
  const name = extracted.name?.trim() || ruleParsed.name

  const result = {
    bvid,
    videoUrl: meta.videoUrl,
    videoTitle: meta.title,
    collectionCity: collectionCity || undefined,
    city,
    name,
    cuisine: extracted.cuisine ?? [],
    address: extracted.address ?? '',
    dishes: extracted.dishes ?? [],
    rating: extracted.rating,
    ratingSummary: extracted.ratingSummary,
    reason: extracted.reason,
    transcriptLength: transcript.length,
    transcriptPreview: transcript.slice(0, 300) + (transcript.length > 300 ? '…' : ''),
  }

  console.log('\n' + JSON.stringify(result, null, 2))

  if (writeOut) {
    if (!city || !name) {
      console.error('缺少城市或店名，无法写入数据库')
      process.exit(1)
    }
    const id = buildRestaurantId(city, name)
    const today = new Date().toISOString().slice(0, 10)
    const restaurant = {
      id,
      city,
      name,
      cuisine: result.cuisine.length ? result.cuisine : undefined,
      address: result.address || undefined,
      coordinates: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recommenders: [
        {
          authorId: String(meta.ownerMid),
          platform: 'bilibili',
          profileUrl: `https://space.bilibili.com/${meta.ownerMid}`,
          recommendedAt: today,
          rating: result.rating,
          ratingSummary: result.ratingSummary,
          reason: result.reason,
          sourceVideoUrl: meta.videoUrl,
          dishes: result.dishes.length ? result.dishes : undefined,
        },
      ],
    }
    const outDir = join(root, 'data', 'restaurants')
    await mkdir(outDir, { recursive: true })
    const outPath = join(outDir, `${id}.json`)
    await writeFile(outPath, JSON.stringify(restaurant, null, 2) + '\n', 'utf-8')
    console.log(`\n已写入 ${outPath}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
