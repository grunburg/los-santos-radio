import { useCallback, useEffect, useState } from 'react'
import type { Station } from './stations'

const FAVORITES_KEY = 'gta5radio:favorites'

function loadFavorites(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]')
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** Favourite station ids, in the order they were added, kept in localStorage. */
export function useFavorites() {
  const [favorites, setFavorites] = useState(loadFavorites)

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
    } catch {
      // Favourites just won't be remembered.
    }
  }, [favorites])

  const toggleFavorite = useCallback(
    (id: string) => setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id])),
    [],
  )

  return { favorites, toggleFavorite }
}

/** Favourites first, in the order they were added, then everything else in station order. */
export function withFavoritesFirst(stations: Station[], favorites: string[]) {
  const byId = new Map(stations.map((s) => [s.id, s]))
  const first = favorites.flatMap((id) => byId.get(id) ?? [])
  return [...first, ...stations.filter((s) => !favorites.includes(s.id))]
}
