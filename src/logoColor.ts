/**
 * Picks an accent colour out of a station logo.
 *
 * The logo is drawn on a small canvas and its pixels are sorted into hue buckets, weighted by
 * how vivid they are. The strongest hue wins and its pixels are averaged. Logos with no
 * colour to speak of (black and white artwork) fall back to their average midtone, so every
 * station gets something usable.
 */

import { loadImage } from './logos'

const SAMPLE = 48
const HUE_BUCKETS = 18

const cache = new Map<string, Promise<string | null>>()

/** The logo's accent colour as a CSS `rgb()` string, or null if it couldn't be read. Cached. */
export function logoColor(url: string) {
  let promise = cache.get(url)
  if (!promise) {
    promise = extract(url).catch(() => null)
    cache.set(url, promise)
  }
  return promise
}

interface Sum {
  weight: number
  r: number
  g: number
  b: number
}

const sum = (): Sum => ({ weight: 0, r: 0, g: 0, b: 0 })

function add(into: Sum, weight: number, r: number, g: number, b: number) {
  into.weight += weight
  into.r += r * weight
  into.g += g * weight
  into.b += b * weight
}

function toCss({ weight, r, g, b }: Sum) {
  return `rgb(${Math.round(r / weight)} ${Math.round(g / weight)} ${Math.round(b / weight)})`
}

async function extract(url: string): Promise<string | null> {
  const img = await loadImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE
  canvas.height = SAMPLE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE)
  const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE)

  const buckets = Array.from({ length: HUE_BUCKETS }, sum)
  const midtones = sum()

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255
    if (alpha < 0.5) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const lightness = (max + min) / 510
    if (lightness < 0.08 || lightness > 0.94) continue
    const chroma = (max - min) / 255
    const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1))

    add(midtones, alpha, r, g, b)
    if (saturation < 0.28) continue

    let hue =
      max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4
    hue = ((hue * 60 + 360) % 360) / 360
    // Vivid midtones count for the most.
    const weight = alpha * saturation * (1 - Math.abs(lightness - 0.5))
    add(buckets[Math.floor(hue * HUE_BUCKETS)], weight, r, g, b)
  }

  const best = buckets.reduce((a, b) => (b.weight > a.weight ? b : a))
  if (best.weight > 0) return toCss(best)
  if (midtones.weight > 0) return toCss(midtones)
  return null
}

/** The page's ground, as rgb channels; see --ground in index.css. */
const GROUND = [20, 20, 24] as const

/**
 * The colour for the browser's own bars (theme-color): the accent sunk into the ground, close to
 * the glow at the page's edges. iPhone Safari paints its bars with this rather than with the page
 * behind them, so without it they'd stay black.
 */
export function barColor(accent: string) {
  const channels = accent.match(/\d+/g)?.map(Number)
  if (channels?.length !== 3) return `rgb(${GROUND.join(' ')})`
  const mixed = channels.map((c, i) => Math.round(c * 0.45 + GROUND[i] * 0.55))
  return `rgb(${mixed.join(' ')})`
}
