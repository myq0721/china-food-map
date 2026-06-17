import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const execFileAsync = promisify(execFile)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_BASE = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'

export function whisperEnabled() {
  return process.env.USE_WHISPER === '1' && Boolean(OPENAI_API_KEY)
}

export function textNeedsEnhancement(text, extracted = {}) {
  const trimmed = text.trim()
  if (trimmed.length < 80) return true
  if (!extracted.city?.trim() || !extracted.name?.trim()) return true
  return false
}

async function downloadAudio(videoUrl, dir) {
  const outTemplate = join(dir, 'audio.%(ext)s')
  await execFileAsync(
    'yt-dlp',
    ['-x', '--audio-format', 'mp3', '-o', outTemplate, '--no-playlist', videoUrl],
    { timeout: 300_000 },
  )
  const files = await readdir(dir)
  const audioFile = files.find((f) => f.startsWith('audio.'))
  if (!audioFile) throw new Error('yt-dlp 未生成音频文件')
  return join(dir, audioFile)
}

export async function transcribeVideoUrl(videoUrl) {
  if (!whisperEnabled()) return null

  const dir = await mkdtemp(join(tmpdir(), 'cfm-whisper-'))
  try {
    const audioPath = await downloadAudio(videoUrl, dir)
    const buffer = await readFile(audioPath)
    const form = new FormData()
    form.append('file', new Blob([buffer]), 'audio.mp3')
    form.append('model', process.env.WHISPER_MODEL ?? 'whisper-1')

    const res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Whisper API: ${res.status} ${err}`)
    }

    const data = await res.json()
    return data.text?.trim() || null
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export async function buildBilibiliText(meta, videoUrl, extracted = {}) {
  let text = `${meta.title}\n${meta.desc ?? ''}`.trim()
  if (!textNeedsEnhancement(text, extracted)) return text

  try {
    const transcript = await transcribeVideoUrl(videoUrl)
    if (transcript) {
      text = `${meta.title}\n${meta.desc ?? ''}\n\n【视频转写】\n${transcript}`
    }
  } catch (e) {
    console.warn(`Whisper 转写跳过: ${e.message}`)
  }

  return text
}
