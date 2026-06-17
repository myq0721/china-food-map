import giscusMeta from '../data/meta/giscus.json'

export const REPO_OWNER = 'myq0721'
export const REPO_NAME = 'china-food-map'
export const REPO_FULL = `${REPO_OWNER}/${REPO_NAME}`

export const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID ?? ''
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''

export const GISCUS_REPO = import.meta.env.VITE_GISCUS_REPO ?? REPO_FULL
export const GISCUS_REPO_ID =
  import.meta.env.VITE_GISCUS_REPO_ID ?? (giscusMeta as { repoId?: string }).repoId ?? ''
export const GISCUS_CATEGORY =
  import.meta.env.VITE_GISCUS_CATEGORY ?? (giscusMeta as { category?: string }).category ?? 'Guestbook'
export const GISCUS_CATEGORY_ID =
  import.meta.env.VITE_GISCUS_CATEGORY_ID ?? (giscusMeta as { categoryId?: string }).categoryId ?? ''

export const DATA_BASE = `${import.meta.env.BASE_URL}data`

export const MAINTAINER_LOGIN = 'myq0721'
