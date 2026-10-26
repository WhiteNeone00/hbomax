import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { BrandLogo } from './BrandLogo'
import { myStuffIconUrl, profileIconUrl, searchIconUrl } from '../../assets/brandAssets'

function HamburgerIcon() {
  return (
    <svg aria-hidden="true" width="28" height="28" viewBox="0 0 48 48" fill="none">
      <rect x="5.14" y="8.29" width="37.72" height="3.43" rx="1.72" fill="currentColor" />
      <rect x="5.14" y="22.29" width="37.72" height="3.43" rx="1.72" fill="currentColor" />
      <rect x="5.14" y="36.29" width="37.72" height="3.43" rx="1.72" fill="currentColor" />
    </svg>
  )
}

export function NavigationBar({ onSearch, onClearSearch, onMyStuff }: {
  onSearch: (query: string) => void
  onClearSearch: () => void
  onMyStuff: () => void
}) {
  const navRef = useRef<HTMLElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    function updateScrollSurface() {
      const progress = Math.min(1, Math.max(0, (window.scrollY - 8) / 88))
      navRef.current?.style.setProperty('--nav-background', `rgba(8, 8, 8, ${progress * 0.88})`)
      navRef.current?.style.setProperty('--nav-blur', `${progress * 14}px`)
    }
    updateScrollSurface()
    window.addEventListener('scroll', updateScrollSurface, { passive: true })
    return () => window.removeEventListener('scroll', updateScrollSurface)
  }, [])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (query.trim()) onSearch(query.trim())
  }

  function clearSearch() {
    setQuery('')
    onClearSearch()
  }

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to Main Content</a>
      <nav ref={navRef} aria-label="Main" className="site-nav">
        <div className="nav-left">
          <button className="menu-button" data-testid="slide_out_nav_menuButton" aria-label="Browse Menu" aria-expanded={menuOpen} aria-haspopup="menu" aria-controls="browse-menu" onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X size={25} strokeWidth={1.8} /> : <HamburgerIcon />}
          </button>
          <BrandLogo />
        </div>
        <div className="nav-right">
          <div className={`nav-search${searchOpen ? ' is-open' : ''}`}>
            {searchOpen && <form onSubmit={submitSearch} role="search"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles" aria-label="Search titles" />{query && <button type="button" className="clear-search" aria-label="Clear search" onClick={clearSearch}><X size={16} /></button>}</form>}
            <button className="nav-icon-button search-trigger" aria-label={searchOpen ? 'Close search' : 'Search'} title="Search" onClick={() => { setSearchOpen((open) => !open); setMenuOpen(false); setProfileOpen(false) }}>{searchOpen ? <X size={21} /> : <img src={searchIconUrl} alt="" onError={(event) => event.currentTarget.remove()} />}</button>
          </div>
          <a className="nav-icon-button my-stuff-link" aria-label="My Stuff" title="My Stuff" href="#my-stuff" onClick={(event) => { event.preventDefault(); onMyStuff(); setMenuOpen(false); setProfileOpen(false) }}><img src={myStuffIconUrl} alt="" onError={(event) => event.currentTarget.remove()} /></a>
          <div className="profile-control">
            <button className="profile-button" aria-label="Profile menu" aria-expanded={profileOpen} aria-haspopup="menu" onClick={() => { setProfileOpen((open) => !open); setMenuOpen(false) }}><img className="profile-avatar" src={profileIconUrl} alt="" onError={(event) => event.currentTarget.remove()} /></button>
            {profileOpen && <div className="profile-menu" role="menu"><strong>Jordan</strong><a role="menuitem" href="#my-stuff" onClick={(event) => { event.preventDefault(); onMyStuff(); setProfileOpen(false) }}>My Stuff</a></div>}
          </div>
        </div>
        {menuOpen && <div className="browse-menu" id="browse-menu" role="menu">
          <span className="browse-caption">BROWSE</span>
          <a role="menuitem" href="#home" onClick={() => setMenuOpen(false)}>Home</a>
          <a role="menuitem" href="#recommended" onClick={() => setMenuOpen(false)}>Recommended for You</a>
          <a role="menuitem" href="#my-stuff" onClick={(event) => { event.preventDefault(); onMyStuff(); setMenuOpen(false) }}>My Stuff</a>
        </div>}
      </nav>
    </>
  )
}