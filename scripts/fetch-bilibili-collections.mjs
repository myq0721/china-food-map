import { getBvidCityMap } from './lib/collections.mjs'

const mid = process.env.BILIBILI_MID ?? '3546888255048212'
const refresh = process.argv.includes('--refresh')

async function main() {
  console.log(`拉取 mid=${mid} 的 B 站合集城市映射${refresh ? '（强制刷新）' : ''}…`)
  const map = await getBvidCityMap(mid, {
    refresh,
    onProgress: (msg) => console.log(msg),
  })
  console.log(`\n完成：${map.seasons.length} 个地域合集，${Object.keys(map.bvidToCity).length} 条视频已映射`)
  console.log('缓存 -> data/meta/bilibili-collections.json')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
