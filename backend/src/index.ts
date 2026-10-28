import 'dotenv/config'
import express from 'express'
import { load } from 'cheerio'
import { verifiedKijkwijzerRecords } from './kijkwijzer-cache.js'

const app = express()
const port = Number(process.env.PORT ?? 3002)
const tmdbToken = process.env.TMDB_API_READ_ACCESS_TOKEN
const verifiedSeasonAirDates: Record<number, Record<number, string>> = {
  96677: { 3: '2023-10-05' },
}

type TmdbItem = {
  id: number
  title?: string
  name?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  logo_path?: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  media_type?: 'movie' | 'tv'
  content_rating?: string
  content_rating_descriptors?: string[]
  content_rating_source?: 'kijkwijzer' | 'tmdb'
  content_rating_region?: string
  content_rating_original?: string
  number_of_seasons?: number
  genres?: Array<{ id: number; name: string }>
  status?: string
  release_label?: string
  seasons?: Array<{ season_number: number; episode_count: number; air_date?: string }>
  next_episode_to_air?: { air_date?: string; season_number: number; episode_number: number } | null
}

type TmdbList = { results: TmdbItem[] }
type TmdbLogo = { file_path: string; iso_639_1: string | null; vote_average: number }
type TmdbDetails = TmdbItem & {
  images?: { logos: TmdbLogo[] }
  content_ratings?: { results: Array<{ iso_3166_1: string; rating: string; descriptors?: string[] }> }
  release_dates?: { results: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }> }
  last_episode_to_air?: { season_number: number; episode_number: number }
  seasons?: Array<{ season_number: number; episode_count: number; air_date?: string }>
  next_episode_to_air?: { air_date?: string; season_number: number; episode_number: number } | null
}

type KijkwijzerRating = {
  rating?: string
  descriptors: string[]
  source?: 'kijkwijzer' | 'tmdb'
  region?: string
  originalRating?: string
}

const kijkwijzerRatings = new Map<string, { expiresAt: number; result: KijkwijzerRating | null }>()
const pendingKijkwijzerLookups = new Map<string, Promise<KijkwijzerRating | null>>()
const descriptorLabels: Record<string, string> = {
  angst: 'Angst',
  discriminatie: 'Discriminatie',
  drugs: 'Drugs',
  geweld: 'Geweld',
  'grof-taalgebruik': 'Grof taalgebruik',
  seks: 'Seks',
}
const kijkwijzerTitleAliases: Record<number, Array<{ query: string; matches: string[] }>> = {
  1108427: [{ query: 'Vaiana', matches: ['Vaiana (Live Action)'] }],
}
let kijkwijzerRequestQueue = Promise.resolve()
let lastKijkwijzerRequestAt = 0

function withVerifiedKijkwijzer(item: TmdbItem, mediaType: 'movie' | 'tv'): TmdbItem {
  const record = verifiedKijkwijzerRecords[item.id]
  return {
    ...item,
    media_type: mediaType,
    content_rating: record?.rating,
    content_rating_descriptors: record?.descriptors ?? [],
    content_rating_source: record ? 'kijkwijzer' : undefined,
    content_rating_region: record ? 'NL' : undefined,
  }
}

function withRecentReleaseLabel(item: TmdbItem, mediaType: 'movie' | 'tv'): TmdbItem {
  if (mediaType !== 'movie' || !item.release_date) return item

  const releaseDate = new Date(`${item.release_date}T00:00:00Z`)
  const daysSinceRelease = (Date.now() - releaseDate.getTime()) / 86_400_000
  if (daysSinceRelease < 0 || daysSinceRelease > 45) return item

  return { ...item, release_label: 'Just Added' }
}

function normalizeTitle(title: string) {
  return title.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function parseKijkwijzerResult(html: string, title: string, year: number | undefined, mediaType: 'movie' | 'tv', acceptedTitles = [title]): KijkwijzerRating | null {
  const $ = load(html)
  const normalizedTitles = acceptedTitles.map(normalizeTitle)
  const results = $('.c-search__results .c-search__result').toArray()

  for (const element of results) {
    const result = $(element)
    const resultTitle = normalizeTitle(result.find('.c-search__title').text())
    const productionText = result.find('.c-search__text').text()
    const resultYear = Number(productionText.match(/\b(\d{4})\b/)?.[1]) || undefined
    const isAcceptedTitle = normalizedTitles.includes(resultTitle)
    const isSeasonTitle = mediaType === 'tv' && normalizedTitles.some((normalizedTitle) => new RegExp(`^${normalizedTitle} (?:season|part) \\d+$`).test(resultTitle))

    if (!isAcceptedTitle && !isSeasonTitle) continue
    if (year && (resultYear ? Math.abs(year - resultYear) > 1 : isSeasonTitle)) continue

    const marks = result.find('.c-search__marks .c-search__mark').toArray()
      .map((mark) => ($(mark).attr('class') ?? '').match(/c-search__mark--([\w-]+)/)?.[1])
      .filter((mark): mark is string => Boolean(mark))
    const rating = marks.map((mark) => mark.match(/^leeftijd-(6|9|12|14|16|18)$/)?.[1]).find(Boolean)
      ?? (marks.includes('alle-leeftijden') ? 'AL' : undefined)
    const descriptors = [...new Set(marks.map((mark) => descriptorLabels[mark]).filter((label): label is string => Boolean(label)))]

    return rating || descriptors.length ? { rating, descriptors } : null
  }

  return null
}

function rateLimitedKijkwijzerFetch(url: string) {
  const startRequest = kijkwijzerRequestQueue.then(async () => {
    const wait = Math.max(0, 250 - (Date.now() - lastKijkwijzerRequestAt))
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
    lastKijkwijzerRequestAt = Date.now()
  })
  kijkwijzerRequestQueue = startRequest.then(() => undefined, () => undefined)
  return startRequest.then(() => fetch(url, { headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(10_000) }))
}

async function lookupKijkwijzer(item: TmdbItem, mediaType: 'movie' | 'tv'): Promise<KijkwijzerRating | null> {
  const verified = verifiedKijkwijzerRecords[item.id]
  if (verified) return { rating: verified.rating, descriptors: verified.descriptors }

  const title = item.title ?? item.name
  if (!title) return null
  const year = Number((item.release_date ?? item.first_air_date)?.slice(0, 4)) || undefined
  const key = `${mediaType}:${normalizeTitle(title)}:${year ?? ''}`
  const cached = kijkwijzerRatings.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.result

  let pending = pendingKijkwijzerLookups.get(key)
  if (!pending) {
    const searchCandidates = [
      { query: title, matches: [title] },
      ...(kijkwijzerTitleAliases[item.id] ?? []),
    ]
    pending = (async () => {
      for (const candidate of searchCandidates) {
        const url = new URL('https://www.kijkwijzer.be/zoeken/')
        url.searchParams.set('query', candidate.query)
        url.searchParams.set('producties', mediaType === 'movie' ? '1' : '2')
        try {
          const response = await rateLimitedKijkwijzerFetch(url.toString())
          if (!response.ok) continue
          const html = await response.text()
          if (/access denied|challenge validation/i.test(html)) continue
          const result = parseKijkwijzerResult(html, title, year, mediaType, candidate.matches)
          if (result) return { ...result, source: 'kijkwijzer', region: 'NL' }
        } catch {
          continue
        }
      }
      return null
    })()
    pendingKijkwijzerLookups.set(key, pending)
  }

  try {
    const result = await pending
    kijkwijzerRatings.set(key, { result, expiresAt: Date.now() + (result ? 86_400_000 : 900_000) })
    return result
  } finally {
    pendingKijkwijzerLookups.delete(key)
  }
}

async function tmdb<T>(path: string): Promise<T> {
  if (!tmdbToken) {
    throw new Error('TMDB_API_READ_ACCESS_TOKEN is not configured. Add it to backend/.env.')
  }

  const response = await fetch(`https://api.themoviedb.org/3/${path}`, {
    headers: { Authorization: `Bearer ${tmdbToken}`, Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`TMDB request failed with status ${response.status}.`)
  }

  return response.json() as Promise<T>
}

function tmdbCertification(details: TmdbDetails, mediaType: 'movie' | 'tv'): KijkwijzerRating | null {
  const ageMappings: Record<string, Record<string, string>> = {
    NL: { AL: 'AL', '6': '6', '9': '9', '12': '12', '14': '14', '16': '16', '18': '18' },
    US: { 'TV-Y': 'AL', 'TV-Y7': '6', 'TV-G': 'AL', 'TV-PG': '6', 'TV-14': '14', 'TV-MA': '18', G: 'AL', PG: '6', 'PG-13': '12', R: '18', 'NC-17': '18' },
    GB: { U: 'AL', PG: '6', '12': '12', '12A': '12', '15': '16', '18': '18' },
    DE: { '0': 'AL', '6': '6', '12': '12', '16': '16', '18': '18' },
    AU: { G: 'AL', PG: '6', M: '12', 'MA15+': '16', 'R18+': '18' },
    CA: { G: 'AL', PG: '6', '14A': '14', '18A': '18', R: '18' },
    NZ: { G: 'AL', PG: '6', M: '12', 'R13': '14', 'R16': '16', 'R18': '18' },
    FR: { '10': '9', '12': '12', '16': '16', '18': '18' },
  }
  const regionPriority = ['NL', 'US', 'GB', 'DE', 'AU', 'CA', 'NZ', 'FR']
  const candidates = mediaType === 'tv'
    ? (details.content_ratings?.results ?? [])
      .filter((entry) => entry.rating.trim())
      .map((entry) => ({ region: entry.iso_3166_1, rating: entry.rating.trim() }))
    : (details.release_dates?.results ?? [])
      .flatMap((entry) => entry.release_dates
        .map((release) => ({ region: entry.iso_3166_1, rating: release.certification.trim() }))
        .filter((release) => release.rating))

  for (const region of regionPriority) {
    const selected = candidates
      .filter((candidate) => candidate.region === region)
      .find((candidate) => ageMappings[region]?.[candidate.rating.toUpperCase()])
    if (!selected) continue

    return {
      rating: ageMappings[region][selected.rating.toUpperCase()],
      descriptors: [],
      source: 'tmdb',
      region,
      originalRating: selected.rating,
    }
  }

  return null
}

async function lookupTmdbCertification(item: TmdbItem, mediaType: 'movie' | 'tv') {
  const append = mediaType === 'tv' ? 'content_ratings' : 'release_dates'
  const details = await tmdb<TmdbDetails>(`${mediaType}/${item.id}?append_to_response=${append}`)
  return tmdbCertification(details, mediaType)
}

async function lookupRating(item: TmdbItem, mediaType: 'movie' | 'tv') {
  if (verifiedKijkwijzerRecords[item.id]) return lookupKijkwijzer(item, mediaType)

  const kijkwijzerPromise = lookupKijkwijzer(item, mediaType).catch(() => null)
  const tmdbPromise = lookupTmdbCertification(item, mediaType).catch(() => null)
  const firstResult = await Promise.race([
    kijkwijzerPromise.then((rating) => ({ source: 'kijkwijzer' as const, rating })),
    tmdbPromise.then((rating) => ({ source: 'tmdb' as const, rating })),
  ])

  if (firstResult.rating) return firstResult.rating
  return firstResult.source === 'kijkwijzer' ? tmdbPromise : kijkwijzerPromise
}

async function tmdbFirstThirty(path: string): Promise<TmdbItem[]> {
  const pages = await Promise.all([1, 2].map((page) => tmdb<TmdbList>(`${path}&page=${page}`)))
  const uniqueItems = new Map(pages.flatMap((page) => page.results).map((item) => [item.id, item]))
  return [...uniqueItems.values()].slice(0, 30)
}

function pickRandomItems<T>(items: T[], count: number): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled.slice(0, count)
}

function handleApiError(error: unknown, response: express.Response) {
  const message = error instanceof Error ? error.message : 'The content service is unavailable.'
  const status = message.includes('is not configured') ? 503 : 502
  response.status(status).json({ error: message })
}

async function enrichFeatured(item: TmdbItem): Promise<TmdbItem> {
  const mediaType = item.media_type ?? (item.title ? 'movie' : 'tv')
  const append = mediaType === 'tv' ? 'images,seasons,content_ratings' : 'images,release_dates'

  try {
    const [details, kijkwijzer] = await Promise.all([
      tmdb<TmdbDetails>(`${mediaType}/${item.id}?append_to_response=${append}&include_image_language=en,nl,null`),
      lookupKijkwijzer(item, mediaType),
    ])
    const logo = details.images?.logos
      .filter((image) => image.iso_639_1 === 'en' || image.iso_639_1 === 'nl' || image.iso_639_1 === null)
      .sort((first, second) => second.vote_average - first.vote_average)[0]
    const rating = kijkwijzer ?? tmdbCertification(details, mediaType)
    const nextEpisode = details.next_episode_to_air
    const latestSeason = details.seasons
      ?.filter((season) => season.season_number > 0)
      .sort((first, second) => second.season_number - first.season_number)[0]
    let releaseLabel: string | undefined
    const latestSeasonAirDate = (latestSeason && verifiedSeasonAirDates[item.id]?.[latestSeason.season_number])
      ?? latestSeason?.air_date
      ?? (latestSeason?.season_number === 1 ? details.first_air_date : undefined)
    const seasonAirDate = latestSeasonAirDate ? new Date(`${latestSeasonAirDate}T12:00:00Z`) : null
    const daysSinceSeasonRelease = seasonAirDate ? (Date.now() - seasonAirDate.getTime()) / 86_400_000 : Infinity
    const isRecentSeasonRelease = daysSinceSeasonRelease >= 0 && daysSinceSeasonRelease <= 30

    if (mediaType === 'tv' && nextEpisode?.air_date) {
      const airDate = new Date(`${nextEpisode.air_date}T12:00:00Z`)
      const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(airDate)
      releaseLabel = `${day}s at 6 AM`
    } else if (mediaType === 'tv' && isRecentSeasonRelease && latestSeason) {
      releaseLabel = `Season ${latestSeason.season_number} Now Available`
    } else if (mediaType === 'tv' && details.status === 'Ended') {
      releaseLabel = 'Series Finale Now Streaming'
    } else if (mediaType === 'movie' && details.release_date) {
      const daysSinceRelease = (Date.now() - new Date(`${details.release_date}T00:00:00Z`).getTime()) / 86_400_000
      if (daysSinceRelease >= 0 && daysSinceRelease <= 45) releaseLabel = 'Just Added'
    }

    return {
      ...item,
      ...details,
      media_type: mediaType,
      logo_path: logo?.file_path ?? null,
      content_rating: rating?.rating,
      content_rating_descriptors: rating?.descriptors ?? [],
      content_rating_source: rating?.source,
      content_rating_region: rating?.region,
      content_rating_original: rating?.originalRating,
      release_label: releaseLabel,
    }
  } catch {
    return { ...item, media_type: mediaType, logo_path: null }
  }
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', tmdbConfigured: Boolean(tmdbToken) })
})

app.get('/api/kijkwijzer', async (request, response) => {
  const title = String(request.query.title ?? '').trim()
  if (!title) {
    response.status(400).json({ error: 'Enter a title to search.' })
    return
  }

  const mediaType = request.query.type === 'tv' ? 'tv' : 'movie'
  const item: TmdbItem = {
    id: Number(request.query.id ?? 0),
    title: mediaType === 'movie' ? title : undefined,
    name: mediaType === 'tv' ? title : undefined,
    release_date: String(request.query.year ?? '') || undefined,
    first_air_date: String(request.query.year ?? '') || undefined,
  }

  try {
    const rating = await lookupRating(item, mediaType)
    response.json({
      content_rating: rating?.rating,
      content_rating_descriptors: rating?.descriptors ?? [],
      content_rating_source: rating?.source,
      content_rating_region: rating?.region,
      content_rating_original: rating?.originalRating,
    })
  } catch (error) {
    handleApiError(error, response)
  }
})

app.get('/api/home', async (_request, response) => {
  try {
    const [trending, recommended, referenceDetails, liveUpcoming] = await Promise.all([
      tmdbFirstThirty('trending/all/week?language=en-US'),
      tmdbFirstThirty('tv/337700/recommendations?language=en-US'),
      tmdb<TmdbDetails>('tv/337700?append_to_response=content_ratings,images&include_image_language=en,null'),
      // Fetch sports content from TMDB - using keywords for sports
      tmdbFirstThirty('discover/tv?with_keywords=210024|210025|32292|32293&language=en-US&sort_by=first_air_date.desc&include_null_first_air_dates=false'),
    ])

    const trendingItems = trending.map((item) => ({
      ...withRecentReleaseLabel(
        withVerifiedKijkwijzer(item, item.media_type ?? (item.title ? 'movie' : 'tv')),
        item.media_type ?? (item.title ? 'movie' : 'tv'),
      ),
    }))
    const featured = await enrichFeatured({ ...referenceDetails, media_type: 'tv' })
    const featuredRailItems = [featured, ...trendingItems.filter((item) => item.id !== featured.id)].slice(0, 30)
    const heroCandidates = pickRandomItems(featuredRailItems.filter((item) => item.backdrop_path && item.overview), 6)
    const heroItems = await Promise.all(heroCandidates.map((item) => item.id === featured.id ? featured : enrichFeatured(item)))
    const enrichedHeroItems = new Map(heroItems.map((item) => [item.id, item]))
    const featuredRailWithHeroDetails = featuredRailItems.map((item) => enrichedHeroItems.get(item.id) ?? item)

    // Process live/upcoming sports items from TMDB
    const now = new Date()
    const liveUpcomingItems = await Promise.all(
      liveUpcoming.slice(0, 10).map(async (item) => {
        const withKijkwijzer = withVerifiedKijkwijzer(item, 'tv')
        try {
          // Fetch TV show details to get next_episode_to_air
          const details = await tmdb<TmdbDetails>(`tv/${item.id}?append_to_response=seasons,content_ratings&include_image_language=en,null`)
          const nextEpisode = details.next_episode_to_air
          // Determine sport type from genres or keywords
          const sportType = determineSportType(details)
          // Format live time from next episode air date
          const liveTime = nextEpisode?.air_date 
            ? formatLiveTime(new Date(`${nextEpisode.air_date}T12:00:00Z`))
            : undefined
          // Clean overview - remove "Men | " or "Women | " prefixes
          let overview = details.overview || item.overview || ''
          overview = overview.replace(/^(Men|Women)\s*\|\s*/i, '')
          return {
            ...withKijkwijzer,
            next_episode_to_air: nextEpisode,
            seasons: details.seasons,
            sport_type: sportType,
            live_time: liveTime,
            overview: overview,
          }
        } catch {
          return withKijkwijzer
        }
      })
    )

    // Filter out items without sport type or live time from TMDB results
    const filteredLiveUpcoming = liveUpcomingItems.filter(item => item.sport_type && item.live_time)

    // Fallback mock data for sports that might not be in TMDB
    // Using real TMDB poster paths from trending items so images load correctly
    const trendingPosters = trendingItems.map(item => item.poster_path).filter(Boolean)
    const fallbackPosters = trendingPosters.length > 0 ? trendingPosters : ['/2QVTk55dw9tMUHDlG4027cOTNOv.jpg', '/sJZcy8QsOPuRPiCfoCWVB3r9Ohg.jpg', '/zPHfsaiMZT1HNz1ZS55iyLKZkFG.jpg']

    const fallbackSports = [
      {
        id: 999005,
        name: 'Men\'s and Women\'s Lead | Final',
        overview: 'World Climbing Para Series | Gunsan',
        poster_path: fallbackPosters[0] || '/2QVTk55dw9tMUHDlG4027cOTNOv.jpg',
        backdrop_path: null,
        first_air_date: '2024-11-22',
        media_type: 'tv',
        vote_average: 0,
        vote_count: 0,
        genre_ids: [],
        origin_country: ['KR'],
        original_language: 'en',
        original_name: 'Men\'s and Women\'s Lead | Final',
        next_episode_to_air: {
          air_date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          episode_number: 1,
          season_number: 1,
        },
        sport_type: 'Climbing',
        live_time: 'Fri, 7:00 AM',
      },
      {
        id: 999006,
        name: 'Czech Republic - Germany',
        overview: 'Round Robin | European Championship',
        poster_path: fallbackPosters[1] || '/sJZcy8QsOPuRPiCfoCWVB3r9Ohg.jpg',
        backdrop_path: null,
        first_air_date: '2024-11-22',
        media_type: 'tv',
        vote_average: 0,
        vote_count: 0,
        genre_ids: [],
        origin_country: ['EU'],
        original_language: 'en',
        original_name: 'Czech Republic - Germany',
        next_episode_to_air: {
          air_date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          episode_number: 1,
          season_number: 1,
        },
        sport_type: 'Curling',
        live_time: 'Fri, 9:30 AM',
      },
      {
        id: 999007,
        name: 'Czech Republic - Sweden',
        overview: 'Round Robin | European Championship',
        poster_path: fallbackPosters[2] || '/zPHfsaiMZT1HNz1ZS55iyLKZkFG.jpg',
        backdrop_path: null,
        first_air_date: '2024-11-22',
        media_type: 'tv',
        vote_average: 0,
        vote_count: 0,
        genre_ids: [],
        origin_country: ['EU'],
        original_language: 'en',
        original_name: 'Czech Republic - Sweden',
        next_episode_to_air: {
          air_date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          episode_number: 1,
          season_number: 1,
        },
        sport_type: 'Curling',
        live_time: 'Fri, 2:00 PM',
      },
      {
        id: 999008,
        name: 'Simmons Bank Championship | Day 1',
        overview: 'PGA Tour Champions',
        poster_path: fallbackPosters[3 % fallbackPosters.length] || '/2QVTk55dw9tMUHDlG4027cOTNOv.jpg',
        backdrop_path: null,
        first_air_date: '2024-11-22',
        media_type: 'tv',
        vote_average: 0,
        vote_count: 0,
        genre_ids: [],
        origin_country: ['US'],
        original_language: 'en',
        original_name: 'Simmons Bank Championship | Day 1',
        next_episode_to_air: {
          air_date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          episode_number: 1,
          season_number: 1,
        },
        sport_type: 'Golf',
        live_time: 'Fri, 6:00 PM',
      },
      {
        id: 999009,
        name: 'Italy - Germany',
        overview: 'Round Robin | European Championship',
        poster_path: fallbackPosters[4 % fallbackPosters.length] || '/2QVTk55dw9tMUHDlG4027cOTNOv.jpg',
        backdrop_path: null,
        first_air_date: '2024-11-22',
        media_type: 'tv',
        vote_average: 0,
        vote_count: 0,
        genre_ids: [],
        origin_country: ['EU'],
        original_language: 'en',
        original_name: 'Italy - Germany',
        next_episode_to_air: {
          air_date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          episode_number: 1,
          season_number: 1,
        },
        sport_type: 'Curling',
        live_time: 'Fri, 6:30 PM',
      },
      {
        id: 999010,
        name: 'Mexico Open | Day 2',
        overview: 'PGA Tour',
        poster_path: fallbackPosters[5 % fallbackPosters.length] || '/sJZcy8QsOPuRPiCfoCWVB3r9Ohg.jpg',
        backdrop_path: null,
        first_air_date: '2024-11-22',
        media_type: 'tv',
        vote_average: 0,
        vote_count: 0,
        genre_ids: [],
        origin_country: ['US'],
        original_language: 'en',
        original_name: 'Mexico Open | Day 2',
        next_episode_to_air: {
          air_date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          episode_number: 2,
          season_number: 1,
        },
        sport_type: 'Golf',
        live_time: 'Fri, 9:00 PM',
      },
    ].map(item => ({
      ...withVerifiedKijkwijzer(item, 'tv'),
      next_episode_to_air: item.next_episode_to_air,
      sport_type: item.sport_type,
      live_time: item.live_time,
    }))

    // Combine TMDB results with fallback sports
    const allLiveUpcoming = [...filteredLiveUpcoming, ...fallbackSports]

    response.json({
      featured: heroItems[0] ?? featured,
      hero_items: heroItems,
      rows: [
        { id: 'trending', title: 'Featured', items: featuredRailWithHeroDetails },
        { id: 'live-upcoming', title: 'Live & Upcoming', items: allLiveUpcoming },
        { id: 'recommended', title: 'Recommended for You', items: recommended.map((item) => withVerifiedKijkwijzer(item, 'tv')) },
      ],
    })
  } catch (error) {
    handleApiError(error, response)
  }
})

// Helper function to determine sport type from TMDB data
function determineSportType(details: TmdbDetails): string | undefined {
  const genreNames = details.genres?.map(g => g.name.toLowerCase()) ?? []
  const keywordNames = details.keywords?.results?.map(k => k.name.toLowerCase()) ?? []
  
  // Check genres first
  if (genreNames.some(g => g.includes('sport'))) {
    if (genreNames.some(g => g.includes('golf'))) return 'Golf'
    if (genreNames.some(g => g.includes('curling'))) return 'Curling'
    if (genreNames.some(g => g.includes('basketball'))) return 'Basketball'
    if (genreNames.some(g => g.includes('football') || g.includes('soccer'))) return 'Football'
    if (genreNames.some(g => g.includes('tennis'))) return 'Tennis'
    if (genreNames.some(g => g.includes('baseball'))) return 'Baseball'
    if (genreNames.some(g => g.includes('hockey'))) return 'Hockey'
    if (genreNames.some(g => g.includes('racing') || g.includes('motor'))) return 'Racing'
    if (genreNames.some(g => g.includes('climbing'))) return 'Climbing'
    if (genreNames.some(g => g.includes('wrestling'))) return 'Wrestling'
    if (genreNames.some(g => g.includes('boxing'))) return 'Boxing'
    if (genreNames.some(g => g.includes('mixed martial') || g.includes('mma'))) return 'MMA'
    return 'Sports'
  }
  
  // Check keywords
  if (keywordNames.some(k => k.includes('golf'))) return 'Golf'
  if (keywordNames.some(k => k.includes('curling'))) return 'Curling'
  if (keywordNames.some(k => k.includes('basketball'))) return 'Basketball'
  if (keywordNames.some(k => k.includes('football') || k.includes('soccer'))) return 'Football'
  if (keywordNames.some(k => k.includes('tennis'))) return 'Tennis'
  if (keywordNames.some(k => k.includes('baseball'))) return 'Baseball'
  if (keywordNames.some(k => k.includes('hockey'))) return 'Hockey'
  if (keywordNames.some(k => k.includes('racing') || k.includes('motor'))) return 'Racing'
  if (keywordNames.some(k => k.includes('climbing'))) return 'Climbing'
  if (keywordNames.some(k => k.includes('wrestling'))) return 'Wrestling'
  if (keywordNames.some(k => k.includes('boxing'))) return 'Boxing'
  if (keywordNames.some(k => k.includes('mixed martial') || k.includes('mma'))) return 'MMA'
  if (keywordNames.some(k => k.includes('sport'))) return 'Sports'
  
  return undefined
}

// Helper function to format live time from date
function formatLiveTime(date: Date): string {
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(date)
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  if (date.toDateString() === today.toDateString()) {
    return `Today, ${time}`
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow, ${time}`
  } else {
    return `${day}, ${time}`
  }
}

app.get('/api/search', async (request, response) => {
  const query = String(request.query.q ?? '').trim()
  if (!query) {
    response.status(400).json({ error: 'Enter a title to search.' })
    return
  }

  try {
    const data = await tmdb<TmdbList>(`search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`)
    const results = data.results
      .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
      .map((item) => withVerifiedKijkwijzer(item, item.media_type as 'movie' | 'tv'))
    response.json({ results })
  } catch (error) {
    handleApiError(error, response)
  }
})

// Image proxy endpoint to bypass CORS/ORB restrictions
app.get('/api/image-proxy', async (request, response) => {
  const url = request.query.url as string
  const size = request.query.size as string || 'w500'
  
  if (!url) {
    response.status(400).json({ error: 'Missing url parameter' })
    return
  }

  // Validate URL is from TMDB
  if (!url.includes('image.tmdb.org') && !url.startsWith('/')) {
    response.status(400).json({ error: 'Invalid image URL' })
    return
  }

  try {
    // Construct full TMDB image URL if path only
    const imageUrl = url.startsWith('http') ? url : `https://image.tmdb.org/t/p/${size}${url}`
    
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HBO-Max-Clone/1.0)',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!imageResponse.ok) {
      response.status(imageResponse.status).json({ error: 'Failed to fetch image' })
      return
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = await imageResponse.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Set CORS headers
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    response.setHeader('Content-Type', contentType)
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    response.setHeader('Content-Length', buffer.length.toString())

    response.send(buffer)
  } catch (error) {
    console.error('Image proxy error:', error)
    response.status(500).json({ error: 'Failed to proxy image' })
  }
})

// Handle OPTIONS for CORS preflight
app.options('/api/image-proxy', (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.sendStatus(204)
})

app.listen(port, '0.0.0.0', () => {
  console.log(`API listening on http://localhost:${port}`)
})