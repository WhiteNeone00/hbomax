import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ContentRow, MediaItem } from '../../types/media'
import { MediaCard } from './MediaCard'

export function ContentRail({ row, savedIds, onToggleSave }: {
  row: ContentRow
  savedIds: Set<number>
  onToggleSave: (item: MediaItem) => void
}) {
  const railRef = useRef<HTMLDivElement>(null)
  const isFeatured = row.id === 'trending' || row.id === 'live-upcoming' || row.id === 'continue-watching'
  const isLiveUpcoming = row.id === 'live-upcoming'
  const hideTitle = ['series', 'movies', 'saved-titles', 'continue-watching'].includes(row.id)
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

  function scroll(direction: number) {
    const rail = railRef.current
    if (!rail) return
    
    // Scroll by one item width plus gap, so we see half of the next/previous item
    const itemWidth = isLiveUpcoming ? 258 : 220 // live-upcoming: 258px, featured: 220px
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
      <div className={`content-rail${isFeatured ? ' is-featured-rail' : ''}${row.id === 'live-upcoming' ? ' is-live-upcoming-rail' : ''}`} ref={railRef}>
        {row.items.map((item) => <MediaCard key={`${item.media_type ?? 'title'}-${item.id}`} item={item} saved={savedIds.has(item.id)} onToggleSave={onToggleSave} showMetadata={false} showKijkwijzer={row.id !== 'trending' && row.id !== 'live-upcoming'} featured={isFeatured} isLiveUpcoming={row.id === 'live-upcoming'} isContinueWatching={row.id === 'continue-watching'} />)}
        {isLiveUpcoming && (
          <a 
            href="/live-sports-schedule" 
            className="full-schedule-link"
            aria-label="Go to Full Schedule"
          >
            <span className="full-schedule-text">Go to Full Schedule</span>
            <ArrowRight size={20} strokeWidth={2} />
          </a>
        )}
      </div>
      {isFeatured && showArrows && <>
        <button className="featured-rail-arrow is-previous" disabled={!canScrollLeft} aria-label={`Previous titles in ${row.title}`} data-position="back" onClick={() => scroll(-1)}><span className="featured-rail-arrow-protection" aria-hidden="true" /><ChevronLeft size={40} strokeWidth={1.8} /></button>
        <button className="featured-rail-arrow is-next" disabled={!canScrollRight} aria-label={`More titles in ${row.title}`} data-position="forward" onClick={() => scroll(1)}><span className="featured-rail-arrow-protection" aria-hidden="true" /><ChevronRight size={40} strokeWidth={1.8} /></button>
      </>}
    </section>
  )
}