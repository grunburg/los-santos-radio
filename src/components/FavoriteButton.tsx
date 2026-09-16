import { Check, Plus } from 'lucide-react'
import type { Station } from '../stations'

interface Props {
  station: Station
  favorite: boolean
  onToggle: (id: string) => void
  className?: string
}

/** A plus that marks a station as a favourite, and turns into a tick once it is. */
export function FavoriteButton({ station, favorite, onToggle, className = '' }: Props) {
  return (
    <button
      type="button"
      className={`fav ${className}`.trim()}
      aria-pressed={favorite}
      aria-label={favorite ? `Remove ${station.name} from favourites` : `Add ${station.name} to favourites`}
      onClick={(event) => {
        event.stopPropagation()
        onToggle(station.id)
      }}
    >
      {/* Both icons are stacked; the plus spins away as the tick springs in, see .fav__icon. */}
      <Plus className="fav__icon fav__icon--plus" strokeWidth={2.2} aria-hidden="true" />
      <Check className="fav__icon fav__icon--check" strokeWidth={2.4} aria-hidden="true" />
    </button>
  )
}
