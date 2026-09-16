import { useLayoutEffect, useRef } from 'react'

/** Speed of the scroll, in pixels per second. */
const SPEED = 36

/** A single line of text that scrolls sideways, like a ticker, only when it doesn't fit. */
export function Marquee({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const width = el.firstElementChild?.scrollWidth ?? 0
      const scrolling = width > el.clientWidth
      el.classList.toggle('marquee--scrolling', scrolling)
      el.style.setProperty('--duration', `${(width / SPEED).toFixed(2)}s`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text])

  return (
    <span ref={ref} className={`marquee ${className}`.trim()}>
      <span className="marquee__text">{text}</span>
      <span className="marquee__text" aria-hidden="true">
        {text}
      </span>
    </span>
  )
}
