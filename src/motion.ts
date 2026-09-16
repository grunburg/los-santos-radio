/** Shared Motion transitions. */
import type { Transition } from 'motion/react'

/** Station text and artwork crossfading in place as the station changes. */
export const FADE: Transition = { duration: 0.35, ease: 'easeInOut' }

/** The view switcher's highlight sliding to the chosen option. */
export const SLIDE: Transition = { type: 'spring', stiffness: 520, damping: 40 }
