import { t } from '../i18n'

interface StarsProps {
  value: number | null
  onChange: (v: number | null) => void
  label: string
}

/** Tap a star to rate. Tap the same star again to clear. */
export function Stars({ value, onChange, label }: StarsProps) {
  return (
    <div className="stars" role="radiogroup" aria-label={label === 'Your' ? t('Your rating') : t('{name} rating', { name: label })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={n > 1 ? t('{n} stars', { n }) : t('{n} star', { n })}
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
    <span className="avg-stars" style={{ fontSize: size }} role="img" aria-label={t('{n} out of 5', { n: value.toFixed(1) })}>
      ★★★★★
      <span style={{ width: `${(value / 5) * 100}%` }} aria-hidden="true">
        ★★★★★
      </span>
    </span>
  )
}
