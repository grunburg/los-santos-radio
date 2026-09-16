/**
 * Station artwork rendered to PNG, for the favicon and the lock screen / media controls.
 *
 * - "icon": the round logo alone, on a transparent background, as in the deck.
 * - "cover": the logo on a square of the station's colour, like its card.
 *
 * Returned as data: URLs, which both `<link rel="icon">` and the Media Session API accept
 * everywhere, and cached per station and size.
 */
import { logoColor } from './logoColor'
import { LOGOS, PLATE_COLORS, PLATES, loadImage } from './logos'
import type { Station } from './stations'

export type ArtKind = 'icon' | 'cover'

const cache = new Map<string, Promise<string | null>>()

export function stationArt(station: Station, size: number, kind: ArtKind) {
  const key = `${station.id}:${kind}:${size}`
  let promise = cache.get(key)
  if (!promise) {
    promise = render(station, size, kind).catch(() => null)
    cache.set(key, promise)
  }
  return promise
}

/** Parses the `rgb(r g b)` strings that logoColor() produces. */
function channels(color: string) {
  const [r, g, b] = color.match(/\d+/g)!.map(Number)
  return [r, g, b] as const
}

function shade(color: string, factor: number) {
  const [r, g, b] = channels(color).map((c) => Math.round(Math.min(255, c * factor)))
  return `rgb(${r} ${g} ${b})`
}

async function render(station: Station, size: number, kind: ArtKind): Promise<string | null> {
  const logoUrl = LOGOS[station.id]
  if (!logoUrl) return null
  const [logo, accent] = await Promise.all([loadImage(logoUrl), logoColor(logoUrl)])

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // The disc the logo sits in, and its padding for logos that need a plate.
  let disc = size
  if (kind === 'cover') {
    const base = accent ?? 'rgb(120 128 150)'
    const gradient = ctx.createLinearGradient(0, 0, size, size)
    gradient.addColorStop(0, shade(base, 1.15))
    gradient.addColorStop(1, shade(base, 0.45))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    disc = size * 0.68
  }
  const plate = PLATES[station.id]
  const inset = (size - disc) / 2

  if (plate) {
    ctx.fillStyle = PLATE_COLORS[plate]
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, disc / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  // Fit the logo inside the disc, keeping its aspect ratio.
  const box = plate ? disc * 0.76 : disc
  const scale = Math.min(box / logo.width, box / logo.height)
  const w = logo.width * scale
  const h = logo.height * scale
  ctx.drawImage(logo, inset + (disc - w) / 2, inset + (disc - h) / 2, w, h)

  return canvas.toDataURL('image/png')
}
