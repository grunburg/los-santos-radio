import { useCallback, useEffect, useRef, useState } from 'react'
import { clockSync, keepClockSynced, now } from './clock'
import { Player, type PlayerStatus } from './player'
import { loadSchedule, scheduleOf } from './schedules'
import { locate, trackAt, type Track } from './schedule'
import { stationArt } from './stationArt'
import { StaticNoise } from './staticNoise'
import type { Station } from './stations'

export type RadioStatus = PlayerStatus

const VOLUME_KEY = 'gta5radio:volume'

/** Lock screen and media control artwork; iOS picks the largest. */
const ARTWORK_SIZES = [192, 512]
const FAVICON_SIZE = 64
const NO_ARTWORK: MediaImage[] = []
/** The page's own icon, kept so it can be put back when the radio is off. */
let defaultIcon: { href: string; type: string } | undefined

function loadVolume() {
  try {
    const stored = localStorage.getItem(VOLUME_KEY)
    const volume = Number(stored)
    return stored !== null && volume >= 0 && volume <= 1 ? volume : 0.8
  } catch {
    return 0.8
  }
}

/** What a station is playing at this moment, if its schedule has loaded. */
export function nowPlaying(station: Station | null): Track | null {
  const schedule = station && scheduleOf(station.id)
  if (!schedule) return null
  const t = now()
  const { current } = locate(schedule, t)
  return current ? trackAt(schedule, current, t - current.start) : null
}

export function useRadio() {
  const [station, setStation] = useState<Station | null>(null)
  const [status, setStatus] = useState<RadioStatus>('off')
  const [volume, setVolumeState] = useState(loadVolume)
  // Bumped whenever the player moves on, so the now-playing text follows it.
  const [, setTick] = useState(0)

  const [player] = useState(() => {
    const p: Player = new Player(() => {
      setStatus(p.status)
      setTick((n) => n + 1)
    })
    return p
  })
  // The AudioContext is created on first use, so this is safe to make up front.
  const [noise] = useState(() => new StaticNoise())
  const tuneRef = useRef(0)

  useEffect(() => {
    return () => {
      player.halt()
      noise.stop(0)
    }
  }, [player, noise])

  // Keep the clock in step with the time API; if it moved by more than the player would let
  // slide, put the playback back where the corrected clock says it should be.
  useEffect(() => {
    let lastDrift = clockSync()?.drift ?? 0
    return keepClockSynced((sync) => {
      if (Math.abs(sync.drift - lastDrift) > 0.3) player.resync()
      lastDrift = sync.drift
      setTick((n) => n + 1)
    })
  }, [player])

  useEffect(() => {
    player.setVolume(volume)
    noise.setVolume(volume)
    try {
      localStorage.setItem(VOLUME_KEY, String(volume))
    } catch {
      // Volume just won't be remembered.
    }
  }, [volume, player, noise])

  // The static plays while tuning and stops as soon as the station is on.
  useEffect(() => {
    if (status !== 'tuning') noise.stop()
  }, [status, noise])

  const turnOff = useCallback(() => {
    tuneRef.current++
    player.stop()
    noise.stop(0)
    noise.burst()
    setStation(null)
    setStatus('off')
  }, [player, noise])

  const tune = useCallback(
    (next: Station | null) => {
      if (!next) return station ? turnOff() : undefined
      if (next.id === station?.id && status !== 'error') return

      player.unlock()
      player.setVolume(volume)
      player.halt()
      player.setStatus('tuning')
      noise.setVolume(volume)
      noise.start()
      setStation(next)
      setStatus('tuning')

      const token = ++tuneRef.current
      loadSchedule(next).then(
        (schedule) => {
          if (token === tuneRef.current) player.start(schedule)
        },
        () => {
          if (token === tuneRef.current) player.setStatus('error')
        },
      )
    },
    [station, status, volume, player, noise, turnOff],
  )

  const track = nowPlaying(station)
  const name = station?.name
  const artist = track?.artist
  const title = track?.title

  // Station artwork for the lock screen and media controls, rendered once per station.
  const [rendered, setRendered] = useState<{ id: string; images: MediaImage[] }>()
  const artwork = rendered && rendered.id === station?.id ? rendered.images : NO_ARTWORK
  useEffect(() => {
    if (!station) return
    let cancelled = false
    Promise.all(ARTWORK_SIZES.map((size) => stationArt(station, size, 'cover'))).then((urls) => {
      if (cancelled) return
      const images = urls.flatMap((src, i) =>
        src ? [{ src, sizes: `${ARTWORK_SIZES[i]}x${ARTWORK_SIZES[i]}`, type: 'image/png' }] : [],
      )
      setRendered({ id: station.id, images })
    })
    return () => {
      cancelled = true
    }
  }, [station])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = name
      ? new MediaMetadata({ title: title ?? name, artist: artist ?? '', album: name, artwork })
      : null
    navigator.mediaSession.setActionHandler('pause', name ? () => tune(null) : null)
    navigator.mediaSession.setActionHandler('stop', name ? () => tune(null) : null)
  }, [name, artist, title, artwork, tune])

  useEffect(() => {
    document.title = name && status === 'live' ? `▶ ${name}` : 'Los Santos Radio'
  }, [name, status])

  // The tab's icon is the station that's on.
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
    if (!link) return
    defaultIcon ??= { href: link.href, type: link.type }
    if (!station) {
      link.href = defaultIcon.href
      link.type = defaultIcon.type
      return
    }
    let cancelled = false
    stationArt(station, FAVICON_SIZE, 'icon').then((src) => {
      if (cancelled || !src) return
      link.type = 'image/png'
      link.href = src
    })
    return () => {
      cancelled = true
    }
  }, [station])

  return { station, status, volume, setVolume: setVolumeState, tune, player }
}
