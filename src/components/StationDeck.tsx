import { useEffect, useRef, type CSSProperties } from 'react'
import type { Station } from '../stations'
import type { RadioStatus } from '../useRadio'
import { FavoriteButton } from './FavoriteButton'
import { StationBadge } from './StationBadge'
import { StatusPill } from './StatusPill'

interface Props {
  stations: Station[]
  /** Card in the middle of the deck. */
  index: number
  /** The station that is on, if any, and how it's doing. */
  current: Station | null
  status: RadioStatus
  colors: Record<string, string>
  fallback: string
  favorites: string[]
  onChange: (index: number) => void
  /** The centred card was tapped. */
  onActivate: (station: Station) => void
  onFavorite: (id: string) => void
}

/** Swipeable station cards. The card in the middle is the focused station. */
export function StationDeck({
  stations,
  index,
  current,
  status,
  colors,
  fallback,
  favorites,
  onChange,
  onActivate,
  onFavorite,
}: Props) {
  const scrollerRef = useRef<HTMLUListElement>(null)
  const cardsRef = useRef<(HTMLLIElement | null)[]>([])
  const indexRef = useRef(index)

  useEffect(() => {
    indexRef.current = index
  }, [index])

  const offsetOf = (card: HTMLElement, scroller: HTMLElement) =>
    card.offsetLeft - (scroller.clientWidth - card.clientWidth) / 2

  const scrollTo = (i: number, behavior: ScrollBehavior) => {
    const scroller = scrollerRef.current
    const card = cardsRef.current[i]
    if (scroller && card) scroller.scrollTo({ left: offsetOf(card, scroller), behavior })
  }

  // Swiping: once the deck settles, the card nearest the middle becomes the focused one.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const settle = () => {
      const middle = scroller.scrollLeft + scroller.clientWidth / 2
      let nearest = indexRef.current
      let distance = Infinity
      cardsRef.current.forEach((card, i) => {
        if (!card) return
        const d = Math.abs(card.offsetLeft + card.clientWidth / 2 - middle)
        if (d < distance) [nearest, distance] = [i, d]
      })
      if (nearest !== indexRef.current) onChange(nearest)
    }

    // scrollend fires once the snap has finished; older browsers get a debounce instead.
    if ('onscrollend' in window) {
      scroller.addEventListener('scrollend', settle)
      return () => scroller.removeEventListener('scrollend', settle)
    }
    let timer = 0
    const onScroll = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(settle, 120)
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearTimeout(timer)
      scroller.removeEventListener('scroll', onScroll)
    }
  }, [stations, onChange])

  // Keyboard or island changed the station: bring its card into the middle. On first showing,
  // the deck opens straight on the card (the remembered station) rather than scrolling to it.
  const shownRef = useRef(false)
  useEffect(() => {
    const scroller = scrollerRef.current
    const card = cardsRef.current[index]
    if (!scroller || !card) return
    const instant = !shownRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    shownRef.current = true
    if (Math.abs(scroller.scrollLeft - offsetOf(card, scroller)) > 2) scrollTo(index, instant ? 'instant' : 'smooth')
  }, [index])

  // Arrow keys move through the deck while focus is on the page or a card.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const move = ({ ArrowRight: 1, ArrowLeft: -1 } as Record<string, number>)[event.key]
      const focus = document.activeElement
      const inDeck = focus === document.body || scrollerRef.current?.contains(focus)
      if (!move || !inDeck || event.altKey || event.metaKey || event.ctrlKey) return
      event.preventDefault()
      const next = Math.min(stations.length - 1, Math.max(0, indexRef.current + move))
      if (next !== indexRef.current) onChange(next)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [stations.length, onChange])

  return (
    <ul ref={scrollerRef} className="deck" aria-label="Radio stations">
      {stations.map((station, i) => {
        const focused = i === index
        const isOn = current?.id === station.id && status !== 'off'
        return (
          <li
            key={station.id}
            ref={(el) => {
              cardsRef.current[i] = el
            }}
            className="card"
            style={{ '--accent': colors[station.id] ?? fallback } as CSSProperties}
            aria-current={focused ? 'true' : undefined}
          >
            <button
              type="button"
              className="card__face"
              aria-label={focused ? `Play ${station.name}` : station.name}
              tabIndex={focused ? 0 : -1}
              onClick={() => (focused ? onActivate(station) : onChange(i))}
            >
              <StationBadge station={station} className="card__logo" />
              {isOn && <StatusPill status={status} className="card__pill" />}
            </button>
            <FavoriteButton
              station={station}
              favorite={favorites.includes(station.id)}
              onToggle={onFavorite}
              className="card__fav"
              tabIndex={focused ? 0 : -1}
            />
          </li>
        )
      })}
    </ul>
  )
}
