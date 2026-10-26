import { useId } from 'react'

const descriptorIcons = [
  { matches: ['violence', 'geweld'], label: 'Geweld', symbol: 'geweld' },
  { matches: ['fear', 'angst'], label: 'Angst', symbol: 'angst' },
  { matches: ['sex', 'nudity', 'seks', 'naakt'], label: 'Seks', symbol: 'seks', tooltip: 'Kijkwijzer sexual-content descriptor; not an age rating.' },
  { matches: ['drug', 'drugs'], label: 'Drugs', symbol: 'drugs' },
  { matches: ['language', 'grof taalgebruik'], label: 'Grof taalgebruik', symbol: 'grof-taalgebruik' },
  { matches: ['discrimination', 'discriminatie'], label: 'Discriminatie', symbol: 'discriminatie' },
]

const spriteUrl = '/assets/kijkwijzer-official.svg'

function KijkwijzerSymbol({ symbol, label, tooltip }: {
  symbol: string
  label: string
  tooltip?: string
}) {
  const title = tooltip ?? label
  const maskId = `kijkwijzer-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  return (
    <svg className="kijkwijzer-symbol" viewBox="0 0 24 24" role="img" aria-label={label}>
      <title>{title}</title>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <circle cx="12" cy="12" r="12" fill="white" />
          <use href={`${spriteUrl}#${symbol}`} fill="black" />
        </mask>
      </defs>
      <circle cx="12" cy="12" r="12" fill="currentColor" mask={`url(#${maskId})`} />
      <circle cx="12" cy="12" r="11.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function KijkwijzerBadges({ rating, descriptors = [], source = 'kijkwijzer', region, originalRating }: {
  rating?: string
  descriptors?: string[]
  source?: 'kijkwijzer' | 'tmdb'
  region?: string
  originalRating?: string
}) {
  const badges = descriptors.map((descriptor) => {
    const normalized = descriptor.toLowerCase()
    const match = descriptorIcons.find((entry) => entry.matches.some((keyword) => normalized.includes(keyword)))
    return { descriptor, ...match }
  }).filter((badge) => badge.symbol)

  if (!rating && !badges.length) return null

  const ratingSymbol = rating?.toUpperCase() === 'AL'
    ? 'alle-leeftijden'
    : rating && ['6', '9', '12', '14', '16', '18'].includes(rating)
      ? `leeftijd-${rating}`
      : undefined

  if (source === 'tmdb' && rating) {
    if (ratingSymbol) {
      const sourceRating = originalRating ? `TMDB ${region ?? ''} ${originalRating}`.trim() : `TMDB ${region ?? ''}`.trim()
      const label = `Kijkwijzer-style age ${rating}, mapped from ${sourceRating}`
      return (
        <span className="kijkwijzer-badges" aria-label={label}>
          <KijkwijzerSymbol symbol={ratingSymbol} label={label} tooltip={label} />
        </span>
      )
    }
    return null
  }

  return (
    <span className="kijkwijzer-badges" aria-label="Kijkwijzer ratings">
      {rating && (ratingSymbol ? (
        <KijkwijzerSymbol key="rating" symbol={ratingSymbol} label={`Kijkwijzer ${rating}`} />
      ) : <span className="content-rating" key="rating" title={`Kijkwijzer ${rating}`} aria-label={`Kijkwijzer ${rating}`}>{rating}</span>)}
      {badges.map(({ descriptor, label, symbol, tooltip }) => label && symbol && (
        <KijkwijzerSymbol key={descriptor} symbol={symbol} label={label} tooltip={tooltip} />
      ))}
    </span>
  )
}