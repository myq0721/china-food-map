import type { BilibiliParseResult } from '@/types/restaurant'

const FOOD_KEYWORDS = ['探店', '美食', '好吃', '必吃', '打卡', '餐厅', '饭店', '小吃', '火锅', '烧烤', '早茶', '面馆', '测评']
const CITIES = [
  '北京', '上海', '广州', '深圳', '成都', '杭州', '西安', '重庆', '南京', '武汉',
  '长沙', '厦门', '苏州', '天津', '青岛', '大连', '沈阳', '哈尔滨', '昆明', '贵阳',
]

export function extractBvid(url: string): string | null {
  const m = url.match(/BV[\w]+/i)
  return m ? m[0] : null
}

export function extractAvId(url: string): string | null {
  const m = url.match(/av(\d+)/i)
  return m ? m[1] : null
}

function extractCity(text: string): string {
  for (const city of CITIES) {
    if (text.includes(city)) return city
  }
  return ''
}

function extractRestaurantName(title: string): string {
  const patterns = [
    /(?:探店|打卡|必吃|美食)[｜|]?(.{2,12}?)(?:！|!|？|\?|，|,|。| |$)/,
    /(.{2,10}?)(?:店|馆|楼|酒家|餐厅|火锅|烧烤|小吃)/,
  ]
  for (const p of patterns) {
    const m = title.match(p)
    if (m?.[1]) return m[1].replace(/[【】\[\]]/g, '').trim()
  }
  return ''
}

function heuristicRating(title: string, desc: string): number {
  const text = `${title} ${desc}`
  if (/必吃|绝了|天花板|强烈推荐/.test(text)) return 5
  if (/推荐|不错|好吃|值得/.test(text)) return 4
  if (/一般|还行/.test(text)) return 3
  if (/避雷|不推荐|难吃/.test(text)) return 2
  return 4
}

export interface BilibiliVideoMeta {
  bvid: string
  title: string
  desc: string
  ownerName: string
  ownerMid: number
  pic: string
}

export async function fetchBilibiliVideo(bvidOrUrl: string): Promise<BilibiliVideoMeta> {
  const bvid = bvidOrUrl.startsWith('BV') ? bvidOrUrl : extractBvid(bvidOrUrl)
  const av = !bvid ? extractAvId(bvidOrUrl) : null
  const param = bvid ? `bvid=${bvid}` : `aid=${av}`
  if (!bvid && !av) throw new Error('无法识别 B 站视频链接')

  const res = await fetch(`https://api.bilibili.com/x/web-interface/view?${param}`)
  const json = await res.json()
  if (json.code !== 0) throw new Error(json.message ?? '获取视频信息失败')

  const d = json.data
  return {
    bvid: d.bvid,
    title: d.title,
    desc: d.desc ?? '',
    ownerName: d.owner.name,
    ownerMid: d.owner.mid,
    pic: d.pic,
  }
}

export function parseBilibiliMeta(meta: BilibiliVideoMeta): BilibiliParseResult {
  const text = `${meta.title} ${meta.desc}`
  const city = extractCity(text)
  const name = extractRestaurantName(meta.title)
  const rating = heuristicRating(meta.title, meta.desc)

  return {
    city,
    name,
    cuisine: [],
    address: '',
    dishes: [],
    reason: meta.desc || meta.title,
    rating,
    ratingSummary: meta.title.slice(0, 80),
    videoTitle: meta.title,
  }
}

export function isFoodVideoTitle(title: string): boolean {
  return FOOD_KEYWORDS.some((k) => title.includes(k))
}
