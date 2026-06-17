const FOOD_KEYWORDS = ['探店', '美食', '好吃', '必吃', '打卡', '餐厅', '饭店', '小吃', '火锅', '烧烤', '早茶', '面馆', '测评']
const CITIES = [
  '北京', '上海', '广州', '深圳', '成都', '杭州', '西安', '重庆', '南京', '武汉',
  '长沙', '厦门', '苏州', '天津', '青岛', '大连', '沈阳', '哈尔滨', '昆明', '贵阳',
]

export function extractBvid(url) {
  const m = String(url).match(/BV[\w]+/i)
  return m ? m[0] : null
}

export function extractAvId(url) {
  const m = String(url).match(/av(\d+)/i)
  return m ? m[1] : null
}

export function extractCity(text) {
  for (const city of CITIES) {
    if (text.includes(city)) return city
  }
  return ''
}

export function extractRestaurantName(title) {
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

export function isFoodVideoTitle(title) {
  return FOOD_KEYWORDS.some((k) => title.includes(k))
}

export function heuristicRating(title, desc = '') {
  const text = `${title} ${desc}`
  if (/必吃|绝了|天花板|强烈推荐/.test(text)) return 5
  if (/推荐|不错|好吃|值得/.test(text)) return 4
  if (/一般|还行/.test(text)) return 3
  if (/避雷|不推荐|难吃/.test(text)) return 2
  return 4
}

export async function fetchBilibiliVideo(bvidOrUrl) {
  const bvid = String(bvidOrUrl).startsWith('BV') ? bvidOrUrl : extractBvid(bvidOrUrl)
  const av = !bvid ? extractAvId(bvidOrUrl) : null
  const param = bvid ? `bvid=${bvid}` : `aid=${av}`
  if (!bvid && !av) throw new Error('无法识别 B 站视频链接')

  const res = await fetch(`https://api.bilibili.com/x/web-interface/view?${param}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.bilibili.com' },
  })
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
    videoUrl: `https://www.bilibili.com/video/${d.bvid}`,
  }
}

export async function fetchBilibiliSpaceVideos(mid, maxPages = 3) {
  const items = []
  let page = 1
  const pageSize = 30

  while (page <= maxPages) {
    const url = `https://api.bilibili.com/x/space/arc/search?mid=${mid}&ps=${pageSize}&tid=0&pn=${page}&order=pubdate`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: `https://space.bilibili.com/${mid}`,
      },
    })
    const data = await res.json()
    if (data.code !== 0) break

    const vlist = data.data?.list?.vlist ?? []
    if (!vlist.length) break

    for (const v of vlist) {
      if (!isFoodVideoTitle(v.title)) continue
      items.push({
        bvid: v.bvid,
        title: v.title,
        desc: v.description ?? '',
        videoUrl: `https://www.bilibili.com/video/${v.bvid}`,
        suggestedName: extractRestaurantName(v.title),
        suggestedCity: extractCity(v.title),
      })
    }

    if (vlist.length < pageSize) break
    page++
  }

  return items
}

export function parseBilibiliMeta(meta) {
  const text = `${meta.title} ${meta.desc}`
  return {
    city: extractCity(text),
    name: extractRestaurantName(meta.title),
    cuisine: [],
    address: '',
    dishes: [],
    reason: meta.desc || meta.title,
    rating: heuristicRating(meta.title, meta.desc),
    ratingSummary: meta.title.slice(0, 80),
    videoTitle: meta.title,
  }
}
