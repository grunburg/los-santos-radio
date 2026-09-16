/**
 * The broadcast schedule, worked out from the clock alone.
 *
 * There is no server: every device builds the same timeline from the same station files and
 * the same seeds, so tuning in at a given moment plays the same thing everywhere, like the
 * Liquidsoap/Icecast server did.
 *
 * - "static" stations (e.g. Blonded) loop their pre-mixed parts, counted from the Unix epoch.
 * - Other stations (music and talk shows) are planned one UTC day at a time, seeded by station
 *   and day: songs in shuffled order, DJ lines over intros, and ads, news, station IDs or
 *   monologues between songs. The end of the day is filled with short programmes so nothing is
 *   cut off at midnight.
 *
 * File paths are relative to the station files' root; times are in seconds.
 */

export const DAY = 86400

/** How game-style stations are put together, as on the server (probabilities, 0.0 - 1.0). */
const RULES = {
  /** Chance of a DJ line over a song's intro. */
  djIntroChance: 0.6,
  /** Chance that the line is one recorded for that song rather than a general one. */
  djSongIntroShare: 0.7,
  /** Chances of what follows a song, if the station has it; otherwise the next song starts. */
  adsChance: 0.2,
  newsChance: 0.1,
  idChance: 0.25,
  monologueChance: 0.1,
  /** Number of ads in an ad break. */
  adsPerBreak: 2,
}

/* station.json and radio.json, as far as the schedule reads them. */

interface FileEntry {
  path: string
  duration: number
  audibleDuration?: number
  markers?: {
    track?: { offset: number; title?: string | null; artist?: string | null }[]
    dj?: { offset: number; value: string }[]
  }
  attachments?: { intro?: FileEntry[] }
}

export interface StationJson {
  id: string
  type?: string
  info: { title: string; dj?: string }
  common?: { adverts?: string[] }
  fileGroups: { track: FileEntry[] } & Partial<Record<string, FileEntry[]>>
}

export interface RadioJson {
  common?: Record<string, FileEntry[]>
}

/* What the schedule is made of. */

export interface Track {
  artist: string
  title: string
}

interface Marker extends Track {
  at: number
}

export interface Clip {
  file: string
  length: number
  markers: Marker[]
}

export interface Song extends Clip {
  introStart: number
  introEnd: number
  outroStart: number
  outroEnd: number
  intros: Clip[]
}

export interface VoiceLine {
  /** Position in the item, in seconds. */
  at: number
  clip: Clip
}

/** Something on air: a clip with a start time (Unix seconds). Songs keep their DJ windows. */
export interface Item extends Clip, Partial<Omit<Song, keyof Clip>> {
  start: number
  /** Lead-out lines planned with the day. */
  voice?: VoiceLine[]
  /** Songs choose their intro line at play time (it depends on the local hour). */
  introSeed?: string
  /** Resolved lines, cached by `voiceLines`. */
  lines?: VoiceLine[]
}

export interface StationSchedule {
  id: string
  name: string
  static: boolean
  /** Shown when nothing else is: the DJ and station. */
  fallback: Track
  songs: Song[]
  ads: Clip[]
  news: Clip[]
  ids: Clip[]
  monologues: Clip[]
  general: Clip[]
  morning: Clip[]
  evening: Clip[]
  toAds: Clip[]
  toNews: Clip[]
}

/** Deterministic random numbers in [0, 1) for a string key (xmur3 hash + mulberry32). */
function seeded(key: string) {
  let h = 1779033703 ^ key.length
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  let a = (h ^ (h >>> 16)) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rand = () => number

function pick<T>(items: T[], rand: Rand): T {
  return items[Math.floor(rand() * items.length)]
}

/** Items in shuffled order, reshuffled once all have been used, so nothing repeats early. */
function shuffled<T>(items: T[], rand: Rand) {
  let left: T[] = []
  const refill = () => {
    if (left.length) return
    left = [...items]
    for (let i = left.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[left[i], left[j]] = [left[j], left[i]]
    }
  }
  return {
    peek: () => (refill(), left[0]),
    take: () => (refill(), left.shift()!),
  }
}

/** Reads a station.json (and the shared ads and news in radio.json) into what to play. */
export function parseStation(game: StationJson, radio: RadioJson, name: string): StationSchedule {
  const info = game.info
  const dir = `${game.id}/`
  const groups = game.fileGroups
  const common = radio.common ?? {}
  const fallback: Track = { artist: info.dj ?? name, title: info.title }

  // Markers without a title show their artist as the title (e.g. talk show names).
  const markersOf = (entry: FileEntry): Marker[] =>
    (entry.markers?.track ?? [])
      .map((m) => ({
        at: m.offset / 1000,
        ...(m.title
          ? { artist: m.artist ?? '', title: m.title }
          : m.artist
            ? { artist: info.title, title: m.artist }
            : fallback),
      }))
      .sort((a, b) => a.at - b.at)

  const clips = (base: string, entries: FileEntry[] = []): Clip[] =>
    entries.map((entry) => ({
      file: base + entry.path,
      length: entry.audibleDuration ?? entry.duration,
      markers: markersOf(entry),
    }))

  const djAt = (entry: FileEntry, value: string) => {
    const marker = entry.markers?.dj?.find((m) => m.value === value)
    return marker ? marker.offset / 1000 : -1
  }

  return {
    id: game.id,
    name,
    static: game.type === 'static',
    fallback,
    songs: groups.track.map((entry) => ({
      ...clips(dir, [entry])[0],
      introStart: djAt(entry, 'intro_start'),
      introEnd: djAt(entry, 'intro_end'),
      outroStart: djAt(entry, 'outro_start'),
      outroEnd: djAt(entry, 'outro_end'),
      intros: clips(dir, entry.attachments?.intro),
    })),
    ads: [
      ...clips(dir, groups.adverts),
      ...(game.common?.adverts ?? []).flatMap((group) => clips('', common[group])),
    ],
    news: clips('', common.news),
    ids: clips(dir, groups.id),
    monologues: clips(dir, groups.mono_solo),
    general: clips(dir, groups.general),
    morning: clips(dir, groups.time_morning),
    evening: clips(dir, groups.time_evening),
    toAds: clips(dir, groups.to_adverts),
    toNews: clips(dir, groups.to_news),
  }
}

/** Pre-mixed parts looped end to end since the epoch. Items may start the day before. */
function loopDay(st: StationSchedule, day: number): Item[] {
  const starts: number[] = []
  let total = 0
  for (const part of st.songs) {
    starts.push(total)
    total += part.length
  }
  const from = day * DAY
  const to = from + DAY
  const items: Item[] = []
  for (let loop = Math.floor(from / total); loop * total < to; loop++) {
    st.songs.forEach((part, i) => {
      // Always computed the same way, so the same item has the same start whichever day asks.
      const start = loop * total + starts[i]
      if (start < to && start + part.length > from) items.push({ ...part, start })
    })
  }
  return items
}

/** What follows a song: 'ads', 'news', 'id', 'monologue' or '' (next song right away). */
function planBreak(st: StationSchedule, rand: Rand) {
  const roll = rand()
  const choices: [boolean, number, string][] = [
    [st.ads.length > 0, RULES.adsChance, 'ads'],
    [st.news.length > 0 && st.toNews.length > 0, RULES.newsChance, 'news'],
    [st.ids.length > 0, RULES.idChance, 'id'],
    [st.monologues.length > 0, RULES.monologueChance, 'monologue'],
  ]
  let total = 0
  for (const [available, chance, kind] of choices) {
    if (!available) continue
    total += chance
    if (roll < total) return kind
  }
  return ''
}

/** A game-style day: songs with breaks, then short programmes up to midnight. */
function programmeDay(st: StationSchedule, day: number): Item[] {
  const rand = seeded(`${st.id}|${day}`)
  const next = {
    song: shuffled(st.songs, rand),
    ad: shuffled(st.ads, rand),
    news: shuffled(st.news, rand),
    id: shuffled(st.ids, rand),
    monologue: shuffled(st.monologues, rand),
  }
  const end = (day + 1) * DAY
  let t = day * DAY
  const items: Item[] = []
  const push = (clip: Clip, extra?: Partial<Item>) => {
    items.push({ ...clip, start: t, voice: [], ...extra })
    t += clip.length
  }

  for (;;) {
    const song = next.song.peek()
    const kind = planBreak(st, rand)
    const programmes =
      kind === 'ads'
        ? Array.from({ length: Math.min(RULES.adsPerBreak, st.ads.length) }, () => next.ad.take())
        : kind === 'news'
          ? [next.news.take()]
          : kind === 'id'
            ? [next.id.take()]
            : kind === 'monologue'
              ? [next.monologue.take()]
              : []
    const length = programmes.reduce((sum, p) => sum + p.length, song.length)
    if (t + length > end) break
    next.song.take()

    // The DJ leads into ads or news over the end of the song.
    const leadIns = kind === 'ads' ? st.toAds : kind === 'news' ? st.toNews : []
    const fitting = leadIns.filter((line) => line.length <= song.outroEnd - song.outroStart)
    const voice: VoiceLine[] =
      song.outroStart >= 0 && fitting.length ? [{ at: song.outroStart, clip: pick(fitting, rand) }] : []

    push(song, { voice, introSeed: `${st.id}|${day}|${items.length}|intro` })
    programmes.forEach((p) => push(p))
  }

  const fillers = [...st.ads, ...st.ids, ...st.monologues]
  for (;;) {
    const fitting = fillers.filter((clip) => t + clip.length <= end)
    if (!fitting.length) break
    push(pick(fitting, rand))
  }
  return items
}

const days = new Map<string, Item[]>()

/** Everything on air on a UTC day (day = Unix seconds / 86400), in order. */
export function dayItems(st: StationSchedule, day: number) {
  const key = `${st.id}|${day}`
  let items = days.get(key)
  if (!items) {
    items = st.static ? loopDay(st, day) : programmeDay(st, day)
    days.set(key, items)
    if (days.size > 100) days.delete(days.keys().next().value!)
  }
  return items
}

/** Identifies an item across lookups: the same broadcast has the same key. */
export const itemKey = (item: Item | null | undefined) => (item ? `${item.start}|${item.file}` : null)

/** What plays at time t (Unix seconds), if anything, and what starts next. */
export function locate(st: StationSchedule, t: number) {
  const day = Math.floor(t / DAY)
  const items = dayItems(st, day)
  let lo = 0
  let hi = items.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (items[mid].start <= t) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  const item = items[found] as Item | undefined
  const current = item && t < item.start + item.length ? item : null
  const next = items[found + 1] ?? dayItems(st, day + 1).find((i) => i.start > t) ?? null
  return { current, next }
}

/** DJ lines over an item: the intro (chosen for the local time of day) and any lead-out. */
export function voiceLines(st: StationSchedule, item: Item): VoiceLine[] {
  if (item.lines) return item.lines
  const lines = [...(item.voice ?? [])]
  const introStart = item.introStart ?? -1
  const introEnd = item.introEnd ?? -1
  const window = introEnd - introStart
  if (item.introSeed && introStart >= 0 && window > 0) {
    const rand = seeded(item.introSeed)
    if (rand() < RULES.djIntroChance) {
      const hour = new Date(item.start * 1000).getHours()
      const timeLines = hour >= 5 && hour < 12 ? st.morning : hour >= 17 ? st.evening : []
      const fits = (clip: Clip) => clip.length <= window
      const own = (item.intros ?? []).filter(fits)
      const other = [...st.general, ...timeLines].filter(fits)
      const pool = own.length && (!other.length || rand() < RULES.djSongIntroShare) ? own : other
      if (pool.length) {
        const line = pick(pool, rand)
        lines.unshift({ at: Math.max(introStart, introEnd - line.length), clip: line })
      }
    }
  }
  return (item.lines = lines)
}

/** Artist and title at a position in an item. */
export function trackAt(st: StationSchedule, item: Item, position: number): Track {
  let track = st.fallback
  for (const marker of item.markers) {
    if (marker.at > position) break
    track = marker
  }
  return track
}
