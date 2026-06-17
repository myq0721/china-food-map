import type { BilibiliParseResult } from '@/types/restaurant'

const SKIP_TAG_NAMES = new Set([
  '美食', '美食探店', '探店', '隋坡', '隋卞', '特厨隋卞', '舌尖真探事务所',
  '生活', '记录', 'vlog', '原创', '攻略', '旅行', '打卡', '测评',
])

const CITIES = [
  '乌鲁木齐', '呼和浩特', '齐齐哈尔', '克拉玛依', '石家庄', '哈尔滨', '连云港',
  '北京', '上海', '天津', '重庆', '广州', '深圳', '成都', '杭州', '西安', '南京', '武汉',
  '长沙', '厦门', '苏州', '青岛', '大连', '沈阳', '昆明', '贵阳', '郑州', '济南', '福州',
  '合肥', '南昌', '南宁', '海口', '兰州', '西宁', '银川', '拉萨', '太原', '无锡', '宁波',
  '温州', '东莞', '佛山', '珠海', '惠州', '中山', '嘉兴', '金华', '绍兴', '扬州', '淮安',
  '泰州', '镇江', '南通', '徐州', '盐城', '常州', '唐山', '保定', '邯郸', '洛阳', '开封',
  '桂林', '柳州', '三亚', '大理', '丽江', '遵义', '芜湖', '马鞍山', '包头', '鄂尔多斯',
  '喀什', '伊犁', '香港', '澳门', '台北', '内蒙', '内蒙古', '新疆', '西藏', '宁夏', '广西',
]

const CITY_ALIASES: Record<string, string> = {
  内蒙: '呼和浩特',
  内蒙古: '呼和浩特',
  新疆: '乌鲁木齐',
  西藏: '拉萨',
  宁夏: '银川',
  广西: '南宁',
}

const CITY_SET = new Set(CITIES)

const RESTAURANT_SUFFIX =
  /([\u4e00-\u9fa5A-Za-z0-9·]{2,20}(?:宾馆|饭店|餐厅|酒楼|食府|老菜馆|老菜|大院|面馆|火锅|烧烤|焖把炖|家常菜|包子铺|砂锅|小吃店|小馆|食斋|食堂|大排档|烤鸭店|拉面馆|茶餐厅|私房菜|土菜馆|农庄))/

function extractCityFromText(text: string): string {
  for (const city of CITIES) {
    if (text.includes(city)) return CITY_ALIASES[city] ?? city
  }
  return ''
}

function extractCityFromTags(tags: { tag_name: string }[]): string {
  for (const t of tags) {
    const name = t.tag_name?.trim()
    if (!name || SKIP_TAG_NAMES.has(name)) continue
    if (CITY_SET.has(name)) return CITY_ALIASES[name] ?? name
    const c = extractCityFromText(name)
    if (c) return c
  }
  return ''
}

function normalizeRestaurantName(name: string): string {
  let n = cleanName(name)
  n = n.replace(/(?:餐厅|体验店)$/, '')
  return n
}

function cleanName(name: string): string {
  return name.replace(/^[#@]+|[#@]+$/g, '').replace(/[？?！!。，,、~～]+$/g, '').trim()
}

function parseSuibanTitle(title: string): { name: string; city: string } {
  const result = { name: '', city: '' }
  const normalized = title.replace(/[【】\[\]《》]/g, '').trim()

  const dash = normalized.match(/^特厨探店[｜|](.+)[—－\-](.+)$/)
  if (dash) {
    result.name = normalizeRestaurantName(dash[2])
    result.city = extractCityFromText(dash[2]) || extractCityFromText(dash[1])
    return result
  }

  const afterPipe = normalized.includes('｜')
    ? normalized.split('｜')[1]
    : normalized.includes('|')
      ? normalized.split('|')[1]
      : normalized

  if (afterPipe) {
    const all = [...afterPipe.matchAll(new RegExp(RESTAURANT_SUFFIX.source, 'g'))]
    if (all.length) {
      result.name = normalizeRestaurantName(all[all.length - 1][1])
      result.city = extractCityFromText(afterPipe)
    }
  }
  return result
}

function parseVideoFields(title: string, desc: string, tags: { tag_name: string }[]): { name: string; city: string } {
  const suiban = parseSuibanTitle(title)
  let name = suiban.name
  if (!name) {
    const all = [...title.matchAll(new RegExp(RESTAURANT_SUFFIX.source, 'g'))]
    if (all.length) name = normalizeRestaurantName(all[all.length - 1][1])
  }
  let city = ''
  if (name) city = extractCityFromText(name)
  if (!city) city = suiban.city || extractCityFromText(`${title}\n${desc}`)
  if (!city) city = extractCityFromTags(tags)
  return { name: name ? normalizeRestaurantName(name) : '', city }
}

export function extractBvid(url: string): string | null {
  const m = url.match(/BV[\w]+/i)
  return m ? m[0] : null
}

export function extractAvId(url: string): string | null {
  const m = url.match(/av(\d+)/i)
  return m ? m[1] : null
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
  tags?: { tag_name: string }[]
}

async function fetchTags(bvid: string): Promise<{ tag_name: string }[]> {
  const res = await fetch(`https://api.bilibili.com/x/tag/archive/tags?bvid=${bvid}`)
  const json = await res.json()
  return json.code === 0 ? json.data ?? [] : []
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
  const tags = bvid ? await fetchTags(bvid).catch(() => []) : []

  return {
    bvid: d.bvid,
    title: d.title,
    desc: d.desc ?? '',
    ownerName: d.owner.name,
    ownerMid: d.owner.mid,
    pic: d.pic,
    tags,
  }
}

export function parseBilibiliMeta(meta: BilibiliVideoMeta): BilibiliParseResult {
  const parsed = parseVideoFields(meta.title, meta.desc, meta.tags ?? [])
  return {
    city: parsed.city,
    name: parsed.name,
    cuisine: [],
    address: '',
    dishes: [],
    reason: meta.desc || meta.title,
    rating: heuristicRating(meta.title, meta.desc),
    ratingSummary: meta.title.slice(0, 80),
    videoTitle: meta.title,
  }
}

export function isFoodVideoTitle(title: string): boolean {
  return ['探店', '美食', '饭店', '餐厅', '宾馆', '火锅', '烧烤', '面馆'].some((k) => title.includes(k))
}
