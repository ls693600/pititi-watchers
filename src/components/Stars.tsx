interface StarsProps {
  value: number | null
  onChange: (v: number | null) => void
  label: string
}

/** Tap a star to rate. Tap the same star again to clear. */
export function Stars({ value, onChange, label }: StarsProps) {
  return (
    <div className="stars" role="radiogroup" aria-label={`${label} rating`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={value != null && n <= value ? 'on' : ''}
          onClick={() => onChange(value === n ? null : n)}
        >
          ★
        </button>
      ))}
    </div>
  )
}

/** Read-only stars that can show partial fill (4.5 → four and a half). */
export function AvgStars({ value, size = 22 }: { value: number; size?: number }) {
  return (
    <span className="avg-stars" style={{ fontSize: size }} role="img" aria-label={`${value.toFixed(1)} out of 5`}>
      ★★★★★
      <span style={{ width: `${(value / 5) * 100}%` }} aria-hidden="true">
        ★★★★★
      </span>
    </span>
  )
}
