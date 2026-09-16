/**
 * The broadcast clock, in Unix seconds.
 *
 * Every device works out the same broadcast from its clock, so the clocks have to agree. The
 * device's clock is corrected against a time API (VITE_TIME_API_URL, asked for VITE_TIMEZONE):
 * the difference between the API's time and the device's is kept as a drift and added to
 * every reading. Without the API, or until it answers, it's plain device time.
 *
 * The debug panel can shift the clock on top of that to test other moments of the schedule.
 */

/** The time API, e.g. https://time.now/developer/api/timezone, with no trailing slash. */
export const TIME_API_URL = (import.meta.env.VITE_TIME_API_URL || '').replace(/\/*$/, '')

/** The IANA time zone the API is asked for, and that the debug panel shows the clock in. */
export const TIMEZONE = import.meta.env.VITE_TIMEZONE || 'UTC'

/** How often the drift is measured again. */
const RESYNC_MS = 10 * 60 * 1000

/** Answers slower than this are too uncertain to set the clock by. */
const MAX_ROUND_TRIP_MS = 5000

export interface ClockSync {
  /** Seconds the device clock was behind (positive) or ahead (negative) of the API. */
  drift: number
  /** How long the request took, in milliseconds; the drift is uncertain by up to half of it. */
  roundTrip: number
  /** When the sync happened, in device Unix seconds. */
  at: number
}

let drift = 0
let debugOffset = 0
let lastSync: ClockSync | null = null

export const now = () => Date.now() / 1000 + drift + debugOffset

/** The last successful sync, or null while running on device time. */
export const clockSync = () => lastSync

export const clockOffset = () => debugOffset

export function setClockOffset(seconds: number) {
  debugOffset = seconds
}

/** The API's reply, as far as the clock reads it (the worldtimeapi shape). */
interface TimeReply {
  unixtime: number
  utc_datetime: string
}

/**
 * Measures the device clock against the API once. Resolves to the sync, or null if the API is
 * not configured or didn't answer usefully; the clock then carries on as it was.
 */
export async function syncClock(): Promise<ClockSync | null> {
  if (!TIME_API_URL) return null
  try {
    const sent = Date.now()
    const zone = TIMEZONE.split('/').map(encodeURIComponent).join('/')
    const response = await fetch(`${TIME_API_URL}/${zone}`, { cache: 'no-store' })
    const roundTrip = Date.now() - sent
    if (!response.ok || roundTrip > MAX_ROUND_TRIP_MS) return null
    const reply = (await response.json()) as TimeReply

    // unixtime is whole seconds; the fraction comes from utc_datetime, which carries microseconds
    // that Date.parse() can't be trusted with everywhere.
    const fraction = /T\d\d:\d\d:\d\d(\.\d+)?/.exec(reply.utc_datetime)?.[1]
    const serverTime = reply.unixtime + (fraction ? Number(fraction) : 0)
    if (!Number.isFinite(serverTime)) return null

    // The reply was stamped about halfway through the round trip.
    const deviceTime = (sent + roundTrip / 2) / 1000
    drift = serverTime - deviceTime
    lastSync = { drift, roundTrip, at: Date.now() / 1000 }
    return lastSync
  } catch {
    return null
  }
}

/**
 * Keeps the clock in sync: now, every RESYNC_MS, and whenever the page comes back into view
 * (a phone's clock can wander while it sleeps). Returns a function that stops it.
 */
export function keepClockSynced(onSync?: (sync: ClockSync) => void) {
  if (!TIME_API_URL) return () => {}
  let stopped = false
  const sync = () => {
    syncClock().then((result) => {
      if (result && !stopped) onSync?.(result)
    })
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') sync()
  }
  sync()
  const timer = window.setInterval(sync, RESYNC_MS)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    stopped = true
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
