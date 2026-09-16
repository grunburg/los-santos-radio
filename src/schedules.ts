/** Loads each station's files into its schedule, once. */
import { parseStation, type RadioJson, type StationJson, type StationSchedule } from './schedule'
import { STATIONS_URL, type Station } from './stations'

const pending = new Map<string, Promise<StationSchedule>>()
const ready = new Map<string, StationSchedule>()
let radio: Promise<RadioJson> | undefined

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(STATIONS_URL + path)
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.json()
}

export function loadSchedule(station: Station) {
  let promise = pending.get(station.id)
  if (!promise) {
    radio ??= fetchJson<RadioJson>('radio.json').catch((error: unknown) => {
      radio = undefined
      throw error
    })
    promise = Promise.all([radio, fetchJson<StationJson>(`${station.id}/station.json`)]).then(([common, game]) => {
      const schedule = parseStation(game, common, station.name)
      ready.set(station.id, schedule)
      return schedule
    })
    promise.catch(() => pending.delete(station.id))
    pending.set(station.id, promise)
  }
  return promise
}

/** The schedule if it has loaded; nothing is fetched. */
export function scheduleOf(id: string) {
  return ready.get(id)
}
