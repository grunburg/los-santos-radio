import { useState } from 'react'
import { clockOffset, clockSync, now, setClockOffset, TIME_API_URL, TIMEZONE } from '../clock'
import type { Player } from '../player'
import { locate, voiceLines } from '../schedule'
import { STATIONS_URL } from '../stations'
import type { RadioStatus } from '../useRadio'

interface Props {
  player: Player
  status: RadioStatus
}

/** Jumps offered by the skip buttons, in seconds. */
const SKIPS: [string, number][] = [
  ['-1h', -3600],
  ['-5m', -300],
  ['-30s', -30],
  ['+30s', 30],
  ['+5m', 300],
  ['+1h', 3600],
  ['+1d', 86400],
]

const name = (file: string) => file.split('/').pop()!

/** The clock as a local time in the configured zone, e.g. "2026-09-16 23:52:05 EEST". */
const localTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIMEZONE,
  dateStyle: 'short',
  timeStyle: 'medium',
})
const zoneName = new Intl.DateTimeFormat('en', { timeZone: TIMEZONE, timeZoneName: 'short' })

function formatClock(t: number) {
  const date = new Date(t * 1000)
  const zone = zoneName.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? TIMEZONE
  return `${localTime.format(date)} ${zone}`
}

/** Where the time comes from: the API and how far the device was off, or the device itself. */
function source() {
  const sync = clockSync()
  if (!TIME_API_URL) return 'device time'
  if (!sync) return `device time, waiting for ${new URL(TIME_API_URL).host}`
  const sign = sync.drift >= 0 ? '+' : '−'
  return `${new URL(TIME_API_URL).host}: device ${sign}${Math.abs(sync.drift).toFixed(2)} s (±${(sync.roundTrip / 2000).toFixed(2)} s)`
}

function shift(offset: number) {
  if (!offset) return ''
  const sign = offset < 0 ? '-' : '+'
  const s = Math.abs(Math.round(offset))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `shifted ${sign}${h ? `${h}h ` : ''}${m ? `${m}m ` : ''}${s % 60 ? `${s % 60}s` : ''}`.trim()
}

/**
 * Shown only when VITE_DEBUG is "true": where the player is in the schedule, and a clock that
 * can be moved to test other moments of the broadcast.
 */
export function DebugPanel({ player, status }: Props) {
  const [open, setOpen] = useState(true)
  const [offset, setOffset] = useState(clockOffset)

  const skip = (seconds: number) => {
    const next = seconds ? offset + seconds : 0
    setClockOffset(next)
    setOffset(next)
    player.resync()
  }

  if (!open) {
    return (
      <button type="button" className="debug debug__toggle" onClick={() => setOpen(true)}>
        Debug
      </button>
    )
  }

  const t = now()
  const station = player.station
  const { current, next } = station ? locate(station, t) : { current: null, next: null }
  const position = current ? t - current.start : 0
  const lines = station && current ? voiceLines(station, current) : []

  return (
    <aside className="debug">
      <p className="debug__head">
        Debug
        <button type="button" onClick={() => setOpen(false)} aria-label="Hide debug panel">
          Hide
        </button>
      </p>
      <dl className="debug__list">
        <dt>Files</dt>
        <dd>{STATIONS_URL}</dd>

        <dt>Clock</dt>
        <dd>
          {formatClock(t)}
          <span className="debug__note">{source()}</span>
          {offset !== 0 && <span className="debug__note">{shift(offset)}</span>}
          <span className="debug__skips">
            {SKIPS.map(([label, seconds]) => (
              <button key={label} type="button" onClick={() => skip(seconds)}>
                {label}
              </button>
            ))}
            {offset !== 0 && (
              <button type="button" onClick={() => skip(0)}>
                reset
              </button>
            )}
          </span>
        </dd>

        <dt>Station</dt>
        <dd>
          {station ? station.id : '(radio off)'}
          <span className="debug__note">playback: {status}</span>
        </dd>

        {station && (
          <>
            <dt>On air</dt>
            <dd>
              {current ? name(current.file) : '(silence)'}
              {current && (
                <span className="debug__note">
                  {position.toFixed(1)} / {current.length.toFixed(1)} s, deck at {player.deckTime.toFixed(1)} s (
                  {(player.deckTime - position).toFixed(2)} s off)
                </span>
              )}
              {lines.map((line) => (
                <span key={line.at} className="debug__note">
                  DJ: {name(line.clip.file)} at {line.at.toFixed(1)} s
                </span>
              ))}
            </dd>

            <dt>Next</dt>
            <dd>
              {next ? `${name(next.file)} in ${(next.start - t).toFixed(0)} s` : '(nothing)'}
              <span className="debug__note">{player.preloaded ? 'preloaded' : 'not loaded yet'}</span>
            </dd>
          </>
        )}
      </dl>
    </aside>
  )
}
