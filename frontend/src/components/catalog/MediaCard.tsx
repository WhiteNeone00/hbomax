import { useEffect, useId, useRef, useState } from 'react'
import { Bookmark, Check, Clapperboard, MoreVertical, Play } from 'lucide-react'
import { KijkwijzerBadges } from './KijkwijzerBadge'
import { fetchKijkwijzer } from '../../services/tmdb'
import type { MediaItem } from '../../types/media'
import { getPoster, getTitle } from './media-utils'

function yearOf(item: MediaItem) {
  return (item.release_date ?? item.first_air_date)?.slice(0, 4) ?? ''
}

function releaseBadgeFor(item: MediaItem) {
  const label = item.release_label?.trim() ?? ''
  const normalizedLabel = label.toLowerCase()

  if (/^season \d+ now available$/.test(normalizedLabel)) return 'New'
  if (normalizedLabel === 'new episode' || / at 6 am$/.test(normalizedLabel)) return 'New Episode'
  if (normalizedLabel === 'new') return 'New'
  if (normalizedLabel === 'just added') return 'Just Added'
  if (normalizedLabel === 'leaving soon') return 'Leaving Soon'
  return undefined
}

function getLiveUpcomingTime(item: MediaItem) {
  // For live/upcoming items, use the live_time field from backend (mock sports data)
  if ((item as any).live_time) {
    return (item as any).live_time
  }
  // Fallback to next_episode_to_air if available
  if (item.next_episode_to_air?.air_date) {
    const date = new Date(`${item.next_episode_to_air.air_date}T12:00:00Z`)
    const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(date)
    const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(date)
    return `${day}, ${time}`
  }
  return undefined
}

function getSportType(item: MediaItem) {
  // Get sport type from the item (added by backend for Live & Upcoming)
  return (item as any).sport_type
}

function getWatchProgress(item: MediaItem) {
  // Get watch progress from the item (added by HomePage)
  return (item as any).watchProgress
}

export function MediaCard({ item, saved, onToggleSave, showMetadata = true, showKijkwijzer = true, featured = false, isLiveUpcoming = false, isContinueWatching = false }: {
  item: MediaItem
  saved: boolean
  onToggleSave: (item: MediaItem) => void
  showMetadata?: boolean
  showKijkwijzer?: boolean
  featured?: boolean
  isLiveUpcoming?: boolean
  isContinueWatching?: boolean
}) {
  const poster = getPoster(item.poster_path)
  const releaseBadge = releaseBadgeFor(item)
  const liveTime = isLiveUpcoming ? getLiveUpcomingTime(item) : undefined
  const sportType = isLiveUpcoming ? getSportType(item) : undefined
  const watchProgress = isContinueWatching ? getWatchProgress(item) : undefined
  const progressPercent = watchProgress ? Math.round((watchProgress.current_time / watchProgress.duration) * 100) : 0
  const posterFrame = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const [menuOpen, setMenuOpen] = useState(false)
  const [contentRating, setContentRating] = useState(item.content_rating)
  const [contentRatingDescriptors, setContentRatingDescriptors] = useState(item.content_rating_descriptors ?? [])
  const [contentRatingSource, setContentRatingSource] = useState(item.content_rating_source)
  const [contentRatingRegion, setContentRatingRegion] = useState(item.content_rating_region)
  const [contentRatingOriginal, setContentRatingOriginal] = useState(item.content_rating_original)

  useEffect(() => {
    if (contentRating || contentRatingDescriptors.length) return
    const target = posterFrame.current
    if (!target) return
    let requested = false
    const requestRating = () => {
      if (requested) return
      requested = true
      void fetchKijkwijzer(item)
        .then((result) => {
          setContentRating(result.content_rating)
          setContentRatingDescriptors(result.content_rating_descriptors ?? [])
          setContentRatingSource(result.content_rating_source)
          setContentRatingRegion(result.content_rating_region)
          setContentRatingOriginal(result.content_rating_original)
        })
        .catch(() => undefined)
    }

    if (typeof IntersectionObserver === 'undefined') {
      requestRating()
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        observer.disconnect()
        requestRating()
      }
    }, { rootMargin: '180px' })
    observer.observe(target)
    return () => {
      observer.disconnect()
    }
  }, [contentRating, contentRatingDescriptors.length, item])

  return (
    <article className={`content-card${featured ? ' featured-card' : ''}${isLiveUpcoming ? ' live-upcoming-card' : ''}${isContinueWatching ? ' continue-watching-card' : ''}`}>
      <div className="poster-frame" ref={posterFrame}>
        {poster ? <img src={poster} alt={`${getTitle(item)} poster`} loading="lazy" /> : <div className="poster-empty"><Clapperboard size={26} /></div>}
        {releaseBadge && <span className="content-badge">{releaseBadge}</span>}
        {showKijkwijzer && (contentRating || contentRatingDescriptors.length > 0) && <div className="kijkwijzer-card"><KijkwijzerBadges rating={contentRating} descriptors={contentRatingDescriptors} source={contentRatingSource} region={contentRatingRegion} originalRating={contentRatingOriginal} /></div>}
        
        {/* Live/Upcoming Overlays */}
        {isLiveUpcoming && (
          <div className="tile-overlays">
            <div className="tile-action-menu-protection" aria-hidden="true" />
            {liveTime && (
              <div className="tile-badge-wrapper" data-box-shadow="true" data-variant="tile" style={{ backgroundColor: 'rgb(46, 63, 77)' }}>
                <span className="tile-badge-text" style={{ color: 'rgb(255, 255, 255)' }}>{liveTime}</span>
              </div>
            )}
            <div className="tile-banner-wrapper">
              <div className="tile-banner-text">
                <span className="tile-banner-label">Get Access</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Continue Watching Progress Bar */}
        {isContinueWatching && watchProgress && (
          <div className="tile-progress-bar" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
        
        {featured ? <>
          <button className="featured-menu-toggle" aria-label={`More options for ${getTitle(item)}`} aria-expanded={menuOpen} aria-haspopup="menu" aria-controls={menuId} onClick={() => setMenuOpen((open) => !open)}><MoreVertical size={24} fill="currentColor" /></button>
          {menuOpen && <div className="featured-card-menu" id={menuId} role="menu"><button type="button" role="menuitem" onClick={() => { onToggleSave(item); setMenuOpen(false) }}>{saved ? 'Remove from My Stuff' : 'Add to My Stuff'}</button></div>}
        </> : <button className={`save-button${saved ? ' is-saved' : ''}`} onClick={() => onToggleSave(item)} aria-label={saved ? `Remove ${getTitle(item)} from My Stuff` : `Add ${getTitle(item)} to My Stuff`} title={saved ? 'Remove from My Stuff' : 'Add to My Stuff'}>
          {saved ? <Check size={16} /> : <Bookmark size={16} />}
        </button>}
        {!featured && !isLiveUpcoming && !isContinueWatching && <div className="poster-play" aria-hidden="true"><Play size={18} fill="currentColor" /></div>}
      </div>
      
      {/* Live & Upcoming: Sport type, Title, and Secondary Title below poster (like HBO Max) */}
      {isLiveUpcoming && (
        <div className="tile-meta">
          {sportType && <div className="tile-sport-type" aria-hidden="true"><span>{sportType}</span></div>}
          <div className="tile-title-wrapper">
            <span className="tile-primary-title">{getTitle(item)}</span>
            {item.overview && <span className="tile-secondary-title">{item.overview}</span>}
          </div>
        </div>
      )}
      
      {/* No title/metadata displayed for featured and continue-watching rails */}
    </article>
  )
}