import { useState } from 'react'
import { t } from '../i18n'
import { newId, predictionOpen, predictionScores } from '../logic'
import type { Guess, Person, Prediction, Watch } from '../types'
import { Avatar } from './Avatar'
import { Icon } from './Icon'

interface Props {
  /** This household's log of the show (its latest season) */
  log: Watch
  /** The household's logs, to know what's open */
  watches: Watch[]
  /** This household's predictions and the guesses you're allowed to see */
  predictions: Prediction[]
  guesses: Guess[]
  /** The household's people (who can guess) */
  people: Person[]
  me: string | null
  isAdmin: boolean
  /** Episodes in the season, when known (for "opens at") */
  totalEpisodes: number | null
  onAdd: (p: Omit<Prediction, 'createdBy' | 'createdAt'>, guess: string) => Promise<boolean>
  onGuess: (predictionId: string, text: string) => Promise<boolean>
  onJudge: (predictionId: string, personId: string, verdict: Guess['verdict']) => void
  onRemove: (p: Prediction) => void
}

/** On a show's page: sealed guesses that open with an episode, then right or wrong, and the household's score. */
export function Predictions({ log, watches, predictions, guesses, people, me, isAdmin, totalEpisodes, onAdd, onGuess, onJudge, onRemove }: Props) {
  const [adding, setAdding] = useState(false)
  const mine = predictions.filter((p) => p.showId === log.showId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const nameOf = (id: string) => (id === me ? t('You') : (people.find((p) => p.id === id)?.name ?? t('Someone')))
  const scores = predictionScores(guesses, people.map((p) => p.id))
  const next = log.status === 'done' ? null : log.episodesWatched + 1
  const canAdd = me != null && next != null && (totalEpisodes == null || next <= totalEpisodes)

  return (
    <section className="card pad predict" aria-labelledby="predict-title">
      <div className="eps-head">
        <b id="predict-title">
          <span aria-hidden="true">🔮</span> {t('Predictions')}
        </b>
        <span className="muted">{t('Only your household')}</span>
      </div>

      {scores.length > 0 && (
        <p className="predict-score" aria-label={t('Score')}>
          {scores.map((s) => `${nameOf(s.personId)} ${s.right}/${s.judged}`).join(' · ')}
        </p>
      )}

      {mine.length === 0 && !adding && <p className="muted predict-empty">{t('Guess what happens next. Your guesses stay sealed until you log the episode.')}</p>}

      <ul className="predict-list">
        {mine.map((p) => (
          <PredictionRow
            key={p.id}
            p={p}
            open={predictionOpen(p, watches)}
            guesses={guesses.filter((g) => g.predictionId === p.id)}
            people={people}
            me={me}
            nameOf={nameOf}
            canRemove={p.createdBy === me || isAdmin}
            onGuess={onGuess}
            onJudge={onJudge}
            onRemove={() => onRemove(p)}
          />
        ))}
      </ul>

      {adding && next != null ? (
        <NewPrediction
          season={log.season}
          from={next}
          to={totalEpisodes}
          onCancel={() => setAdding(false)}
          onSave={async (episode, question, guess) => {
            if (await onAdd({ id: newId(), householdId: log.householdId ?? null, showId: log.showId, season: log.season, episode, question }, guess)) setAdding(false)
          }}
        />
      ) : (
        canAdd && (
          <button type="button" className="btn ghost block" onClick={() => setAdding(true)}>
            <Icon name="plus" size={18} stroke={2.4} /> {t('New prediction')}
          </button>
        )
      )}
    </section>
  )
}

function PredictionRow({ p, open, guesses, people, me, nameOf, canRemove, onGuess, onJudge, onRemove }: {
  p: Prediction
  open: boolean
  guesses: Guess[]
  people: Person[]
  me: string | null
  nameOf: (id: string) => string
  canRemove: boolean
  onGuess: (predictionId: string, text: string) => Promise<boolean>
  onJudge: (predictionId: string, personId: string, verdict: Guess['verdict']) => void
  onRemove: () => void
}) {
  const own = guesses.find((g) => g.personId === me)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(own?.guess ?? '')
  const [confirm, setConfirm] = useState(false)
  // Before the reveal the server hides the others' guesses; in single-phone mode we hide them here too
  const visible = open ? guesses : guesses.filter((g) => g.personId === me)

  return (
    <li className={`predict-item ${open ? 'open' : 'sealed'}`}>
      <div className="predict-q">
        <b>{p.question || t('What happens next?')}</b>
        <span className={`predict-tag ${open ? 'open' : ''}`}>{open ? t('Opened at E{n}', { n: p.episode }) : t('🔒 Opens at S{s} E{n}', { s: p.season, n: p.episode })}</span>
      </div>

      {!open && (
        <>
          {own && !editing ? (
            <p className="predict-own">
              <span className="muted">{t('Your guess:')}</span> “{own.guess}”{' '}
              <button type="button" className="link-btn" onClick={() => (setText(own.guess), setEditing(true))}>
                {t('Change')}
              </button>
            </p>
          ) : (
            me && (
              <form
                className="predict-form"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (text.trim() && (await onGuess(p.id, text))) setEditing(false)
                }}
              >
                <input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder={t('Your guess')} aria-label={t('Your guess')} />
                <button type="submit" className="btn sm primary" disabled={!text.trim()}>
                  {t('Seal it')}
                </button>
              </form>
            )
          )}
          <p className="muted predict-who">{t('Sealed guesses open when you log episode {n}.', { n: p.episode })}</p>
        </>
      )}

      {open && (
        <ul className="predict-guesses">
          {visible.length === 0 && <li className="muted">{t('Nobody guessed this one.')}</li>}
          {visible.map((g) => (
            <li key={g.personId}>
              <Avatar people={people} id={g.personId} size={26} />
              <span className="predict-guess">
                <b>{nameOf(g.personId)}</b> “{g.guess}”
              </span>
              <span className="predict-verdict" role="group" aria-label={g.personId === me ? t('Your guess') : t("{name}'s guess", { name: nameOf(g.personId) })}>
                <button type="button" className={g.verdict === 'right' ? 'on right' : ''} aria-pressed={g.verdict === 'right'} onClick={() => onJudge(p.id, g.personId, 'right')}>
                  ✓ {t('Nailed it')}
                </button>
                <button type="button" className={g.verdict === 'wrong' ? 'on wrong' : ''} aria-pressed={g.verdict === 'wrong'} onClick={() => onJudge(p.id, g.personId, 'wrong')}>
                  ✗ {t('Nope')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {canRemove && (
        <button type="button" className={`predict-remove link-btn ${confirm ? 'danger' : ''}`} onClick={() => (confirm ? onRemove() : setConfirm(true))}>
          {confirm ? t('Tap again to remove') : t('Remove')}
        </button>
      )}
    </li>
  )
}

function NewPrediction({ season, from, to, onCancel, onSave }: { season: number; from: number; to: number | null; onCancel: () => void; onSave: (episode: number, question: string, guess: string) => void }) {
  const [question, setQuestion] = useState('')
  const [guess, setGuess] = useState('')
  const [episode, setEpisode] = useState(from)
  const [saving, setSaving] = useState(false)
  const last = to ?? from + 9
  const options = Array.from({ length: Math.max(1, last - from + 1) }, (_, i) => from + i)
  return (
    <form
      className="predict-new"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!guess.trim()) return
        setSaving(true)
        await onSave(episode, question.trim(), guess)
        setSaving(false)
      }}
    >
      <label className="field">
        <span>{t('The question')}</span>
        <input value={question} maxLength={140} onChange={(e) => setQuestion(e.target.value)} placeholder={t('Who is the killer?')} />
      </label>
      <label className="field">
        <span>{t('Opens after')}</span>
        <select value={episode} onChange={(e) => setEpisode(Number(e.target.value))}>
          {options.map((n) => (
            <option key={n} value={n}>
              {n === from ? t('Next episode (S{s} E{n})', { s: season, n }) : n === to ? t('Season finale (E{n})', { n }) : t('Episode {n}', { n })}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('Your guess')}</span>
        <input value={guess} maxLength={200} onChange={(e) => setGuess(e.target.value)} placeholder={t('The butler did it')} required />
      </label>
      <p className="muted small">{t("Everyone in your household can add their own guess. Nobody sees the others' until the episode is logged.")}</p>
      <div className="predict-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>
          {t('Cancel')}
        </button>
        <button type="submit" className="btn primary" disabled={!guess.trim() || saving}>
          🔮 {t('Seal my guess')}
        </button>
      </div>
    </form>
  )
}
