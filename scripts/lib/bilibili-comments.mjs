import { fetchBiliJson, sleep } from './wbi.mjs'
import { fetchBilibiliVideo } from './bilibili.mjs'

/** 拉取视频热门评论（前若干条） */
export async function fetchVideoComments(bvidOrUrl, maxCount = 30) {
  const meta = await fetchBilibiliVideo(bvidOrUrl)
  const aid = meta.aid
  if (!aid) return { meta, comments: [] }

  const referer = `https://www.bilibili.com/video/${meta.bvid}`
  const url = `https://api.bilibili.com/x/v2/reply/main?type=1&oid=${aid}&mode=3&pagination_str=${encodeURIComponent(JSON.stringify({ offset: '' }))}&plat=1`
  const data = await fetchBiliJson(url, referer)
  if (data.code !== 0) return { meta, comments: [] }

  const replies = data.data?.replies ?? []
  const texts = []
  for (const r of replies.slice(0, maxCount)) {
    const msg = r.content?.message?.trim()
    if (msg) texts.push(msg)
    for (const sub of (r.replies ?? []).slice(0, 3)) {
      const subMsg = sub.content?.message?.trim()
      if (subMsg) texts.push(subMsg)
    }
  }

  return { meta, comments: texts }
}
