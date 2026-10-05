import type { Person } from '../types'

const COLORS = ['#5b6cff', '#ff4d8d', '#12b886', '#f59f00', '#9b5de5', '#ff6b3d', '#0ea5e9', '#e64980']

/** Stable color per person, based on their position in the family list. */
function personColor(people: Person[], id: string): string {
  const i = people.findIndex((p) => p.id === id)
  return COLORS[(i < 0 ? 0 : i) % COLORS.length]
}

export function Avatar({ people, id, size = 18 }: { people: Person[]; id: string; size?: number }) {
  const person = people.find((p) => p.id === id)
  return (
    <span
      className="av"
      style={{ background: personColor(people, id), width: size, height: size, fontSize: Math.round(size * 0.55) }}
      title={person?.name}
      aria-label={person?.name}
    >
      {(person?.name ?? '?').slice(0, 1).toUpperCase()}
    </span>
  )
}

/** Everyone / one person filter, used on Home and Stats. */
export function PersonFilter({
  people,
  value,
  onChange,
}: {
  people: Person[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  if (people.length < 2) return null
  return (
    <div className="filter" role="radiogroup" aria-label="Whose shows">
      <button
        role="radio"
        aria-checked={value === null}
        className={`everyone ${value === null ? 'on' : ''}`}
        onClick={() => onChange(null)}
      >
        Everyone
      </button>
      {people.map((p) => (
        <button
          key={p.id}
          role="radio"
          aria-checked={value === p.id}
          className={value === p.id ? 'on' : ''}
          onClick={() => onChange(p.id)}
        >
          <Avatar people={people} id={p.id} size={24} /> {p.name}
        </button>
      ))}
    </div>
  )
}
