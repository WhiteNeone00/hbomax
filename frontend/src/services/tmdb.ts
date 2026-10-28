import type { HomeData, MediaItem } from '../types/media'

async function apiRequest<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('The catalog server could not be reached. Start both packages with npm run dev.')
  }
  const data = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(data.error ?? 'The catalog is unavailable right now.')
  return data
}

export function fetchHome(watchProgress?: Record<string, any>) {
  const params = watchProgress ? `?watch_progress=${encodeURIComponent(JSON.stringify(watchProgress))}` : ''
  return apiRequest<HomeData>(`/api/home${params}`)
}

export function fetchKijkwijzer(item: MediaItem) {
  const params = new URLSearchParams({
    id: String(item.id),
    title: item.title ?? item.name ?? '',
    type: item.media_type ?? (item.title ? 'movie' : 'tv'),
    year: (item.release_date ?? item.first_air_date)?.slice(0, 4) ?? '',
  })
  return apiRequest<Pick<MediaItem, 'content_rating' | 'content_rating_descriptors' | 'content_rating_source' | 'content_rating_region' | 'content_rating_original'>>(`/api/kijkwijzer?${params}`)
}

export async function searchTitles(query: string) {
  const data = await apiRequest<{ results: MediaItem[] }>(`/api/search?q=${encodeURIComponent(query)}`)
  return data.results
}

export async function fetchEpisodeTitle(seriesId: number, season: number, episode: number): Promise<string | null> {
  try {
    const data = await apiRequest<{ name: string }>(`/api/tmdb/tv/${seriesId}/season/${season}/episode/${episode}`)
    return data.name ?? null
  } catch {
    return null
  }
}