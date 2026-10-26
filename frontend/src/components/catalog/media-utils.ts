import type { MediaItem } from '../../types/media'

const imageBase = 'https://image.tmdb.org/t/p'

export function getTitle(item: MediaItem) {
  return item.title ?? item.name ?? 'Untitled'
}

export function getPoster(path?: string | null, size = 'w500') {
  return path ? `${imageBase}/${size}${path}` : undefined
}