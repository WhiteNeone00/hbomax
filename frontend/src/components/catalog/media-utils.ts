import type { MediaItem } from '../../types/media'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002'

export function getTitle(item: MediaItem) {
  return item.title ?? item.name ?? 'Untitled'
}

export function getPoster(path?: string | null, size = 'w500') {
  if (!path) return undefined
  // Use image proxy to bypass CORS/ORB restrictions
  return `${API_BASE}/api/image-proxy?url=${encodeURIComponent(path)}&size=${size}`
}

export function getBackdrop(path?: string | null, size = 'w1280') {
  if (!path) return undefined
  return `${API_BASE}/api/image-proxy?url=${encodeURIComponent(path)}&size=${size}`
}

export function getLogo(path?: string | null, size = 'w500') {
  if (!path) return undefined
  return `${API_BASE}/api/image-proxy?url=${encodeURIComponent(path)}&size=${size}`
}