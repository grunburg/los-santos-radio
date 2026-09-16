import { Play, Square, Volume2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { CSSProperties } from 'react'
import type { Track } from '../schedule'
import type { Station } from '../stations'
import type { RadioStatus } from '../useRadio'
import { Marquee } from './Marquee'
import { StationBadge } from './StationBadge'

interface Props {
  /** The station shown in the island: the one that's on, or the focused card. */
  station: Station
  /** What that station is playing, if its schedule has loaded. */
  track: Track | null
  /** Whether that station is the one that's on. */
  isCurrent: boolean
  status: RadioStatus
  volume: number
  accent: string
  onToggle: () => void
  onVolume: (volume: number) => void
}

export function PlayerIsland({ station, track, isCurrent, status, volume, accent, onToggle, onVolume }: Props) {
  const shownStatus: RadioStatus = isCurrent ? status : 'off'
  const playing = isCurrent && (status === 'live' || status === 'tuning')

  const line =
    shownStatus === 'error'
      ? "Couldn't play, try again"
      : track
        ? [track.artist, track.title].filter(Boolean).join(' · ')
        : 'Loading schedule…'

  return (
    <footer className={`island island--${shownStatus}`} style={{ '--accent': accent } as CSSProperties}>
      <div className="island__row">
        {/* Thumbnail and text both crossfade in place. */}
        <div className="island__art">
          <AnimatePresence initial={false}>
            <motion.div
              key={station.id}
              className="island__art-frame"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <StationBadge station={station} className="island__thumb" />
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="island__text" aria-live="polite">
          <AnimatePresence initial={false}>
            <motion.div
              key={station.id}
              className="island__text-frame"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="island__name">{station.name}</p>
              <Marquee className="island__track" text={line} />
            </motion.div>
          </AnimatePresence>
        </div>
        <button
          type="button"
          className="island__play"
          aria-label={playing ? `Stop ${station.name}` : `Play ${station.name}`}
          aria-pressed={playing}
          onClick={onToggle}
        >
          {playing ? (
            <Square fill="currentColor" strokeWidth={0} aria-hidden="true" />
          ) : (
            <Play fill="currentColor" strokeWidth={0} aria-hidden="true" />
          )}
        </button>
      </div>

      <label className="island__volume">
        <Volume2 strokeWidth={1.8} aria-hidden="true" />
        <span className="sr-only">Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolume(Number(e.target.value))}
          style={{ '--fill': `${volume * 100}%` } as CSSProperties}
        />
      </label>
    </footer>
  )
}
