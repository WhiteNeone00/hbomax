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

export function MediaCard({ item, saved, onToggleSave, showMetadata = true, showKijkwijzer = true, featured = false }: {
  item: MediaItem
  saved: boolean
  onToggleSave: (item: MediaItem) => void
  showMetadata?: boolean
  showKijkwijzer?: boolean
  featured?: boolean
}) {
  const poster = getPoster(item.poster_path)
  const releaseBadge = releaseBadgeFor(item)
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
    <article className={`content-card${featured ? ' featured-card' : ''}`}>
      <div className="poster-frame" ref={posterFrame}>
        {poster ? <img src={poster} alt={`${getTitle(item)} poster`} loading="lazy" /> : <div className="poster-empty"><Clapperboard size={26} /></div>}
        {releaseBadge && <span className="content-badge">{releaseBadge}</span>}
        {showKijkwijzer && (contentRating || contentRatingDescriptors.length > 0) && <div className="kijkwijzer-card"><KijkwijzerBadges rating={contentRating} descriptors={contentRatingDescriptors} source={contentRatingSource} region={contentRatingRegion} originalRating={contentRatingOriginal} /></div>}
        {featured ? <>
          <button className="featured-menu-toggle" aria-label={`More options for ${getTitle(item)}`} aria-expanded={menuOpen} aria-haspopup="menu" aria-controls={menuId} onClick={() => setMenuOpen((open) => !open)}><MoreVertical size={24} fill="currentColor" /></button>
          {menuOpen && <div className="featured-card-menu" id={menuId} role="menu"><button type="button" role="menuitem" onClick={() => { onToggleSave(item); setMenuOpen(false) }}>{saved ? 'Remove from My Stuff' : 'Add to My Stuff'}</button></div>}
        </> : <button className={`save-button${saved ? ' is-saved' : ''}`} onClick={() => onToggleSave(item)} aria-label={saved ? `Remove ${getTitle(item)} from My Stuff` : `Add ${getTitle(item)} to My Stuff`} title={saved ? 'Remove from My Stuff' : 'Add to My Stuff'}>
          {saved ? <Check size={16} /> : <Bookmark size={16} />}
        </button>}
        {!featured && <div className="poster-play" aria-hidden="true"><Play size={18} fill="currentColor" /></div>}
      </div>
      {showMetadata && <div className="card-meta"><h3>{getTitle(item)}</h3><span>{yearOf(item) || (item.media_type === 'tv' ? 'Series' : 'Movie')}</span></div>}
    </article>
  )
}