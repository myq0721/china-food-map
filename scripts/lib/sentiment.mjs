import {
  parseSuibanTitle,
  parseVideoFields,
  extractCityFromText,
  extractCityFromTags,
} from './parse-video.mjs'
import { cityFromCollection } from './collections.mjs'

const POS_STRONG = /天花板|全好评|人生饭店|挖人|绝了|强烈推荐|必吃|热泪盈眶|第一个全好评|封神|顶级|没毛病|闭眼入/
const POS_MILD = /好吃|推荐|舒服|不错|值得|坦诚|规矩|有性价比|超预期|香晕|开心|满意|地道|惊艳/
const NEG_STRONG = /难吃|不推荐|避雷|翻车|失望透顶|再也不|踩雷|拉黑/
const NEG_MILD = /就这|倒霉|管管|来人管管|货不对板|两极分化|一般|不惊艳|还行|凑合|失望|无语|离谱|不行|差评|劝退|踩坑/

const CUISINE_KEYWORDS = [
  ['川菜', /川菜|成都|重庆|麻辣|火锅|回锅|宫保|水煮|担担|钵钵/],
  ['粤菜', /粤菜|粤式|早茶|烧鹅|白切|煲仔|干炒牛河|点心|顺德|广州|深圳/],
  ['湘菜', /湘菜|湖南|剁椒|小炒肉|臭豆腐/],
  ['鲁菜', /鲁菜|山东|济南|把子肉|九转/],
  ['淮扬菜', /淮扬|扬州|淮安|狮子头|软兜|平桥/],
  ['徽菜', /徽菜|安徽|毛豆腐|臭鳜鱼/],
  ['东北菜', /东北|锅包肉|杀猪菜|哈尔滨|齐齐哈尔|沈阳|长春/],
  ['西北菜', /西北|兰州|拉面|羊肉|新疆|西安|肉夹馍|凉皮/],
  ['苏菜', /苏菜|无锡|苏州|南京|杭州|淮扬/],
  ['闽菜', /闽菜|福建|厦门|佛跳墙/],
  ['浙菜', /浙菜|宁波|杭帮|西湖醋鱼/],
  ['北京菜', /北京菜|烤鸭|炸酱面|京味/],
  ['融合菜', /融合|创意|私房/],
]

const DISH_PATTERNS = [
  /招牌[「「]?([\u4e00-\u9fa5]{2,8})/g,
  /必点[「「]?([\u4e00-\u9fa5]{2,8})/g,
  /([\u4e00-\u9fa5]{2,8}(?:鸡|鱼|肉|虾|蟹|面|饭|汤|豆腐|排骨|肘子|包子|饺子|锅包肉|辣子鸡|回锅肉|水煮鱼|烤鸭|牛河|肠粉|烧鹅|米线|扣肉|肥肠|猪肝))/g,
]

const DISH_BLOCKLIST = /群里|评论|每一个|来吃饭|在杭州|冷门|知道今天|双休日|热议|探店|饭店|餐厅|隋|厨师/

function isValidDishName(name) {
  if (!name || name.length < 2 || name.length > 10) return false
  if (DISH_BLOCKLIST.test(name)) return false
  if (/[？?！!，,；;“”"]/.test(name)) return false
  return true
}

export function extractDishesFromText(title, desc = '') {
  const text = `${title}\n${desc}`
  const dishes = new Set()
  for (const re of DISH_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const name = m[1]?.trim()
      if (isValidDishName(name)) dishes.add(name)
    }
  }
  return [...dishes].slice(0, 5).map((name) => ({ name }))
}

function scoreText(text) {
  if (!text) return 0
  let s = 0
  if (POS_STRONG.test(text)) s += 2
  if (POS_MILD.test(text)) s += 1
  if (NEG_STRONG.test(text)) s -= 2
  if (NEG_MILD.test(text)) s -= 1
  return s
}

export function scoreSentiment(title, desc = '', comments = []) {
  let total = scoreText(title) * 2 + scoreText(desc)
  const sample = comments.slice(0, 25)
  for (const c of sample) total += scoreText(c) * 0.15
  return total
}

export function sentimentToRating(score, title = '') {
  if (/第一个全好评|全好评餐厅|人生饭店/.test(title)) return 5
  if (/倒霉|就这\？|来人管管|管管这家/.test(title)) return 2
  if (/货不对板|两极分化/.test(title)) return 3
  if (/不惊艳.*舒服|差点全好评/.test(title)) return 4

  if (score >= 3) return 5
  if (score >= 1.5) return 4
  if (score >= 0) return 3
  if (score >= -1.5) return 2
  return 1
}

export function inferCuisine(title, desc, tags, city) {
  const blob = `${title}\n${desc}\n${city}\n${(tags ?? []).map((t) => t.tag_name ?? t).join(' ')}`
  const found = []
  for (const [name, re] of CUISINE_KEYWORDS) {
    if (re.test(blob)) found.push(name)
  }
  if (!found.length) {
    const regional = {
      成都: '川菜',
      重庆: '川菜',
      广州: '粤菜',
      深圳: '粤菜',
      顺德: '粤菜',
      长沙: '湘菜',
      济南: '鲁菜',
      淮安: '淮扬菜',
      合肥: '徽菜',
      哈尔滨: '东北菜',
      沈阳: '东北菜',
      齐齐哈尔: '东北菜',
      西安: '西北菜',
      乌鲁木齐: '西北菜',
      无锡: '苏菜',
      杭州: '浙菜',
      宁波: '浙菜',
      北京: '北京菜',
    }
    if (regional[city]) found.push(regional[city])
  }
  return [...new Set(found)].slice(0, 3)
}

function titleHook(title) {
  const suiban = parseSuibanTitle(title)
  const body = title.replace(/^特厨探店\s*[｜|]\s*/, '')
  const hook = body.split(/[—－\-]/)[0]?.replace(/[？?！!。]+$/, '').trim()
  return hook || suiban.name || title.slice(0, 40)
}

export function buildRatingSummary(title, rating, comments = []) {
  const hook = titleHook(title)
  const tones = {
    5: ['强烈推荐', '值得专程', '水准在线', '可以闭眼冲'],
    4: ['整体不错', '值得一试', '味道靠谱', '值得推荐'],
    3: ['中规中矩', '有好有坏', '看个人口味', '不算惊艳'],
    2: ['略有失望', '期待偏高', '不太推荐', '慎重选择'],
    1: ['不太建议', '体验较差', '建议避雷', '不推荐前往'],
  }
  const pick = tones[rating] ?? tones[3]
  const idx = Math.abs(hook.length + (comments[0]?.length ?? 0)) % pick.length
  const shortHook = hook.length > 22 ? `${hook.slice(0, 20)}…` : hook
  return `${pick[idx]}：${shortHook}`
}

export function buildReason(title, desc, rating, comments = [], dishes = []) {
  const parts = []
  const suiban = parseSuibanTitle(title)
  if (desc?.trim() && desc.trim() !== title) {
    parts.push(desc.trim().slice(0, 200))
  } else if (suiban.name) {
    parts.push(`特厨隋卞探店「${suiban.name}」，从菜品火候、调味与性价比综合体验来看，`)
    const verdict = {
      5: '整体表现突出，多项菜品在线，值得专程打卡。',
      4: '整体味道靠谱，有几道亮点菜，适合附近觅食。',
      3: '优缺点都比较明显，建议按招牌菜点单。',
      2: '与预期有差距，部分菜品或体验拖了后腿。',
      1: '整体不太理想，不建议抱太高期待。',
    }
    parts.push(verdict[rating] ?? verdict[3])
  }

  if (comments.length) {
    const hot = comments
      .filter((c) => c.length > 4 && c.length < 120)
      .slice(0, 2)
      .map((c) => c.replace(/\[[^\]]+\]/g, '').trim())
    if (hot.length) parts.push(`观众热议：${hot.join('；')}`)
  }

  if (dishes.length) {
    parts.push(`推荐尝试：${dishes.map((d) => d.name).join('、')}。`)
  }

  return parts.join('').slice(0, 500) || title
}

export function resolveCity({ title, desc, tags, collectionCity, bvid, collectionMap }) {
  const coll = collectionCity || (bvid && collectionMap ? cityFromCollection(bvid, collectionMap) : '')
  const parsed = parseVideoFields({ title, desc, tags, collectionCity: coll })
  let city = parsed.city || coll || extractCityFromTags(tags) || extractCityFromText(title)
  if (city === '河南') city = '郑州'
  if (city === '东北' || city === '内蒙') {
    city = extractCityFromText(title) || extractCityFromTags(tags) || (city === '东北' ? '沈阳' : '呼和浩特')
  }
  return city
}

export function analyzeVideoContent({ title, desc, tags, comments, collectionCity, bvid, collectionMap }) {
  const score = scoreSentiment(title, desc, comments)
  const rating = sentimentToRating(score, title)
  const city = resolveCity({ title, desc, tags, collectionCity, bvid, collectionMap })
  const name = parseSuibanTitle(title).name || parseVideoFields({ title, desc, tags }).name
  const cuisine = inferCuisine(title, desc, tags, city)
  const dishes = extractDishesFromText(title, desc)
  const ratingSummary = buildRatingSummary(title, rating, comments)
  const reason = buildReason(title, desc, rating, comments, dishes)

  return { rating, ratingSummary, reason, cuisine, dishes, city, name, sentimentScore: score }
}
