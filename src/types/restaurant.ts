export type Platform = 'github' | 'twitter' | 'douyin' | 'bilibili'

export interface Dish {
  name: string
  price?: string
}

export interface Comment {
  author: string
  text: string
}

export interface Recommender {
  authorId: string
  platform: Platform
  profileUrl?: string
  recommendedAt: string
  dishes?: Dish[]
  reason?: string
  comments?: Comment[]
  sourceVideoUrl?: string
}

export interface Restaurant {
  id: string
  city: string
  name: string
  cuisine?: string[]
  address?: string
  coordinates?: [number, number] | null
  createdAt: string
  updatedAt: string
  recommenders: Recommender[]
}

export interface RestaurantIndexEntry extends Restaurant {
  recommenderCount: number
  latestRecommendedAt: string
}

export interface RestaurantIndex {
  generatedAt: string
  count: number
  restaurants: RestaurantIndexEntry[]
}

export interface PendingSubmission {
  id: string
  status: 'pending'
  submittedAt: string
  restaurant: {
    city: string
    name: string
    cuisine?: string[]
    address?: string
    coordinates?: [number, number] | null
  }
  recommender: Recommender
}

export interface SubmitFormData {
  city: string
  name: string
  cuisine: string[]
  address: string
  dishes: Dish[]
  reason: string
  comments: Comment[]
  platform: Platform
  authorId: string
  profileUrl?: string
  sourceVideoUrl: string
}

export interface CuratedCreator {
  platform: Platform
  displayName: string
  profileUrl: string
  authorId: string
  enabled: boolean
}

export interface ImportDraftItem {
  id: string
  creatorAuthorId: string
  creatorDisplayName: string
  platform: Platform
  videoTitle: string
  videoUrl: string
  suggestedName?: string
  suggestedCity?: string
  status: 'draft' | 'imported'
}

export interface ImportDrafts {
  generatedAt: string
  items: ImportDraftItem[]
}

export function recommenderKey(r: Pick<Recommender, 'platform' | 'authorId'>): string {
  return `${r.platform}:${r.authorId}`
}
