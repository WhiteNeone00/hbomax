type BrandLogoProps = { footer?: boolean }
import { hboMaxLogoUrl } from '../../assets/brandAssets'

export function BrandLogo({ footer = false }: BrandLogoProps) {
  return (
    <a href="#home" className={`brand-link${footer ? ' footer-brand-link' : ''}`} aria-label="HBO Max Home">
      <img src={hboMaxLogoUrl} alt="HBO Max" loading="eager" />
    </a>
  )
}