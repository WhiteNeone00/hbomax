import { useEffect, useState } from 'react'
import { Check, Play, Plus, X } from 'lucide-react'
import { MediaCard } from '../../components/catalog/MediaCard'
import { ContentRail } from '../../components/catalog/ContentRail'
import { KijkwijzerBadges } from '../../components/catalog/KijkwijzerBadge'
import { getTitle, getBackdrop, getLogo } from '../../components/catalog/media-utils'
import { NavigationBar } from '../../components/navigation/NavigationBar'
import { BrandLogo } from '../../components/navigation/BrandLogo'
import { fetchHome, fetchKijkwijzer, searchTitles } from '../../services/tmdb'
import { loadWatchProgress, nextEpisode, saveWatchProgress, type WatchProgress } from '../../services/watchProgress'
import type { HomeData, MediaItem } from '../../types/media'
import './HomePage.css'

function HeroArrowIcon({ direction }: { direction: 'previous' | 'next' }) {
  return (
    <svg className={`hero-arrow-icon is-${direction}`} viewBox="0 0 48 48" aria-hidden="true">
      <path className="hero-arrow-outline" d="M11.29 24 28.502 6.787a1.714 1.714 0 0 1 2.425 2.425L16.139 24l14.788 14.788a1.714 1.714 0 1 1-2.425 2.424L11.29 23.999Z" />
      <path className="hero-arrow-solid" d="M10.684 24 28.199 6.485a2.143 2.143 0 0 1 3.03 3.03L16.744 24 31.23 38.485a2.143 2.143 0 0 1-3.03 3.03L10.684 24Z" />
    </svg>
  )
}

export default function HomePage() {
  const [home, setHome] = useState<HomeData | null>(null)
  const [error, setError] = useState('')
  const [searchResults, setSearchResults] = useState<MediaItem[] | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchError, setSearchError] = useState('')
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const [myStuffOpen, setMyStuffOpen] = useState(false)
  const [heroDirection, setHeroDirection] = useState<'forward' | 'backward'>('forward')
  const [heroRating, setHeroRating] = useState<{ id: number; rating?: string; descriptors: string[]; source?: 'kijkwijzer' | 'tmdb'; region?: string; originalRating?: string } | null>(null)
  const [heroControlsVisible, setHeroControlsVisible] = useState(false)
  const [savedItems, setSavedItems] = useState<MediaItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('hbo-max-my-stuff') ?? '[]') as MediaItem[]
    } catch {
      return []
    }
  })
  const [watchProgress, setWatchProgress] = useState<WatchProgress>(loadWatchProgress)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHome(watchProgress)
      .then(setHome)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load titles right now.'))
      .finally(() => setLoading(false))
  }, [watchProgress])

  useEffect(() => {
    localStorage.setItem('hbo-max-my-stuff', JSON.stringify(savedItems))
  }, [savedItems])

  useEffect(() => {
    saveWatchProgress(watchProgress)
  }, [watchProgress])

  useEffect(() => {
    if (!myStuffOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMyStuffOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [myStuffOpen])

  async function handleSearch(query: string) {
    setSearchQuery(query)
    setSearchError('')
    try {
      setSearchResults(await searchTitles(query))
    } catch (reason) {
      setSearchResults([])
      setSearchError(reason instanceof Error ? reason.message : 'Search is unavailable.')
    }
  }

  function clearSearch() {
    setSearchResults(null)
    setSearchQuery('')
    setSearchError('')
  }

  function toggleSaved(item: MediaItem) {
    setSavedItems((current) => current.some((saved) => saved.id === item.id)
      ? current.filter((saved) => saved.id !== item.id)
      : [...current, item])
  }

  function startWatching(item: MediaItem) {
    const episode = nextEpisode(item, watchProgress)
    if (!episode) return
    setWatchProgress((current) => ({ ...current, [String(item.id)]: episode }))
  }

  function moveFeatured(direction: -1 | 1) {
    setHeroDirection(direction > 0 ? 'forward' : 'backward')
    setFeaturedIndex((index) => index + direction)
  }

  function selectFeatured(index: number) {
    setHeroDirection(index >= featuredIndex ? 'forward' : 'backward')
    setFeaturedIndex(index)
  }

  const featuredItems = home?.hero_items ?? (home?.featured ? [home.featured] : [])
  const savedIds = new Set(savedItems.map((item) => item.id))
  const featured = featuredItems[featuredIndex] ?? home?.featured
  const heroImage = getBackdrop(featured?.backdrop_path, 'original')
  const heroLogo = getLogo(featured?.logo_path)
  const isFeaturedSaved = featured ? savedIds.has(featured.id) : false
  const featuredEpisode = featured ? nextEpisode(featured, watchProgress) : null
  const featuredWatchLabel = featured?.media_type === 'tv'
    ? featuredEpisode ? `Watch S${featuredEpisode.season} E${featuredEpisode.episode}` : 'Watch Again'
    : 'Watch Now'
  const heroGenres = featured?.genres?.slice(0, 1).map((genre) => genre.name === 'Documentary' ? 'Documentaries' : genre.name) ?? []
  const heroSynopsis = featured?.id === 337700
    ? "A serial killer's ex-wife and his final victim who escaped team up to investigate murders that may reveal the full extent of the killer's crimes."
    : featured?.overview || 'The ones you love, the ones you have not found yet, and everything worth sharing.'
  const rows = home?.rows ?? []

  // Build Continue Watching row from watch progress
  const continueWatchingItems: MediaItem[] = []
  if (watchProgress && Object.keys(watchProgress).length > 0) {
    // Get all items from home data (featured + rows) to find the ones with watch progress
    const allItems = [
      ...featuredItems,
      ...rows.flatMap(row => row.items)
    ]
    const itemMap = new Map(allItems.map(item => [String(item.id), item]))
    
    // Get episode stills and titles from backend response
    const episodeStills = (home as any)?.episode_stills ?? {}
    const episodeTitles = (home as any)?.episode_titles ?? {}
    
    for (const [itemId, progress] of Object.entries(watchProgress)) {
      const item = itemMap.get(itemId)
      if (item) {
        continueWatchingItems.push({
          ...item,
          // Add progress info for display
          watchProgress: progress,
          // Use episode still if available for Continue Watching
          episode_still_path: episodeStills[itemId],
          // Use episode title if available for Continue Watching
          episode_title: episodeTitles[itemId]
        } as MediaItem & { watchProgress: any; episode_still_path?: string; episode_title?: string })
      }
    }
  }

  // Add Continue Watching row after "Heroes You Love to Hate" (villains) if there are items
  const rowsWithContinueWatching = continueWatchingItems.length > 0
    ? (() => {
        const continueWatchingRow = { id: 'continue-watching', title: 'Continue Watching', items: continueWatchingItems }
        const villainsIndex = rows.findIndex(row => row.id === 'villains')
        if (villainsIndex >= 0) {
          // Insert after villains row
          return [...rows.slice(0, villainsIndex + 1), continueWatchingRow, ...rows.slice(villainsIndex + 1)]
        }
        // Fallback: prepend if villains row not found
        return [continueWatchingRow, ...rows]
      })()
    : rows

  useEffect(() => {
    if (!featured || featured.content_rating || featured.content_rating_descriptors?.length) return

    let cancelled = false
    void fetchKijkwijzer(featured)
      .then((result) => {
        if (!cancelled) {
          setHeroRating({
            id: featured.id,
            rating: result.content_rating,
            descriptors: result.content_rating_descriptors ?? [],
            source: result.content_rating_source,
            region: result.content_rating_region,
            originalRating: result.content_rating_original,
          })
        }
      })
      .catch(() => undefined)

    return () => { cancelled = true }
  }, [featured])

  const hasFetchedHeroRating = heroRating !== null && heroRating.id === featured?.id
  const heroContentRating = hasFetchedHeroRating ? heroRating.rating ?? featured?.content_rating : featured?.content_rating
  const heroContentRatingDescriptors = hasFetchedHeroRating
    ? heroRating.descriptors
    : featured?.content_rating_descriptors

  return (
    <div className="app-shell">
      <NavigationBar onSearch={handleSearch} onClearSearch={clearSearch} onMyStuff={() => setMyStuffOpen(true)} />
      <div className="viewport-bottom-fade" aria-hidden="true" />
      <section className={`hero${heroImage ? ' has-image' : ''}${heroControlsVisible ? ' controls-visible' : ''}`} id="home" onMouseEnter={() => setHeroControlsVisible(true)} onMouseLeave={() => setHeroControlsVisible(false)} onFocusCapture={() => setHeroControlsVisible(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeroControlsVisible(false) }}>
        {heroImage && <div key={featured?.id} className={`hero-backdrop is-${heroDirection}`} style={{ backgroundImage: `url(${heroImage})` }} aria-hidden="true" />}
        {heroImage && <div className="hero-image-protection" aria-hidden="true" />}
        <div className="hero-grain" />
        
        <div key={featured?.id} className={`hero-content is-${heroDirection}`}>
          <div className="hero-title-area">
            {heroLogo ? <img className="hero-title-logo" src={heroLogo} alt={featured ? getTitle(featured) : ''} loading="eager" fetchPriority="high" /> : <h1>{featured ? getTitle(featured) : 'Stories that stay with you.'}</h1>}
          </div>
          <p className={`hero-status${featured?.release_label ? '' : ' is-empty'}`} aria-hidden={!featured?.release_label}>{featured?.release_label ?? '\u00a0'}</p>
          <div className="hero-details">
            {featured && <>
              <KijkwijzerBadges rating={heroContentRating} descriptors={heroContentRatingDescriptors} source={hasFetchedHeroRating ? heroRating.source : featured.content_rating_source} region={hasFetchedHeroRating ? heroRating.region : featured.content_rating_region} originalRating={hasFetchedHeroRating ? heroRating.originalRating : featured.content_rating_original} />
              {featured.number_of_seasons && <span>{featured.number_of_seasons} {featured.number_of_seasons === 1 ? 'Season' : 'Seasons'}</span>}
              {featured.media_type === 'movie' && (featured.release_date ?? featured.first_air_date) && <span>{(featured.release_date ?? featured.first_air_date)?.slice(0, 4)}</span>}
              {heroGenres.map((genre) => <span key={genre}>{genre}</span>)}
            </>}
          </div>
          <div className="hero-description-slot"><p className="hero-description">{heroSynopsis}</p></div>
          <div className="hero-actions"><button className="button-primary" type="button" onClick={() => featured?.media_type === 'tv' && startWatching(featured)}><Play size={17} fill="currentColor" /> {featuredWatchLabel}</button><button className="button-add" type="button" aria-label={isFeaturedSaved ? 'Remove featured title from My Stuff' : 'Add featured title to My Stuff'} onClick={() => featured && toggleSaved(featured)}>{isFeaturedSaved ? <Check size={21} /> : <Plus size={22} />}</button></div>
        </div>
        {featuredItems.length > 1 && <>
          <button className="hero-previous" disabled={featuredIndex === 0} aria-label="Previous featured title" onClick={() => moveFeatured(-1)}><HeroArrowIcon direction="previous" /></button>
          <button className="hero-next" disabled={featuredIndex === featuredItems.length - 1} aria-label="Next featured title" onClick={() => moveFeatured(1)}><HeroArrowIcon direction="next" /></button>
        </>}
        {featuredItems.length > 1 && <div className="hero-pagination" aria-label="Featured titles">{featuredItems.slice(0, 6).map((item, index) => <button key={item.id} className={index === featuredIndex ? 'is-active' : ''} aria-label={`Show ${getTitle(item)}`} aria-current={index === featuredIndex ? 'true' : undefined} onClick={() => selectFeatured(index)} />)}</div>}
      </section>

      <main className="content-wrap" id="main-content">
        <div id="discover" />
        {error && <div className="notice" role="status"><span className="notice-dot" /><div><strong>TMDB is not connected yet.</strong><span>{error}</span></div></div>}
        {searchResults !== null ? (
          <section className="content-section search-results">
            <div className="section-heading"><div><span className="section-kicker">SEARCH RESULTS</span><h2>For: {searchQuery}</h2></div><button className="text-button" onClick={clearSearch}>Back to home <X size={15} /></button></div>
            {searchError && <p className="state-message">{searchError}</p>}
            {searchResults.length ? <div className="search-grid">{searchResults.map((item) => <MediaCard key={`${item.media_type ?? 'title'}-${item.id}`} item={item} saved={savedIds.has(item.id)} onToggleSave={toggleSaved} />)}</div> : !searchError && <p className="state-message">No matching titles. Try another search.</p>}
          </section>
        ) : loading ? (
          <div className="loading-state"><span className="loading-orbit" /><span>Finding something good...</span></div>
        ) : rowsWithContinueWatching.length ? (
          rowsWithContinueWatching.map((row) => <div id={row.id} key={row.id}><ContentRail row={row} savedIds={savedIds} onToggleSave={toggleSaved} /></div>)
        ) : (
          <section className="empty-shelves"><span className="section-kicker">THE GOOD STUFF IS CLOSE</span><h2>Your watchlist starts here.</h2><p>Add your TMDB read access token to <code>backend/.env</code> to bring titles, artwork, and search to life.</p></section>
        )}
        <footer className="site-footer"><BrandLogo footer /><span>Discover something worth pressing play for.</span><a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">Data and imagery via TMDB</a></footer>
      </main>
      {myStuffOpen && <div className="my-stuff-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setMyStuffOpen(false) }}>
        <section className="my-stuff-drawer" id="my-stuff" role="dialog" aria-modal="true" aria-labelledby="my-stuff-heading">
          <div className="my-stuff-drawer-heading"><h2 id="my-stuff-heading">My Stuff</h2><button type="button" aria-label="Close My Stuff" onClick={() => setMyStuffOpen(false)}><X size={22} /></button></div>
          {savedItems.length ? <ContentRail row={{ id: 'saved-titles', title: 'Your saved titles', items: savedItems }} savedIds={savedIds} onToggleSave={toggleSaved} /> : <p className="state-message">Titles you save will show up here.</p>}
        </section>
      </div>}
    </div>
  )
}