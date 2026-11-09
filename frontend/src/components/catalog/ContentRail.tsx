import { useEffect, useRef, useState } from 'react'
import type { ContentRow, MediaItem } from '../../types/media'
import { MediaCard } from './MediaCard'

// HBO Max SVG icons for pagination arrows (ContentRail style)
const LeftArrowIcon = () => (
  <div className="StyledArrowIconContainer-Fuse-Web-Play__sc-1sv8jow-2 kbltqf">
    <svg xmlns="http://www.w3.org/2000/svg" fill="#fff" focusable="false" stroke="none" viewBox="0 0 48 48" role="presentation" aria-hidden="true" className="StyledArrowIcon-Fuse-Web-Play__sc-1sv8jow-0 kNhwiN">
      <path fillRule="evenodd" clipRule="evenodd" d="M36.71 24 19.498 31.213a1.714 1.714 0 0 1-2.425-2.425L31.861 24 19.073 9.212a1.714 1.714 0 1 1 2.425-2.424L36.71 21.999Z"></path>
    </svg>
    <svg xmlns="http://www.w3.org/2000/svg" fill="#fff" focusable="false" stroke="none" viewBox="0 0 48 48" role="presentation" aria-hidden="true" className="StyledArrowIconSolid-Fuse-Web-Play__sc-1sv8jow-1 cIzlnm">
      <path fillRule="evenodd" clipRule="evenodd" d="M37.316 24 19.801 37.515a2.143 2.143 0 0 1-3.03-3.03L31.256 24 16.77 8.485a2.143 2.143 0 0 1 3.03-3.03L37.316 20.999Z"></path>
    </svg>
  </div>
)

// Hero-style arrow icons for episodes rail (smaller version of hero arrows)
const EpisodeRailArrowIcon = ({ direction }: { direction: 'previous' | 'next' }) => (
  <svg className={`episode-rail-arrow-icon is-${direction}`} viewBox="0 0 48 48" aria-hidden="true" fill="currentColor">
    <path className="episode-rail-arrow-outline" d="M11.29 24 28.502 6.787a1.714 1.714 0 0 1 2.425 2.425L16.139 24l14.788 14.788a1.714 1.714 0 1 1-2.425 2.424L11.29 23.999Z" />
    <path className="episode-rail-arrow-solid" d="M10.684 24 28.199 6.485a2.143 2.143 0 0 1 3.03 3.03L16.744 24 31.23 38.485a2.143 2.143 0 0 1-3.03 3.03L10.684 24Z" />
  </svg>
)

export function ContentRail({ row, savedIds, onToggleSave }: {
  row: ContentRow
  savedIds: Set<number>
  onToggleSave: (item: MediaItem) => void
}) {
  const railRef = useRef<HTMLDivElement>(null)
  const isFeatured = row.id === 'trending' || row.id === 'recommended' || row.id === 'live-upcoming' || row.id === 'continue-watching' || row.id === 'villains' || row.id === 'trending-series' || row.id === 'comic-books' || row.id === 'family' || row.id === 'hbo-highlights'
  const isLiveUpcoming = row.id === 'live-upcoming'
  const isContinueWatching = row.id === 'continue-watching'
  const hideTitle = ['series', 'movies', 'saved-titles'].includes(row.id)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return

    const updateScrollState = () => {
      const maxScrollLeft = rail.scrollWidth - rail.clientWidth
      setCanScrollLeft(rail.scrollLeft > 1)
      setCanScrollRight(maxScrollLeft > 1 && rail.scrollLeft < maxScrollLeft - 1)
    }
    const frame = requestAnimationFrame(updateScrollState)
    rail.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)

    return () => {
      cancelAnimationFrame(frame)
      rail.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [row.items.length])

  function getItemWidth(): number {
    const width = railRef.current?.clientWidth ?? 0
    // Determine breakpoint and return appropriate item width
    if (width >= 1537) {
      // 100% zoom = 1920px
      return isLiveUpcoming ? 283.325 : isContinueWatching ? 325 : 207.5
    } else if (width >= 1281) {
      // 125% zoom = 1536px
      return isLiveUpcoming ? 339 : isContinueWatching ? 325 : 219.325
    } else if (width >= 1025) {
      // 150% zoom = 1280px
      return isLiveUpcoming ? 284 : isContinueWatching ? 325 : 184
    } else if (width >= 769) {
      // tablet landscape
      return isLiveUpcoming ? 333.86 : isContinueWatching ? 325 : 229
    } else if (width >= 641) {
      // tablet portrait / 200% zoom
      return isLiveUpcoming ? 288 : isContinueWatching ? 325 : 213
    } else if (width >= 376) {
      // mobile / 250-300% zoom
      return isLiveUpcoming ? 288 : isContinueWatching ? 325 : 174
    } else {
      // ≤375px small mobile
      return isLiveUpcoming ? 234.66 : isContinueWatching ? 325 : 142
    }
  }

function scroll(direction: number) {
    const rail = railRef.current
    if (!rail) return
    
    // Scroll by one item width plus gap, so we see half of the next/previous item
    const itemWidth = getItemWidth()
    const gap = 16
    const distance = itemWidth + gap
    rail.scrollBy({ left: direction * distance, behavior: 'smooth' })
  }

  const showArrows = isFeatured && (isHovered || canScrollLeft || canScrollRight)

  return (
    <section 
      className={`content-section${isFeatured ? ' featured-rail-section' : ''}${hideTitle ? ' is-untitled' : ''}`} 
      aria-label={row.title}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="section-heading">
        {!hideTitle && <div><h2>{row.title}</h2></div>}
      </div>
      <div className={`content-rail${isFeatured ? ' is-featured-rail' : ''}${row.id === 'live-upcoming' ? ' is-live-upcoming-rail' : ''}${isContinueWatching ? ' is-continue-watching-rail' : ''}`} ref={railRef}>
        {row.items.map((item) => <MediaCard key={`${item.media_type ?? 'title'}-${item.id}`} item={item} saved={savedIds.has(item.id)} onToggleSave={onToggleSave} showKijkwijzer={row.id !== 'trending' && row.id !== 'recommended' && row.id !== 'live-upcoming' && row.id !== 'villains' && row.id !== 'trending-series' && row.id !== 'comic-books' && row.id !== 'family' && row.id !== 'hbo-highlights'} featured={isFeatured} isLiveUpcoming={row.id === 'live-upcoming'} isContinueWatching={row.id === 'continue-watching'} />)}
        {isLiveUpcoming && (
          <a 
            href="/live-sports-schedule" 
            className="full-schedule-link"
            aria-label="Go to Full Schedule"
          >
            <span className="full-schedule-text">Go to Full Schedule</span>
            <LeftArrowIcon />
          </a>
        )}
      </div>
      {isFeatured && (
        <>
          {showArrows && (
            <>
              <button className="featured-rail-arrow is-previous" disabled={!canScrollLeft} aria-label={`Previous titles in ${row.title}`} data-position="back" onClick={() => scroll(-1)}><EpisodeRailArrowIcon direction="previous" /></button>
              <button className="featured-rail-arrow is-next" disabled={!canScrollRight} aria-label={`More titles in ${row.title}`} data-position="forward" onClick={() => scroll(1)}><EpisodeRailArrowIcon direction="next" /></button>
            </>
          )}
        </>
      )}
    </section>
  )
}