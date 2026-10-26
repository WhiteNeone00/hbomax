export type MediaItem = {
  id: number
  title?: string
  name?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  logo_path?: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  media_type?: 'movie' | 'tv'
  content_rating?: string
  content_rating_descriptors?: string[]
  content_rating_source?: 'kijkwijzer' | 'tmdb'
  content_rating_region?: string
  content_rating_original?: string
  number_of_seasons?: number
  genres?: Array<{ id: number; name: string }>
  status?: string
  release_label?: string
  seasons?: Array<{ season_number: number; episode_count: number }>
  next_episode_to_air?: { air_date?: string; season_number: number; episode_number: number } | null
}

export type ContentRow = {
  id: string
  title: string
  items: MediaItem[]
}

export type HomeData = {
  featured: MediaItem | null
  hero_items: MediaItem[]
  rows: ContentRow[]
}