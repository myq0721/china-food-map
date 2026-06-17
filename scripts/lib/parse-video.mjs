/** 特厨隋卞等 UP 主视频标题 / 标签解析 */

const SKIP_TAG_NAMES = new Set([
  '美食', '美食探店', '探店', '隋坡', '隋卞', '特厨隋卞', '舌尖真探事务所',
  '生活', '记录', 'vlog', 'VLOG', '原创', '短片', '攻略', '旅行', '旅游',
  '打卡', '必吃', '好吃', '推荐', '测评', '评测', '闲聊', '日常', '分享', '治愈',
  '中国', '中华', '舌尖上的中国',
])

export const CITIES = [
  '乌鲁木齐', '呼和浩特', '齐齐哈尔', '克拉玛依', '石河子', '库尔勒',
  '香格里拉', '张家界', '石家庄', '哈尔滨', '连云港',
  '北京', '上海', '天津', '重庆',
  '广州', '深圳', '东莞', '佛山', '珠海', '惠州', '中山', '江门', '湛江', '汕头', '揭阳', '梅州',
  '成都', '绵阳', '乐山', '德阳', '宜宾', '南充', '泸州',
  '杭州', '宁波', '温州', '绍兴', '嘉兴', '金华', '台州', '湖州', '丽水', '衢州', '舟山',
  '南京', '苏州', '无锡', '常州', '南通', '扬州', '镇江', '泰州', '淮安', '盐城', '徐州',
  '武汉', '宜昌', '襄阳', '荆州', '黄石',
  '西安', '咸阳', '宝鸡', '延安', '汉中',
  '长沙', '株洲', '湘潭', '岳阳', '衡阳',
  '郑州', '洛阳', '开封', '新乡', '南阳',
  '济南', '青岛', '烟台', '威海', '潍坊', '淄博', '临沂', '泰安', '日照',
  '合肥', '芜湖', '马鞍山', '蚌埠', '安庆', '黄山',
  '福州', '厦门', '泉州', '漳州', '莆田', '龙岩',
  '南昌', '九江', '赣州', '景德镇',
  '南宁', '桂林', '柳州', '北海',
  '海口', '三亚',
  '昆明', '大理', '丽江', '曲靖', '西双版纳',
  '贵阳', '遵义', '六盘水',
  '兰州', '天水', '敦煌',
  '西宁', '银川', '拉萨',
  '沈阳', '大连', '鞍山', '抚顺', '锦州', '丹东', '营口',
  '长春', '吉林', '四平', '延边',
  '太原', '大同', '运城', '临汾', '平遥',
  '保定', '唐山', '秦皇岛', '邯郸', '张家口',
  '包头', '鄂尔多斯', '喀什', '伊犁', '吐鲁番',
  '香港', '澳门', '台北', '高雄',
  '内蒙', '内蒙古', '新疆', '西藏', '宁夏', '广西',
]

const CITY_ALIASES = {
  内蒙: '呼和浩特',
  内蒙古: '呼和浩特',
  新疆: '乌鲁木齐',
  西藏: '拉萨',
  宁夏: '银川',
  广西: '南宁',
  河南: '郑州',
  江苏: '南京',
}

const CITY_SET = new Set(CITIES)

const RESTAURANT_SUFFIX =
  /([\u4e00-\u9fa5A-Za-z0-9·]{2,20}(?:宾馆|饭店|餐厅|酒楼|食府|老菜馆|老菜|大院|面馆|火锅|烧烤|焖把炖|家常菜|包子铺|砂锅|小吃店|小馆|食斋|食堂|大排档|排档|烤鸭店|拉面馆|米线店|咖啡馆|咖啡厅|茶餐厅|私房菜|土菜馆|农庄|农家乐))/

export function extractCityFromText(text) {
  if (!text) return ''
  for (const city of CITIES) {
    if (text.includes(city)) return CITY_ALIASES[city] ?? city
  }
  return ''
}

export function extractCityFromTags(tags) {
  if (!tags?.length) return ''
  for (const raw of tags) {
    const name = (typeof raw === 'string' ? raw : raw.tag_name)?.trim()
    if (!name || SKIP_TAG_NAMES.has(name)) continue
    if (CITY_SET.has(name)) return CITY_ALIASES[name] ?? name
    const fromText = extractCityFromText(name)
    if (fromText) return fromText
  }
  return ''
}

function cleanName(name) {
  return name
    .replace(/^[#@]+|[#@]+$/g, '')
    .replace(/[？?！!。，,、~～]+$/g, '')
    .trim()
}

function normalizeRestaurantName(name) {
  let n = cleanName(name)
  n = n.replace(/(?:餐厅|体验店)$/, '')
  return n
}

function extractLastRestaurantName(text) {
  const suffixes = [
    '老菜馆', '家常菜', '焖把炖', '小吃店', '大排档', '茶餐厅', '私房菜', '土菜馆',
    '宾馆', '饭店', '餐厅', '酒楼', '食府', '大院', '面馆', '火锅', '烧烤', '砂锅', '农庄', '农家乐',
  ]
  for (const suf of suffixes) {
    const idx = text.lastIndexOf(suf)
    if (idx <= 0) continue
    const start = Math.max(0, idx - 14)
    const segment = text.slice(start, idx + suf.length)
    const escaped = suf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const m = segment.match(new RegExp(`([\\u4e00-\\u9fa5·A-Za-z0-9]{2,14}${escaped})$`))
    if (m) return normalizeRestaurantName(m[1])
  }
  return ''
}

/** 特厨隋卞：特厨探店|描述—店名（支持空格、全角冒号分隔） */
export function parseSuibanTitle(title) {
  const result = { name: '', city: '' }
  if (!title) return result

  const normalized = title.replace(/[【】\[\]《》]/g, '').trim()
  if (!/^特厨探店/.test(normalized)) return result

  const pipeBody = normalized.replace(/^特厨探店\s*[｜|]\s*/, '')

  const dashIdx = Math.max(
    pipeBody.lastIndexOf('—'),
    pipeBody.lastIndexOf('－'),
    pipeBody.lastIndexOf('-'),
  )
  if (dashIdx >= 0) {
    const descPart = pipeBody.slice(0, dashIdx)
    const namePart = pipeBody.slice(dashIdx + 1)
    result.name = normalizeRestaurantName(namePart)
    result.city = extractCityFromText(namePart) || extractCityFromText(descPart)
    return result
  }

  const colonMatch = pipeBody.match(/^(.+?)[：:](.+)$/)
  if (colonMatch) {
    result.name = normalizeRestaurantName(colonMatch[2])
    result.city = extractCityFromText(colonMatch[2]) || extractCityFromText(colonMatch[1])
    return result
  }

  const afterPipe = pipeBody
  if (afterPipe) {
    const fromLast = extractLastRestaurantName(afterPipe)
    if (fromLast) {
      result.name = fromLast
      result.city = extractCityFromText(afterPipe)
      return result
    }
    result.city = extractCityFromText(afterPipe)
  }

  return result
}

export function parseVideoFields({ title, desc = '', tags = [], collectionCity = '' }) {
  const suiban = parseSuibanTitle(title)
  const text = `${title}\n${desc}`
  let name = suiban.name

  if (!name) {
    const allMatches = [...title.matchAll(new RegExp(RESTAURANT_SUFFIX.source, 'g'))]
    if (allMatches.length) name = normalizeRestaurantName(allMatches[allMatches.length - 1][1])
    if (!name) name = extractLastRestaurantName(title)
  }

  let city = collectionCity?.trim() || ''
  if (!city && name) city = extractCityFromText(name)
  if (!city) city = suiban.city || extractCityFromText(text)
  if (!city) city = extractCityFromTags(tags)

  return { name: name ? normalizeRestaurantName(name) : '', city }
}

/** 过滤标题描述句被误识别为店名的情况 */
export function isPlausibleRestaurantName(name, title = '') {
  if (!name || name.length < 2 || name.length > 20) return false
  if (/第一个|全好评|排.{0,8}队|你来过|怎么样|到底|评论里|多说一句|招投标|建平|新人博主|物理意义|根本吃不完|厨师的职责|半夜来|听说|四位数|清华和北大/.test(name)) {
    return false
  }
  if (title && /^特厨探店/.test(title) && /[—－\-]/.test(title)) {
    const expected = parseSuibanTitle(title).name
    if (expected && expected !== name) return false
  }
  return true
}

export function isFoodVideoTitle(title) {
  const keys = ['探店', '美食', '好吃', '必吃', '打卡', '餐厅', '饭店', '小吃', '火锅', '烧烤', '早茶', '面馆', '测评', '宾馆', '食府']
  return keys.some((k) => title.includes(k))
}

export function heuristicRating(title, desc = '') {
  const text = `${title} ${desc}`
  if (/必吃|绝了|天花板|强烈推荐/.test(text)) return 5
  if (/推荐|不错|好吃|值得/.test(text)) return 4
  if (/一般|还行/.test(text)) return 3
  if (/避雷|不推荐|难吃/.test(text)) return 2
  return 4
}
