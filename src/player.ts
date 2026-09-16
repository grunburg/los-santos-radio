/**
 * Plays a station's schedule from the clock: two music decks (the current item and the next,
 * preloaded) and a voice track for DJ lines laid over songs.
 */
import { now } from './clock'
import { itemKey, locate, voiceLines, type Item, type StationSchedule } from './schedule'
import { fileUrl } from './stations'

export type PlayerStatus = 'off' | 'tuning' | 'live' | 'error'

const CONNECT_TIMEOUT_S = 15
/** Start loading the next item this long before it plays. */
const PRELOAD_S = 20
/** Resync when playback wanders this far from the schedule. */
const DRIFT_S = 1
/** Offsets smaller than this aren't worth a seek. */
const SEEK_MIN_S = 0.3
const TICK_MS = 250

/** A moment of silence, played from a click so mobile browsers let each element play later. */
const SILENCE = (() => {
  const samples = 800
  const view = new DataView(new ArrayBuffer(44 + samples))
  const text = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 8000, true)
  view.setUint32(28, 8000, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  text(36, 'data')
  view.setUint32(40, samples, true)
  for (let i = 0; i < samples; i++) view.setUint8(44 + i, 128)
  return URL.createObjectURL(new Blob([view], { type: 'audio/wav' }))
})()

function release(element: HTMLMediaElement) {
  element.pause()
  if (element.getAttribute('src')) {
    element.removeAttribute('src')
    element.load()
  }
}

/** Seeks once the element knows its duration, to where `position()` says it should be then. */
function seekOnLoad(element: HTMLMediaElement, position: () => number) {
  const src = element.src
  const seek = () => {
    if (element.src === src) element.currentTime = Math.max(0, position())
  }
  if (element.readyState >= 1) seek()
  else element.addEventListener('loadedmetadata', seek, { once: true })
}

export class Player {
  station: StationSchedule | null = null
  status: PlayerStatus = 'off'
  current: Item | null = null

  private decks = [new Audio(), new Audio()]
  private voice = new Audio()
  private active = 0
  private currentKey: string | null = null
  private preparedKey: string | null = null
  private voiceKey: string | null = null
  private voiceSrc: string | null = null
  private needsAlign = false
  private failures = 0
  private holdUntil = 0
  private connectDeadline = 0
  private interval: number | undefined
  private edgeTimer: number | undefined
  private unlocked = false
  private onChange: () => void

  constructor(onChange: () => void) {
    this.onChange = onChange
    for (const deck of this.decks) {
      deck.preload = 'auto'
      deck.addEventListener('playing', () => {
        if (deck !== this.deck || !this.current) return
        if (this.needsAlign) {
          // Loading took a moment; catch up with the schedule.
          this.needsAlign = false
          const position = now() - this.current.start
          if (Math.abs(deck.currentTime - position) > SEEK_MIN_S) deck.currentTime = position
        }
        this.failures = 0
        this.connectDeadline = 0
        this.setStatus('live')
      })
      deck.addEventListener('waiting', () => {
        if (deck === this.deck && this.current) this.setStatus('tuning')
      })
      deck.addEventListener('error', () => {
        if (!deck.getAttribute('src')) return
        if (deck === this.deck && this.current) this.failed()
        else this.preparedKey = null
      })
    }
    this.voice.preload = 'auto'
  }

  private get deck() {
    return this.decks[this.active]
  }

  private get spare() {
    return this.decks[1 - this.active]
  }

  /** Playback position of the current item, for the debug panel. */
  get deckTime() {
    return this.deck.currentTime
  }

  get preloaded() {
    return this.preparedKey !== null
  }

  /** Call from a click or key press, before anything async. */
  unlock() {
    if (this.unlocked) return
    this.unlocked = true
    for (const element of [...this.decks, this.voice]) {
      element.src = SILENCE
      element.play().catch(() => {})
    }
  }

  setVolume(volume: number) {
    for (const element of [...this.decks, this.voice]) element.volume = volume
  }

  start(station: StationSchedule) {
    this.halt()
    this.station = station
    this.connectDeadline = now() + CONNECT_TIMEOUT_S
    this.setStatus('tuning')
    this.interval = window.setInterval(() => this.tick(), TICK_MS)
    this.tick()
  }

  stop() {
    this.halt()
    this.setStatus('off')
  }

  /** Stops playback without reporting it. */
  halt() {
    window.clearInterval(this.interval)
    window.clearTimeout(this.edgeTimer)
    for (const element of [...this.decks, this.voice]) release(element)
    this.station = null
    this.current = null
    this.currentKey = null
    this.preparedKey = null
    this.voiceKey = null
    this.voiceSrc = null
    this.failures = 0
    this.holdUntil = 0
    this.connectDeadline = 0
  }

  /** After the clock jumps: forget the DJ line in progress so the right one plays. */
  resync() {
    release(this.voice)
    this.voiceKey = null
    this.voiceSrc = null
    if (this.station) this.tick()
  }

  setStatus(status: PlayerStatus) {
    if (this.status === status) return
    this.status = status
    this.onChange()
  }

  private failed() {
    this.failures++
    if (this.failures >= 3) {
      this.stop()
      this.setStatus('error')
      return
    }
    // Try the same moment of the schedule again shortly.
    release(this.deck)
    this.currentKey = null
    this.holdUntil = now() + 1.5
    this.setStatus('tuning')
  }

  private tick() {
    window.clearTimeout(this.edgeTimer)
    const station = this.station
    if (!station) return
    const t = now()

    if (this.connectDeadline && t > this.connectDeadline) {
      this.stop()
      this.setStatus('error')
      return
    }

    const { current, next } = locate(station, t)
    if (itemKey(current) !== this.currentKey && t >= this.holdUntil) this.enter(current, t)

    let edge = (current ? current.start + current.length : (next?.start ?? Infinity)) - t
    if (current && this.current === current) {
      const position = t - current.start
      const deck = this.deck
      if (
        !this.needsAlign &&
        !deck.paused &&
        !deck.seeking &&
        deck.readyState >= 3 &&
        Math.abs(deck.currentTime - position) > DRIFT_S
      ) {
        deck.currentTime = position
      }
      edge = Math.min(edge, this.speak(current, position))
    }
    if (!current) this.setStatus('live')

    if (next && next.start - t < PRELOAD_S && this.preparedKey !== itemKey(next)) {
      this.spare.src = fileUrl(next.file)
      this.spare.load()
      this.preparedKey = itemKey(next)
    }

    // Timers are coarse; land exactly on the next change.
    if (edge < (TICK_MS / 1000) * 1.5) {
      this.edgeTimer = window.setTimeout(() => this.tick(), Math.max(0, edge * 1000))
    }
    this.onChange()
  }

  /** Starts playing an item (or silence) from wherever the schedule is now. */
  private enter(item: Item | null, t: number) {
    this.current = item
    this.currentKey = itemKey(item)
    release(this.voice)
    this.voiceKey = null
    this.voiceSrc = null

    if (!item) {
      release(this.deck)
      return
    }

    const offset = t - item.start
    if (this.preparedKey === this.currentKey && offset < 2) {
      release(this.deck)
      this.active = 1 - this.active
      if (offset > SEEK_MIN_S) this.deck.currentTime = offset
    } else {
      release(this.deck)
      this.deck.src = fileUrl(item.file)
      if (offset > SEEK_MIN_S) seekOnLoad(this.deck, () => now() - item.start)
    }
    this.preparedKey = null
    this.needsAlign = true
    this.play(this.deck, true)
  }

  /** Plays the DJ line due at this position. Returns seconds until the next line starts. */
  private speak(item: Item, position: number) {
    const lines = voiceLines(this.station!, item)
    const due = lines.find((l) => position >= l.at && position < l.at + l.clip.length)
    const upcoming = lines.find((l) => l.at > position)

    const voice = this.voice
    if (due) {
      const key = `${this.currentKey}|${due.at}`
      if (key !== this.voiceKey) {
        this.voiceKey = key
        const src = fileUrl(due.clip.file)
        if (this.voiceSrc !== src) {
          voice.src = src
          this.voiceSrc = src
        }
        if (position - due.at > SEEK_MIN_S) seekOnLoad(voice, () => now() - item.start - due.at)
        this.play(voice, false)
      }
    } else if (upcoming && upcoming.at - position < 5 && this.voiceSrc !== fileUrl(upcoming.clip.file)) {
      this.voiceSrc = fileUrl(upcoming.clip.file)
      voice.src = this.voiceSrc
      voice.load()
    }
    return upcoming ? upcoming.at - position : Infinity
  }

  private play(element: HTMLMediaElement, music: boolean) {
    element.play().catch((error: unknown) => {
      // Load failures arrive through the 'error' event; only a blocked autoplay ends here.
      if (music && error instanceof DOMException && error.name === 'NotAllowedError') {
        this.stop()
        this.setStatus('error')
      }
    })
  }
}
