import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Play, ChevronDown, ArrowLeft } from 'lucide-react'
import { KijkwijzerBadges } from '../../components/catalog/KijkwijzerBadge'
import { fetchKijkwijzer } from '../../services/tmdb'
import { getBackdrop, getLogo, getPoster, getTitle } from '../../components/catalog/media-utils'
import { NavigationBar } from '../../components/navigation/NavigationBar'
import { EpisodeRailArrowIcon } from '../../components/catalog/ContentRail'
import type { MediaItem } from '../../types/media'
import './DetailPage.css'

interface DetailData extends MediaItem {
  seasons?: Array<{
    season_number: number
    episode_count: number
    air_date?: string
    episodes?: Array<{
      episode_number: number
      name: string
      overview: string
      still_path?: string
      air_date?: string
      runtime?: number
      vote_average?: number
    }>
  }>
  trailer_key?: string
  external_ids?: {
    imdb_id?: string
    facebook_id?: string
    instagram_id?: string
    twitter_id?: string
  }
  cast?: Array<{
    id: number
    name: string
    character: string
    profile_path?: string
  }>
  crew?: Array<{
    id: number
    name: string
    job: string
  }>
  recommendations?: MediaItem[]
}

interface Episode {
  episode_number: number
  name: string
  overview: string
  still_path?: string
  air_date?: string
  runtime?: number
  vote_average?: number
  season_number: number
}

function SeasonDropdown({ 
  seasons, 
  activeSeason, 
  onChange 
}: { 
  seasons: Array<{ season_number: number; episode_count: number }>
  activeSeason: number
  onChange: (season: number) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const validSeasons = seasons.filter(s => s.season_number > 0)

  return (
    <div className="season-dropdown" ref={dropdownRef}>
      <button
        ref={buttonRef}
        className="season-dropdown-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Select season, currently Season ${activeSeason}`}
      >
        <span className="season-dropdown-label">Season {activeSeason}</span>
        <ChevronDown size={20} className={isOpen ? 'rotated' : ''} />
      </button>
      {isOpen && (
        <ul className="season-dropdown-menu" role="listbox" aria-label="Seasons">
          {validSeasons.map((season) => (
            <li
              key={season.season_number}
              role="option"
              aria-selected={season.season_number === activeSeason}
              className={`season-dropdown-item ${season.season_number === activeSeason ? 'is-selected' : ''}`}
              onClick={() => {
                onChange(season.season_number)
                setIsOpen(false)
              }}
            >
              <span>Season {season.season_number}</span>
              <span className="season-dropdown-item-count">{season.episode_count} episodes</span>
              {season.season_number === activeSeason && (
                <svg className="season-dropdown-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EpisodeTile({ episode, seasonNumber, onPlay, progress = 0 }: { 
  episode: Episode
  seasonNumber: number
  onPlay: () => void
  progress?: number
}) {
  const stillUrl = episode.still_path ? getPoster(episode.still_path, 'w300') : undefined
  const formattedRuntime = episode.runtime ? `${episode.runtime}m` : ''
  const formattedAirDate = episode.air_date ? new Date(episode.air_date).getFullYear().toString() : ''
  const episodeNumber = `${episode.episode_number}.`
  const hasProgress = progress > 0

  return (
    <article className="episode-tile" data-element-index={episode.episode_number} data-first-visible={episode.episode_number <= 6}>
      <a 
        className="episode-tile-link" 
        href={`/watch/${seasonNumber}-${episode.episode_number}`}
        onClick={(e) => { e.preventDefault(); onPlay(); }}
        aria-label={`Watch Again: Season ${seasonNumber}, Episode ${episode.episode_number}: ${episode.name}. ${episodeNumber} of 10. Rated 16, Violence, Language, Runtime ${formattedRuntime}, Released in ${formattedAirDate}. Audio Description available, 4K UHD video, With Dolby Vision, With Dolby Atmos`}
      >
        <div className="episode-tile-image-container" aria-hidden="true">
          <div className="episode-tile-outline" />
          {stillUrl ? (
            <img 
              src={stillUrl} 
              alt="" 
              loading="lazy" 
              className="episode-tile-image"
              sizes="(min-width: 1800px) 15vw, (min-width: 1400px) 22.5vw, (min-width: 1100px) 22.5vw, (min-width: 800px) 30vw, (min-width: 600px) 30vw, (min-width: 440px) 45vw, 90vw"
            />
          ) : (
            <div className="episode-tile-placeholder">
              <span className="episode-tile-number">{episode.episode_number}</span>
            </div>
          )}
          <div className="episode-tile-overlays">
            <div className="episode-tile-action-menu-protection" />
            <div className="episode-tile-bottom-protection" />
            {hasProgress && (
              <div className="episode-tile-progress-bar" data-testid="progress-bar">
                <div className="episode-tile-progress" style={{ width: `${progress}%` }} />
              </div>
            )}
            {/* Play icon overlay - HBO Max style */}
            <svg xmlns="http://www.w3.org/2000/svg" fill="#fff" focusable="false" stroke="none" viewBox="0 0 48 48" role="img" aria-hidden="true" className="episode-tile-play-icon">
              <path d="M13.333 4.23A.857.857 0 0 0 12 4.945v37.94a.857.857 0 0 0 1.333.713l28.454-18.97a.857.857 0 0 0 0-1.427L13.333 4.23Z"></path>
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" fill="#fff" focusable="false" stroke="none" viewBox="0 0 48 48" role="img" aria-hidden="true" className="episode-tile-play-solid-icon">
              <path fillRule="evenodd" clipRule="evenodd" d="M10.286 1.829a.857.857 0 0 1 1.332-.714l33.26 22.173a.857.857 0 0 1 0 1.426l-33.26 22.174a.857.857 0 0 1-1.332-.713V1.829Z"></path>
            </svg>
          </div>
        </div>
        <div className="episode-tile-content">
          <p className="episode-tile-title-wrapper">
            <span className="episode-tile-primary-title" dir="auto">{episodeNumber} {episode.name}</span>
          </p>
          <p className="episode-tile-metadata">
            <span className="episode-tile-rating-images">
              <img alt="16" loading="lazy" data-testid="rating-image" sizes="(min-width: 1100px) 21px, 15px" src="https://images.cdn.prd.api.discomax.com/tU0xu/-1uSWmbBEXQKcQ8Lw.png" srcSet="https://images.cdn.prd.api.discomax.com/tU0xu/-1uSWmbBEXQKcQ8Lw.png?h=13&f=webp 13w,https://images.cdn.prd.api.discomax.com/tU0xu/-1uSWmbBEXQKcQ8Lw.png?h=20&f=webp 20w,https://images.cdn.prd.api.discomax.com/tU0xu/-1uSWmbBEXQKcQ8Lw.png?h=26&f=webp 26w,https://images.cdn.prd.api.discomax.com/tU0xu/-1uSWmbBEXQKcQ8Lw.png?h=39&f=webp 39w,https://images.cdn.prd.api.discomax.com/tU0xu/-1uSWmbBEXQKcQ8Lw.png?h=40&f=webp 40w,https://images.cdn.prd.api.discomax.com/tU0xu/-1uSWmbBEXQKcQ8Lw.png?h=60&f=webp 60w" className="episode-tile-rating-image" />
              <img alt="Violence" loading="lazy" data-testid="descriptor-image" sizes="(min-width: 1100px) 21px, 15px" src="https://images.cdn.prd.api.discomax.com/7aOnd/RWIQm-pc6VLih3xGA.png" srcSet="https://images.cdn.prd.api.discomax.com/7aOnd/RWIQm-pc6VLih3xGA.png?h=13&f=webp 13w,https://images.cdn.prd.api.discomax.com/7aOnd/RWIQm-pc6VLih3xGA.png?h=20&f=webp 20w,https://images.cdn.prd.api.discomax.com/7aOnd/RWIQm-pc6VLih3xGA.png?h=26&f=webp 26w,https://images.cdn.prd.api.discomax.com/7aOnd/RWIQm-pc6VLih3xGA.png?h=39&f=webp 39w,https://images.cdn.prd.api.discomax.com/7aOnd/RWIQm-pc6VLih3xGA.png?h=40&f=webp 40w,https://images.cdn.prd.api.discomax.com/7aOnd/RWIQm-pc6VLih3xGA.png?h=60&f=webp 60w" className="episode-tile-rating-image" />
              <img alt="Language" loading="lazy" data-testid="descriptor-image" sizes="(min-width: 1100px) 21px, 15px" src="https://images.cdn.prd.api.discomax.com/kRj1l/MtrTmuMv-0mXietEg.png" srcSet="https://images.cdn.prd.api.discomax.com/kRj1l/MtrTmuMv-0mXietEg.png?h=13&f=webp 13w,https://images.cdn.prd.api.discomax.com/kRj1l/MtrTmuMv-0mXietEg.png?h=20&f=webp 20w,https://images.cdn.prd.api.discomax.com/kRj1l/MtrTmuMv-0mXietEg.png?h=26&f=webp 26w,https://images.cdn.prd.api.discomax.com/kRj1l/MtrTmuMv-0mXietEg.png?h=39&f=webp 39w,https://images.cdn.prd.api.discomax.com/kRj1l/MtrTmuMv-0mXietEg.png?h=40&f=webp 40w,https://images.cdn.prd.api.discomax.com/kRj1l/MtrTmuMv-0mXietEg.png?h=60&f=webp 60w" className="episode-tile-rating-image" />
            </span>
            <span data-testid="metadata_duration" dir="auto">{formattedRuntime}</span>
            <span data-testid="metadata_release_year" dir="auto">{formattedAirDate}</span>
          </p>
          <p className="episode-tile-description" dir="auto">{episode.overview}</p>
        </div>
      </a>
      <div className="episode-tile-dropdown-wrapper" data-full-width="false">
        <div className="episode-tile-dropdown-toggle-wrapper" data-dropdown="tileAction-rail">
          <button 
            className="episode-tile-dropdown-toggle" 
            aria-expanded="false" 
            aria-haspopup="true" 
            aria-label={`Menu for Episode ${episode.episode_number}: ${episode.name}`}
            data-testid="dropdownToggleButton"
            data-tile-action-menu="true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="#fff" focusable="false" stroke="none" viewBox="0 0 48 48" role="img" aria-hidden="true" className="episode-tile-dropdown-icon">
              <path d="M26.75 10.5a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0ZM26.75 24a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0ZM26.75 37.5a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0Z" />
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" fill="#fff" focusable="false" stroke="none" viewBox="0 0 48 48" role="img" aria-hidden="true" className="episode-tile-dropdown-icon-solid">
              <path d="M27.5 9a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM27.5 24a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM27.5 39a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  )
}

function RecommendationCard({ item }: { item: MediaItem }) {
  const posterUrl = getPoster(item.poster_path, 'w300')
  const title = getTitle(item)
  const year = item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || ''
  const mediaType = item.media_type === 'tv' ? 'Series' : 'Movie'
  const routePath = item.media_type === 'tv' ? `/show/${item.uuid}` : `/movie/${item.uuid}`

  return (
    <article className="recommendation-card">
      <a href={routePath} className="recommendation-link">
        <div className="recommendation-poster">
          {posterUrl ? (
            <img src={posterUrl} alt={title} loading="lazy" />
          ) : (
            <div className="recommendation-placeholder">{title}</div>
          )}
        </div>
        <div className="recommendation-info">
          <h3 className="recommendation-title">{title}</h3>
          <p className="recommendation-meta">{year} · {mediaType}</p>
        </div>
      </a>
    </article>
  )
}

export default function DetailPage() {
  const { uuid } = useParams<{ uuid: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSeason, setActiveSeason] = useState<number>(1)
  const [contentRating, setContentRating] = useState<string | undefined>()
  const [contentRatingDescriptors, setContentRatingDescriptors] = useState<string[]>([])
  const [contentRatingSource, setContentRatingSource] = useState<'kijkwijzer' | 'tmdb' | undefined>()
  const [contentRatingRegion, setContentRatingRegion] = useState<string | undefined>()
  const [contentRatingOriginal, setContentRatingOriginal] = useState<string | undefined>()
  const [showMoreDescription, setShowMoreDescription] = useState(false)
  const [isMyList, setIsMyList] = useState(false)
  const [showRateDropdown, setShowRateDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState<'episodes' | 'recommendations' | 'related' | 'extras'>('episodes')

  // Episodes rail scroll state
  const episodesRailRef = useRef<HTMLDivElement>(null)
  const [canScrollEpisodesLeft, setCanScrollEpisodesLeft] = useState(false)
  const [canScrollEpisodesRight, setCanScrollEpisodesRight] = useState(false)
  const [episodesRailHovered, setEpisodesRailHovered] = useState(false)

  // Determine media type from the route path
  const mediaType = location.pathname.startsWith('/show/') ? 'tv' : 'movie'

  useEffect(() => {
    if (!uuid) return

    setLoading(true)
    setError(null)

    // Use relative URL to go through Vite proxy
    fetch(`/api/detail/uuid/${uuid}`)
      .then(async (response) => {
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Failed to load details')
        }
        return response.json()
      })
      .then((data: DetailData) => {
        setDetail(data)
        // Set first season with episodes as active
        if (data.seasons && data.seasons.length > 0) {
          const firstSeasonWithEpisodes = data.seasons.find(s => s.episodes && s.episodes.length > 0)
          if (firstSeasonWithEpisodes) {
            setActiveSeason(firstSeasonWithEpisodes.season_number)
          } else {
            setActiveSeason(data.seasons[0].season_number)
          }
        }
        // Fetch Kijkwijzer rating
        return fetchKijkwijzer(data)
      })
      .then((rating) => {
        if (rating) {
          setContentRating(rating.content_rating)
          setContentRatingDescriptors(rating.content_rating_descriptors ?? [])
          setContentRatingSource(rating.content_rating_source)
          setContentRatingRegion(rating.content_rating_region)
          setContentRatingOriginal(rating.content_rating_original)
        }
      })
      .catch((err: Error) => {
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [mediaType, uuid])

  // Episodes rail scroll handling
  const showEpisodesRailArrows = episodesRailHovered || canScrollEpisodesLeft || canScrollEpisodesRight

  function scrollEpisodesRail(direction: number) {
    const rail = episodesRailRef.current
    if (!rail) return
    
    // Scroll by one item width plus gap
    const itemWidth = 339 // episode tile width
    const gap = 16
    const distance = itemWidth + gap
    rail.scrollBy({ left: direction * distance, behavior: 'smooth' })
  }

  // Derive variables early (before useEffect for hook consistency)
  const title = detail ? getTitle(detail) : ''
  const backdropUrl = detail ? getBackdrop(detail.backdrop_path, 'original') : ''
  const logoUrl = detail ? getLogo(detail.logo_path) : ''
  const genres = detail?.genres?.slice(0, 3).map(g => g.name) ?? []
  const year = detail?.release_date?.slice(0, 4) || detail?.first_air_date?.slice(0, 4) || ''
  const seasonsCount = detail?.number_of_seasons || detail?.seasons?.length || 0
  const isSeries = detail?.media_type === 'tv'
  const activeSeasonData = detail?.seasons?.find(s => s.season_number === activeSeason)
  const episodes = activeSeasonData?.episodes || []
  const recommendations = detail?.recommendations?.slice(0, 12) || []

  // Episodes rail scroll effect - must be before early returns for hook consistency
  useEffect(() => {
    const rail = episodesRailRef.current
    if (!rail) return

    const updateScrollState = () => {
      const maxScrollLeft = rail.scrollWidth - rail.clientWidth
      setCanScrollEpisodesLeft(rail.scrollLeft > 1)
      setCanScrollEpisodesRight(maxScrollLeft > 1 && rail.scrollLeft < maxScrollLeft - 1)
    }
    
    const frame = requestAnimationFrame(updateScrollState)
    rail.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)

    return () => {
      cancelAnimationFrame(frame)
      rail.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [episodes.length, activeSeason])

  if (loading) {
    return (
      <div className="detail-loading">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="detail-error">
        <NavigationBar onSearch={() => {}} onClearSearch={() => {}} onMyStuff={() => {}} />
        <div className="error-content">
          <ArrowLeft className="back-btn" onClick={() => navigate(-1)} />
          <h1>Unable to load</h1>
          <p>{error || 'Content not found'}</p>
          <button className="button-primary" onClick={() => navigate(-1)}>Go Back</button>
        </div>
      </div>
    )
  }

  // Hero background image: for TV shows use first episode's still (banner thumbnail), for movies use backdrop
  const heroBackgroundUrl = isSeries && episodes.length > 0 && episodes[0].still_path
    ? getPoster(episodes[0].still_path, 'w1280')
    : backdropUrl

  const handlePlay = () => {
    console.log('Play:', title)
  }

  const handleAddToMyList = () => {
    setIsMyList(prev => !prev)
    console.log('Add to My List:', title)
  }

  const handleRate = () => {
    setShowRateDropdown(!showRateDropdown)
  }

  // Determine watch button text for TV shows
  const watchButtonText = isSeries && activeSeasonData && episodes.length > 0
    ? `Watch S${activeSeason} E${episodes[0].episode_number}`
    : isSeries ? 'Play' : 'Watch Now'

  // Episode title for TV shows (e.g., "S1 E10: Episode Name")
  const episodeTitle = isSeries && activeSeasonData && episodes.length > 0
    ? `S${activeSeason}E${episodes[0].episode_number.toString().padStart(2, '0')}: ${episodes[0].name}`
    : ''

  // Subhead text for TV shows (like "Season 1 Now Available")
  const subheadText = isSeries && seasonsCount > 0
    ? `Season ${activeSeason} Now Available`
    : detail.release_label || ''

  return (
    <div className="detail-page">
      <NavigationBar onSearch={() => {}} onClearSearch={() => {}} onMyStuff={() => {}} />
      
      {/* Hero Section - HBO Max Exact Match */}
      <section className={`detail-hero${heroBackgroundUrl ? ' has-image' : ''}`}>
        {heroBackgroundUrl && (
          <div className="detail-hero-background" style={{ backgroundImage: `url(${heroBackgroundUrl})` }} aria-hidden="true" />
        )}
        <div className="detail-hero-image-top-protection" aria-hidden="true" />
        <div className="detail-hero-image-protection" aria-hidden="true" />
        <div className="detail-hero-grain" />
        
        {/* Top Right: 3 dots menu button */}
        <button className="detail-hero-menu-btn" aria-label="More options" type="button">
          <div className="detail-hero-menu-dots">
            <span className="detail-hero-dot" />
            <span className="detail-hero-dot" />
            <span className="detail-hero-dot" />
          </div>
        </button>
        
        <div className="detail-hero-content">
          <div className="detail-title-area">
            {logoUrl ? <img className="detail-title-logo" src={logoUrl} alt={title} loading="eager" fetchPriority="high" /> : <h1>{title}</h1>}
          </div>
          
          {/* Subhead - "Season X Now Available" or "Just Added" etc */}
          {subheadText && (
            <p className="detail-subhead">{subheadText}</p>
          )}
          
          {/* Metadata row - Rating, Duration, Year, Quality badges */}
          <div className="detail-meta-row">
            <KijkwijzerBadges rating={contentRating ?? detail.content_rating} descriptors={contentRatingDescriptors.length ? contentRatingDescriptors : detail.content_rating_descriptors} source={contentRatingSource ?? detail.content_rating_source} region={contentRatingRegion ?? detail.content_rating_region} originalRating={contentRatingOriginal ?? detail.content_rating_original} />
            {isSeries && episodes.length > 0 && episodes[0].runtime && <span className="detail-meta-item detail-meta-gray">{episodes[0].runtime}m</span>}
            {!isSeries && (detail as any).runtime && <span className="detail-meta-item detail-meta-gray">{(detail as any).runtime}m</span>}
            {year && <span className="detail-meta-item detail-meta-gray">{year}</span>}
            <p aria-hidden="true" className="detail-quality-badges">
              <img src="https://images.cdn.prd.api.discomax.com/2023%2F3%2F2%2Fc640b693-3eb2-4d77-8275-022185d21ebc.png?h=24&f=webp" alt="" width="100" height="100" />
              <span>4K UHD</span>
              <img src="https://images.cdn.prd.api.discomax.com/2023%2F3%2F2%2F38120a16-ebcb-4dbe-938f-b0fa65970316.png?h=24&f=webp" alt="" width="100" height="100" />
              <img src="https://images.cdn.prd.api.discomax.com/2023%2F3%2F2%2F9525ced4-f0b2-4e85-a4e4-1986bc829625.png?h=24&f=webp" alt="" width="100" height="100" />
            </p>
          </div>
          
          {/* First Button Row - Primary LOUD Button */}
          <div className="detail-button-row detail-button-row-primary">
            <button className="button-primary detail-play-btn" type="button" onClick={handlePlay}>
              <Play size={17} fill="currentColor" /> {watchButtonText}
            </button>
          </div>
          
          {/* Second Button Row - Ghost Stacked Buttons */}
          <div className="detail-button-row detail-button-row-secondary">
            {/* My List Button - Ghost Stacked */}
            <button className="button-ghost-stacked detail-mylist-btn" type="button" onClick={handleAddToMyList} aria-label={isMyList ? `Remove from My List: ${title}` : `Add to My List: ${title}`}>
              <div className="button-icon">
                <svg viewBox="0 0 25 25" width="25" height="25" fill="currentColor">
                  <path d="M0,-9 C0.552,-9 1,-8.552 1,-8 C1,-8 1,-1 1,-1 C1,-1 8,-1 8,-1 C8.552,-1 9,-0.552 9,0 C9,0.552 8.552,1 8,1 C8,1 1,1 1,1 C1,1 1,8 1,8 C1,8.552 0.552,9 0,9 C-0.552,9 -1,8.552 -1,8 C-1,8 -1,1 -1,1 C-1,1 -8,1 -8,1 C-8.552,1 -9,0.552 -9,0 C-9,-0.552 -8.552,-1 -8,-1 C-8,-1 -1,-1 -1,-1 C-1,-1 -1,-8 -1,-8 C-1,-8.552 -0.552,-9 0,-9z" />
                </svg>
              </div>
              <span className="button-text">My List</span>
            </button>
            
            {/* Rate Button - Ghost Stacked */}
            <button className="button-ghost-stacked detail-rate-btn" type="button" onClick={handleRate} aria-label={`Rate ${title}`}>
              <div className="button-icon">
                <img src="https://images.cdn.prd.api.discomax.com/2a6d/8319734344c4.png" alt="" width="20" height="20" />
              </div>
              <span className="button-text">Rate</span>
            </button>
            
            {/* Trailer Button - Ghost Stacked */}
            <button className="button-ghost-stacked detail-trailer-btn" type="button" onClick={() => console.log('Trailer:', title)} aria-label={`Watch trailer for ${title}`}>
              <div className="button-icon">
                <Play size={20} fill="currentColor" />
              </div>
              <span className="button-text">Trailer</span>
            </button>
          </div>
          
          {/* Episode Title for TV Shows */}
          {episodeTitle && (
            <h2 className="detail-episode-title">{episodeTitle}</h2>
          )}
          
          {/* Description */}
          <div className="detail-description-slot">
            <p className={`detail-description${showMoreDescription ? ' expanded' : ''}`}>{detail.overview || 'No description available.'}</p>
          </div>
          {(detail.overview && detail.overview.length > 200) && (
            <button 
              className="detail-toggle-description" 
              onClick={() => setShowMoreDescription(!showMoreDescription)}
            >
              {showMoreDescription ? 'Show Less' : 'Show More'}
              <ChevronDown size={16} />
            </button>
          )}
          
          {/* Genres - moved below description */}
          {genres.length > 0 && (
            <div className="detail-genres">
              {genres.map((genre) => <span key={genre} className="detail-genre-tag">{genre}</span>)}
            </div>
          )}
          
          {/* Quality disclaimer */}
          <p className="detail-quality-disclaimer">4K UHD, HDR, and Dolby Atmos availability depends on plan and device.</p>
        </div>
      </section>

      {/* Episodes Section for TV Shows - HBO Max Style with Tabs */}
      {isSeries && detail.seasons && detail.seasons.length > 0 && (
        <section className="detail-episodes" aria-labelledby="episodes-heading">
          {/* Tab Navigation - Episodes, You May Also Like, Related, Extras */}
          {/* HBO Max structure: section with data-testid, pagination container, tab group container, inner container */}
          <section 
            data-testid="generic-show-page-rail-tab-group_tabGroup" 
            data-full-relative-width="false"
            className="detail-tab-section"
            role="region"
            aria-label="Content sections"
          >
            <div className="detail-tab-pagination-container">
              <div 
                data-capability="firstVisibleFocusManagement" 
                data-variant="Tab" 
                role="tablist" 
                className="detail-tab-group-container"
                aria-label="Content sections"
              >
                <div className="detail-tabs-inner-container">
                  <button 
                    role="tab" 
                    aria-selected={activeTab === 'episodes'}
                    aria-controls="episodes-panel"
                    id="episodes-tab"
                    data-testid="generic-show-page-rail-episodes-tab_Tab"
                    data-first-visible="true"
                    data-selected={activeTab === 'episodes'}
                    dir="auto"
                    className={`detail-tab ${activeTab === 'episodes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('episodes')}
                  >
                    Episodes
                  </button>
                  {recommendations.length > 0 && (
                    <button 
                      role="tab" 
                      aria-selected={activeTab === 'recommendations'}
                      aria-controls="recommendations-panel"
                      id="recommendations-tab"
                      data-testid="generic-show-page-rail-you-may-also-like-tab_Tab"
                      data-first-visible="true"
                      data-selected={activeTab === 'recommendations'}
                      dir="auto"
                      className={`detail-tab ${activeTab === 'recommendations' ? 'active' : ''}`}
                      onClick={() => setActiveTab('recommendations')}
                    >
                      You May Also Like
                    </button>
                  )}
                  <button 
                    role="tab" 
                    aria-selected={activeTab === 'related'}
                    aria-controls="related-panel"
                    id="related-tab"
                    data-testid="generic-blueprint-page-rail-versions-tab_Tab"
                    data-first-visible="true"
                    data-selected={activeTab === 'related'}
                    dir="auto"
                    className={`detail-tab ${activeTab === 'related' ? 'active' : ''}`}
                    onClick={() => setActiveTab('related')}
                  >
                    Related
                  </button>
                  <button 
                    role="tab" 
                    aria-selected={activeTab === 'extras'}
                    aria-controls="extras-panel"
                    id="extras-tab"
                    data-testid="generic-show-page-rail-extras-tab_Tab"
                    data-first-visible="true"
                    data-selected={activeTab === 'extras'}
                    dir="auto"
                    className={`detail-tab ${activeTab === 'extras' ? 'active' : ''}`}
                    onClick={() => setActiveTab('extras')}
                  >
                    Extras
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Episodes Tab Panel */}
          {activeTab === 'episodes' && (
            <div 
              role="tabpanel" 
              id="episodes-panel" 
              aria-labelledby="episodes-tab"
              className="detail-tab-panel"
            >
              {/* Season Title - Show as plain text when only 1 season, dropdown when multiple */}
              <div className="detail-season-title">
                {detail.seasons.length > 1 ? (
                  <SeasonDropdown
                    seasons={detail.seasons}
                    activeSeason={activeSeason}
                    onChange={setActiveSeason}
                  />
                ) : (
                  <h2 className="detail-season-title-text">Season {activeSeason}</h2>
                )}
              </div>

              <div className="detail-episodes-rail-wrapper">
                <div 
                  ref={episodesRailRef}
                  className="detail-episodes-rail" 
                  role="tabpanel" 
                  aria-label={`Season ${activeSeason}`}
                  onMouseEnter={() => setEpisodesRailHovered(true)}
                  onMouseLeave={() => setEpisodesRailHovered(false)}
                >
                  {episodes.length > 0 ? (
                    <>
                      <div className="detail-episodes-track">
                        {episodes.map((episode) => (
                          <EpisodeTile
                            key={`${activeSeason}-${episode.episode_number}`}
                            episode={{ ...episode, season_number: activeSeason }}
                            seasonNumber={activeSeason}
                            onPlay={handlePlay}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="detail-no-episodes">
                      <p>No episodes available for this season.</p>
                    </div>
                  )}
                  {episodes.length > 0 && (
                    <>
                      {showEpisodesRailArrows && (
                        <>
                          <button 
                            className="detail-episodes-rail-arrow is-previous" 
                            disabled={!canScrollEpisodesLeft} 
                            aria-label={`Previous episodes in Season ${activeSeason}`}
                            data-position="back"
                            onClick={() => scrollEpisodesRail(-1)}
                          >
                            <EpisodeRailArrowIcon direction="previous" />
                          </button>
                          <button 
                            className="detail-episodes-rail-arrow is-next" 
                            disabled={!canScrollEpisodesRight} 
                            aria-label={`More episodes in Season ${activeSeason}`}
                            data-position="forward"
                            onClick={() => scrollEpisodesRail(1)}
                          >
                            <EpisodeRailArrowIcon direction="next" />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* You May Also Like Tab Panel */}
          {activeTab === 'recommendations' && recommendations.length > 0 && (
            <div 
              role="tabpanel" 
              id="recommendations-panel" 
              aria-labelledby="recommendations-tab"
              className="detail-tab-panel"
            >
              <div className="detail-recommendations-rail">
                <div className="detail-recommendations-track">
                  {recommendations.map((item) => (
                    <RecommendationCard key={`${item.media_type}-${item.id}`} item={item} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Related Tab Panel */}
          {activeTab === 'related' && (
            <div 
              role="tabpanel" 
              id="related-panel" 
              aria-labelledby="related-tab"
              className="detail-tab-panel"
            >
              <div className="detail-related">
                <p>Related content coming soon...</p>
              </div>
            </div>
          )}

          {/* Extras Tab Panel */}
          {activeTab === 'extras' && (
            <div 
              role="tabpanel" 
              id="extras-panel" 
              aria-labelledby="extras-tab"
              className="detail-tab-panel"
            >
              <div className="detail-extras">
                <p>Extras coming soon...</p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Cast & Crew Section */}
      {(detail.cast && detail.cast.length > 0) || (detail.crew && detail.crew.length > 0) ? (
        <section className="detail-credits" aria-labelledby="credits-heading">
          <div className="detail-section-header">
            <h2 id="credits-heading" className="detail-section-title">Cast & Crew</h2>
          </div>
          <div className="detail-credits-grid">
            {detail.cast && detail.cast.length > 0 && (
              <div className="detail-credits-section">
                <h3 className="detail-credits-subtitle">Cast</h3>
                <div className="detail-cast-list">
                  {detail.cast.slice(0, 20).map((actor) => (
                    <div key={actor.id} className="detail-cast-item">
                      {actor.profile_path ? (
                        <img 
                          src={getPoster(actor.profile_path, 'w185')} 
                          alt={actor.name} 
                          className="detail-cast-avatar"
                          loading="lazy"
                        />
                      ) : (
                        <div className="detail-cast-avatar placeholder" />
                      )}
                      <div className="detail-cast-info">
                        <span className="detail-cast-actor">{actor.name}</span>
                        <span className="detail-cast-character">{actor.character}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detail.crew && detail.crew.length > 0 && (
              <div className="detail-credits-section">
                <h3 className="detail-credits-subtitle">{isSeries ? 'Creators' : 'Directors'}</h3>
                <div className="detail-crew-list">
                  {detail.crew.map((member) => (
                    <div key={member.id} className="detail-crew-item">
                      <span className="detail-crew-name">{member.name}</span>
                      <span className="detail-crew-role">{member.job}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}