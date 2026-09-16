import { GalleryHorizontal, List } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DebugPanel } from './components/DebugPanel'
import { PlayerIsland } from './components/PlayerIsland'
import { StationDeck } from './components/StationDeck'
import { StationList } from './components/StationList'
import { barColor } from './logoColor'
import { loadSchedule } from './schedules'
import { DEBUG, STATIONS } from './stations'
import { useFavorites, withFavoritesFirst } from './useFavorites'
import { FALLBACK_ACCENT, useLogoColors } from './useLogoColors'
import { nowPlaying, useRadio } from './useRadio'

type View = 'cards' | 'list'

const VIEW_KEY = 'gta5radio:view'

function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'cards'
  } catch {
    return 'cards'
  }
}

export default function App() {
  const { station, status, volume, setVolume, tune, player } = useRadio()
  const colors = useLogoColors(STATIONS)
  const { favorites, toggleFavorite } = useFavorites()
  // Favourites first, then the rest: the order of the deck and the list.
  const stations = useMemo(() => withFavoritesFirst(STATIONS, favorites), [favorites])
  // The focused station: the card in the middle of the deck, or the highlighted row.
  const [focusedId, setFocusedId] = useState(stations[0].id)
  const [view, setView] = useState<View>(loadView)
  // Re-render every second so the now-playing text and debug panel follow the clock.
  const [, setSecond] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setSecond((n) => n + 1), 1000)
    // Load the schedules in the background, so every station can show what's on.
    STATIONS.forEach((entry) => loadSchedule(entry).catch(() => {}))
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view)
    } catch {
      // The view just won't be remembered.
    }
  }, [view])

  const index = Math.max(0, stations.findIndex((s) => s.id === focusedId))
  const focused = stations[index]
  const isCurrent = station?.id === focused.id
  const track = nowPlaying(focused)
  const accent = colors[focused.id] ?? FALLBACK_ACCENT

  // The page's glow follows the focused station: painted on <html>, see index.css. The browser's
  // own bars follow too, through theme-color.
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', barColor(accent))
  }, [accent])

  const on = status !== 'off'
  // Swiping the deck: focus the card, and retune if the radio is on.
  const change = useCallback(
    (next: number) => {
      setFocusedId(stations[next].id)
      if (on) tune(stations[next])
    },
    [stations, on, tune],
  )
  // Choosing a row: focus it and tune in.
  const select = useCallback(
    (next: number) => {
      setFocusedId(stations[next].id)
      tune(stations[next])
    },
    [stations, tune],
  )

  // The island shows the station that's on; with the radio off, the focused station.
  const islandStation = on && station ? station : focused

  const toggle = () => {
    if (isCurrent && status !== 'error') tune(null)
    else tune(focused)
  }

  return (
    <div className="app">
      <header className="top">
        <h1 className="brand">Los Santos Radio</h1>
        <div className="top__tools">
          {view === 'cards' && (
            <p className="counter">
              <span>{index + 1}</span>
              <span className="counter__of">/ {stations.length}</span>
            </p>
          )}
          <div className="views" role="radiogroup" aria-label="View">
            <button
              type="button"
              role="radio"
              aria-checked={view === 'cards'}
              aria-label="Cards"
              className="views__option"
              onClick={() => setView('cards')}
            >
              <GalleryHorizontal aria-hidden="true" />
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={view === 'list'}
              aria-label="List"
              className="views__option"
              onClick={() => setView('list')}
            >
              <List aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className={`stage stage--${view}`}>
        {view === 'cards' ? (
          <>
            <StationDeck
              stations={stations}
              index={index}
              current={station}
              status={status}
              colors={colors}
              fallback={FALLBACK_ACCENT}
              favorites={favorites}
              onChange={change}
              onActivate={() => toggle()}
              onFavorite={toggleFavorite}
            />

            <section className="meta" aria-live="polite">
              <h2 className="meta__name">{focused.name}</h2>
              <p className="meta__genre">{focused.genre}</p>
              {track ? (
                <p className="meta__track">
                  <span className="meta__artist">{track.artist || 'Now playing'}</span>
                  <span className="meta__title">{track.title}</span>
                </p>
              ) : (
                <p className="meta__track meta__track--empty">
                  <span className="meta__artist">Now playing</span>
                  <span className="meta__title">Loading schedule…</span>
                </p>
              )}
            </section>
          </>
        ) : (
          <StationList
            stations={stations}
            index={index}
            current={station}
            status={status}
            colors={colors}
            fallback={FALLBACK_ACCENT}
            favorites={favorites}
            onSelect={select}
            onFavorite={toggleFavorite}
          />
        )}
      </main>

      <PlayerIsland
        station={islandStation}
        track={islandStation === focused ? track : nowPlaying(islandStation)}
        isCurrent={islandStation === station}
        status={status}
        volume={volume}
        accent={colors[islandStation.id] ?? FALLBACK_ACCENT}
        onToggle={toggle}
        onVolume={setVolume}
      />

      {DEBUG && <DebugPanel player={player} status={status} />}
    </div>
  )
}
