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
    const [trending, recommended, referenceDetails] = await Promise.all([
      tmdbFirstThirty('trending/all/week?language=en-US'),
      tmdbFirstThirty('tv/337700/recommendations?language=en-US'),
      tmdb<TmdbDetails>('tv/337700?append_to_response=content_ratings,images&include_image_language=en,null'),
    ])

    const trendingItems = trending.map((item) => ({
      ...withRecentReleaseLabel(
        withVerifiedKijkwijzer(item, item.media_type ?? (item.title ? 'movie' : 'tv')),
        item.media_type ?? (item.title ? 'movie' : 'tv'),
      ),
    }))
    const featured = await enrichFeatured({ ...referenceDetails, media_type: 'tv' })
    const featuredRailItems = [featured, ...trendingItems.filter((item) => item.id !== featured.id)].slice(0, 30)
    const heroCandidates = pickRandomItems(featuredRailItems.filter((item) => item.backdrop_path && item.overview), 5)
    const heroItems = await Promise.all(heroCandidates.map((item) => item.id === featured.id ? featured : enrichFeatured(item)))
    const enrichedHeroItems = new Map(heroItems.map((item) => [item.id, item]))
    const featuredRailWithHeroDetails = featuredRailItems.map((item) => enrichedHeroItems.get(item.id) ?? item)

    response.json({
      featured: heroItems[0] ?? featured,
      hero_items: heroItems,
      rows: [
        { id: 'trending', title: 'Featured', items: featuredRailWithHeroDetails },
        { id: 'recommended', title: 'Recommended for You', items: recommended.map((item) => withVerifiedKijkwijzer(item, 'tv')) },
      ],
    })
  } catch (error) {
    handleApiError(error, response)
  }
})

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

app.listen(port, '0.0.0.0', () => {
  console.log(`API listening on http://localhost:${port}`)
})