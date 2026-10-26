import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ContentRow, MediaItem } from '../../types/media'
import { MediaCard } from './MediaCard'

export function ContentRail({ row, savedIds, onToggleSave }: {
  row: ContentRow
  savedIds: Set<number>
  onToggleSave: (item: MediaItem) => void
}) {
  const railRef = useRef<HTMLDivElement>(null)
  const isFeatured = row.id === 'trending'
  const hideTitle = ['series', 'movies', 'saved-titles'].includes(row.id)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

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
    const distance = isFeatured && railRef.current
      ? Math.round(railRef.current.clientWidth * 0.86)
      : 620
    railRef.current?.scrollBy({ left: direction * distance, behavior: 'smooth' })
  }

  return (
    <section className={`content-section${isFeatured ? ' featured-rail-section' : ''}${hideTitle ? ' is-untitled' : ''}`} aria-label={row.title}>
      <div className="section-heading">
        {!hideTitle && <div><h2>{row.title}</h2></div>}
        {!isFeatured && <div className="rail-controls"><button aria-label={`Scroll ${row.title} left`} onClick={() => scroll(-1)}><ArrowLeft size={17} /></button><button aria-label={`Scroll ${row.title} right`} onClick={() => scroll(1)}><ArrowRight size={17} /></button></div>}
      </div>
      <div className={`content-rail${isFeatured ? ' is-featured-rail' : ''}`} ref={railRef}>
        {row.items.map((item) => <MediaCard key={`${item.media_type ?? 'title'}-${item.id}`} item={item} saved={savedIds.has(item.id)} onToggleSave={onToggleSave} showMetadata={row.id !== 'trending'} showKijkwijzer={row.id !== 'trending'} featured={isFeatured} />)}
      </div>
      {isFeatured && <>
        <button className="featured-rail-arrow is-previous" disabled={!canScrollLeft} aria-label="Previous titles in Featured" data-position="back" onClick={() => scroll(-1)}><span className="featured-rail-arrow-protection" aria-hidden="true" /><ChevronLeft size={48} strokeWidth={1.8} /></button>
        <button className="featured-rail-arrow is-next" disabled={!canScrollRight} aria-label="More titles in Featured" data-position="forward" onClick={() => scroll(1)}><span className="featured-rail-arrow-protection" aria-hidden="true" /><ChevronRight size={48} strokeWidth={1.8} /></button>
      </>}
    </section>
  )
}