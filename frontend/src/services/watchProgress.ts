import type { MediaItem } from '../types/media'

export type EpisodePosition = { season: number; episode: number }
export type WatchProgress = Record<string, EpisodePosition>

const storageKey = 'hbo-max-watch-progress-v1'

export function loadWatchProgress(): WatchProgress {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? '{}') as WatchProgress
  } catch {
    return {}
  }
}

export function saveWatchProgress(progress: WatchProgress) {
  localStorage.setItem(storageKey, JSON.stringify(progress))
}

export function nextEpisode(item: MediaItem, progress: WatchProgress): EpisodePosition | null {
  if (item.media_type !== 'tv') return null

  const seasons = (item.seasons ?? [])
    .filter((season) => season.season_number > 0 && season.episode_count > 0)
    .sort((first, second) => first.season_number - second.season_number)

  if (!seasons.length) return { season: 1, episode: 1 }

  const lastWatched = progress[String(item.id)]
  if (!lastWatched) return { season: seasons[0].season_number, episode: 1 }

  const currentIndex = seasons.findIndex((season) => season.season_number === lastWatched.season)
  if (currentIndex < 0) return { season: seasons[0].season_number, episode: 1 }

  const currentSeason = seasons[currentIndex]
  if (lastWatched.episode < currentSeason.episode_count) {
    return { season: currentSeason.season_number, episode: lastWatched.episode + 1 }
  }

  const nextSeason = seasons[currentIndex + 1]
  return nextSeason ? { season: nextSeason.season_number, episode: 1 } : null
}