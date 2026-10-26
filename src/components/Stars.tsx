import { t } from '../i18n'
import { MAX_SCORE } from '../logic'

interface StarsProps {
  value: number | null
  onChange: (v: number | null) => void
  label: string
}

const SCALE = Array.from({ length: MAX_SCORE }, (_, i) => i + 1)

/** Tap a star to rate out of 10, like IMDb. Tap the same star again to clear. */
export function Stars({ value, onChange, label }: StarsProps) {
  return (
    <div className="stars-wrap">
      <div className="stars" role="radiogroup" aria-label={label === 'Your' ? t('Your rating') : t('{name} rating', { name: label })}>
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t('{n} out of 10', { n })}
            className={value != null && n <= value ? 'on' : ''}
            onClick={() => onChange(value === n ? null : n)}
          >
            ★
          </button>
        ))}
      </div>
      <span className={`stars-num ${value == null ? 'empty' : ''}`} aria-hidden="true">
        {value ?? '–'}
        <small>/10</small>
      </span>
    </div>
  )
}

/** Read-only score out of 10: a gold star and the number (8.5/10). */
export function AvgStars({ value, size = 22 }: { value: number; size?: number }) {
  return (
    <span className="avg-stars" style={{ fontSize: size }} role="img" aria-label={t('{n} out of 10', { n: value.toFixed(1) })}>
      <span className="avg-star" aria-hidden="true">★</span>
      <b>{value.toFixed(1)}</b>
      <small>/10</small>
    </span>
  )
}
