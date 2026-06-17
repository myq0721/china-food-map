import { heuristicRating, extractCity, extractRestaurantName } from './bilibili.mjs'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_BASE = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

const EXTRACT_SCHEMA = `{
  "city": "城市名，无法判断则空字符串",
  "name": "饭店名称，无法判断则空字符串",
  "cuisine": ["菜系标签数组"],
  "address": "地址或空",
  "dishes": [{"name": "菜名", "price": "价格或空"}],
  "reason": "推荐理由摘要",
  "rating": 1到5的整数综合推荐指数,
  "ratingSummary": "一句话简评"
}`

export function hasOpenAI() {
  return Boolean(OPENAI_API_KEY)
}

export async function extractRestaurantFromText(text, context = {}) {
  if (!OPENAI_API_KEY) {
    return fallbackExtract(text, context)
  }

  const system = `你是中国美食探店信息提取助手。根据视频标题、简介或转写文本，提取饭店结构化信息并打 1-5 星综合推荐指数。只输出合法 JSON，格式：${EXTRACT_SCHEMA}`

  const user = [
    context.title ? `标题：${context.title}` : '',
    context.platform ? `平台：${context.platform}` : '',
    `正文：\n${text.slice(0, 6000)}`,
  ]
    .filter(Boolean)
    .join('\n')

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API 错误: ${res.status} ${err}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI 返回为空')

  const parsed = JSON.parse(content)
  parsed.rating = Math.min(5, Math.max(1, Math.round(Number(parsed.rating) || 4)))
  return parsed
}

export async function rateTextSubmission(text) {
  if (!OPENAI_API_KEY) {
    return { rating: 4, ratingSummary: text.slice(0, 60) || '社区推荐' }
  }

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '根据美食推荐文本打 1-5 星并给一句话简评。输出 JSON: {"rating": number, "ratingSummary": string}',
        },
        { role: 'user', content: text.slice(0, 4000) },
      ],
    }),
  })

  if (!res.ok) throw new Error(`OpenAI rate API: ${res.status}`)
  const data = await res.json()
  const parsed = JSON.parse(data.choices[0].message.content)
  parsed.rating = Math.min(5, Math.max(1, Math.round(Number(parsed.rating) || 4)))
  return parsed
}

function fallbackExtract(text, context) {
  const title = context.title ?? text.slice(0, 100)
  return {
    city: extractCity(text),
    name: extractRestaurantName(title),
    cuisine: [],
    address: '',
    dishes: [],
    reason: text.slice(0, 500),
    rating: heuristicRating(title, text),
    ratingSummary: title.slice(0, 80),
  }
}
