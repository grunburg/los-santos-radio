import { LOGOS, PLATES } from '../logos'
import type { Station } from '../stations'

/** Round station artwork. */
export function StationBadge({ station, className = '' }: { station: Station; className?: string }) {
  const logo = LOGOS[station.id]

  if (logo) {
    const plate = PLATES[station.id]
    return (
      <img
        className={`badge ${plate ? `badge--plate badge--plate-${plate}` : ''} ${className}`.trim()}
        src={logo}
        alt=""
        draggable={false}
      />
    )
  }

  // No logo file yet: show the station's initials.
  const initials = station.name
    .split(/\s+/)
    .filter((word) => /^[A-Z0-9]/.test(word))
    .map((word) => word[0])
    .join('')
    .slice(0, 3)
  return (
    <svg className={`badge ${className}`.trim()} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill="#1b1b1f" />
      <text
        x="50"
        y="62"
        fill="#fff"
        fontFamily="'Inter Tight', 'Inter', system-ui, sans-serif"
        fontWeight="800"
        fontSize="36"
        textAnchor="middle"
      >
        {initials}
      </text>
    </svg>
  )
}
