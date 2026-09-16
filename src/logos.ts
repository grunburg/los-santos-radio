/** Logos are picked up by filename: src/assets/logos/<station-id>.svg */
export const LOGOS: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('./assets/logos/*.svg', { eager: true, query: '?url', import: 'default' }),
  ).map(([path, url]) => [path.split('/').pop()!.replace(/\.svg$/, ''), url]),
)

/**
 * Logos that aren't a filled circle sit on a disc. Dark artwork needs the light disc to stay visible.
 * Stations not listed here have round logos that fill the badge on their own.
 */
export const PLATES: Record<string, 'dark' | 'light'> = {
  radio_01_class_rock: 'light',
  radio_02_pop: 'dark',
  radio_04_punk: 'dark',
  radio_05_talk_01: 'dark',
  radio_06_country: 'dark',
  radio_07_dance_01: 'dark',
  radio_09_hiphop_old: 'dark',
  radio_11_talk_02: 'dark',
  radio_13_jazz: 'light',
  radio_14_dance_02: 'dark',
  radio_16_silverlake: 'dark',
}

export const PLATE_COLORS = { dark: '#1b1b1f', light: '#f2eee6' }

/** Loads an image so it can be drawn on a canvas. */
export function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Couldn't load ${url}`))
    img.src = url
  })
}
