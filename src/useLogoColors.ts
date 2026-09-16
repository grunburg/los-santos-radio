import { useEffect, useState } from 'react'
import { logoColor } from './logoColor'
import { LOGOS } from './logos'
import type { Station } from './stations'

/** Used until a logo's colour has been read, and for stations without a logo. */
export const FALLBACK_ACCENT = 'rgb(120 128 150)'

/** Each station's accent colour, filled in as its logo is read. */
export function useLogoColors(stations: Station[]) {
  const [colors, setColors] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    stations.forEach((station) => {
      const logo = LOGOS[station.id]
      if (!logo) return
      logoColor(logo).then((color) => {
        if (color && !cancelled) setColors((prev) => ({ ...prev, [station.id]: color }))
      })
    })
    return () => {
      cancelled = true
    }
  }, [stations])

  return colors
}
