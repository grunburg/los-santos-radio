import type { RadioStatus } from '../useRadio'

const LABELS: Record<RadioStatus, string> = {
  off: '',
  tuning: 'Tuning',
  live: 'Live',
  error: 'Offline',
}

/** The small "Live" badge on the station that's on. */
export function StatusPill({ status, className = '' }: { status: RadioStatus; className?: string }) {
  if (status === 'off') return null
  return (
    <span className={`pill pill--${status} ${className}`.trim()}>
      <span className="pill__dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  )
}
