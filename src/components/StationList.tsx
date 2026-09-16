import { useEffect, useRef, type CSSProperties } from 'react'
import type { Station } from '../stations'
import { nowPlaying } from '../useRadio'
import { FavoriteButton } from './FavoriteButton'
import { StationBadge } from './StationBadge'

interface Props {
  stations: Station[]
  /** The focused station, highlighted in the list. */
  index: number
  colors: Record<string, string>
  fallback: string
  favorites: string[]
  /** A row was chosen: focus it and tune in. */
  onSelect: (index: number) => void
  onFavorite: (id: string) => void
}

/** The stations as a list, one row each, with what's playing on them. */
export function StationList({
  stations,
  index,
  colors,
  fallback,
  favorites,
  onSelect,
  onFavorite,
}: Props) {
  const rowsRef = useRef<(HTMLButtonElement | null)[]>([])

  // Keep the focused row on screen when it changes.
  useEffect(() => {
    rowsRef.current[index]?.scrollIntoView({ block: 'nearest' })
  }, [index])

  // Arrow keys move through the list while focus is on the page or a row.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const move = ({ ArrowDown: 1, ArrowUp: -1 } as Record<string, number>)[event.key]
      const focus = document.activeElement
      const inList = focus === document.body || rowsRef.current.includes(focus as HTMLButtonElement)
      if (!move || !inList || event.altKey || event.metaKey || event.ctrlKey) return
      event.preventDefault()
      const next = Math.min(stations.length - 1, Math.max(0, index + move))
      if (next !== index) onSelect(next)
      if (focus !== document.body) rowsRef.current[next]?.focus()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [index, stations.length, onSelect])

  // Favourites come first in `stations`; with any, the list is split under two headings.
  const split = favorites.length ? stations.filter((s) => favorites.includes(s.id)).length : 0
  const groups = split
    ? [
        { title: 'Favourites', from: 0, items: stations.slice(0, split) },
        { title: 'All stations', from: split, items: stations.slice(split) },
      ]
    : [{ title: '', from: 0, items: stations }]

  return (
    <div className="list">
      {groups.map((group) => (
        <section key={group.title} className="list__group">
          {group.title && <h2 className="list__title">{group.title}</h2>}
          <ul className="list__rows" aria-label={group.title || 'Radio stations'}>
            {group.items.map((station, offset) => {
              const i = group.from + offset
              const focused = i === index
              const track = nowPlaying(station)
              return (
                <li key={station.id} className="row" style={{ '--accent': colors[station.id] ?? fallback } as CSSProperties}>
                  <button
                    ref={(el) => {
                      rowsRef.current[i] = el
                    }}
                    type="button"
                    className={focused ? 'row__body row__body--focused' : 'row__body'}
                    aria-current={focused ? 'true' : undefined}
                    onClick={() => onSelect(i)}
                  >
                    <StationBadge station={station} className="row__logo" />
                    <span className="row__text">
                      <span className="row__name">{station.name}</span>
                      <span className="row__genre">{station.genre}</span>
                      <span className="row__track">
                        {track ? [track.artist, track.title].filter(Boolean).join(' · ') : 'Loading schedule…'}
                      </span>
                    </span>
                  </button>
                  <FavoriteButton
                    station={station}
                    favorite={favorites.includes(station.id)}
                    onToggle={onFavorite}
                    className="row__fav"
                  />
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
