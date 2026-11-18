import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../i18n'
import { useBackClose } from '../hooks/useBackClose'
import { householdLabel } from '../logic'
import { PARTY_REACTIONS, type Household, type Kind, type PartyAnswer, type PartyMessage, type Person, type WatchParty } from '../types'
import { answersFor, clockLabel, partyEpisode, partyPhase, timeLabel, whenLabel, type PartyAction } from '../watchParty'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { PosterFill } from './Poster'

export interface PartyTitle {
  kind: Kind
  extId: number
  title: string
  poster: string | null
  season: number | null
  episode: number | null
  runtime: number | null
}

const nameOf = (people: Person[], id: string | null) => people.find((p) => p.id === id)?.name ?? t('Someone')

function useEscape(onClose: () => void) {
  useBackClose(true, onClose)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

/** A time picker value (local) → ISO */
const fromLocalInput = (v: string) => new Date(v).toISOString()
const toLocalInput = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 1 · Plan a party: what (from the show's page), with which households, and when. */
export function PartyPlanner({ what, households, people, onCreate, onClose }: {
  what: PartyTitle
  /** The other households in the family */
  households: Household[]
  people: Person[]
  onCreate: (guests: string[], startsAt: string) => Promise<boolean>
  onClose: () => void
}) {
  useEscape(onClose)
  const [guests, setGuests] = useState<string[]>([])
  // Fixed when the planner opens
  const [{ now, nine }] = useState(() => {
    const d = new Date()
    d.setHours(21, 0, 0, 0)
    return { now: Date.now(), nine: d.getTime() }
  })
  // "Tonight 21:00" while there's time; later in the evening "In 30 min"
  const evening = nine - now > 15 * 60_000 ? nine : now + 30 * 60_000
  const [when, setWhen] = useState<'now' | 'evening' | 'pick'>('evening')
  const [picked, setPicked] = useState(() => toLocalInput(evening))
  const [sending, setSending] = useState(false)
  const startsAt = when === 'now' ? new Date(now).toISOString() : when === 'evening' ? new Date(evening).toISOString() : fromLocalInput(picked)
  const pickValid = when !== 'pick' || (Date.parse(startsAt) > now - 60_000 && Date.parse(startsAt) < now + 30 * 86_400_000)
  const ep = partyEpisode(what)

  return createPortal(
    <div className="night" role="dialog" aria-modal="true" aria-label={t('Watch party')}>
      <button type="button" className="night-close icon-btn" aria-label={t('Close')} onClick={onClose}>
        <Icon name="close" size={20} />
      </button>
      <div className="night-body">
        <p className="night-kicker">🎉 {t('Watch party')}</p>
        <h2 className="night-title">{t('Same show, same time, different couches')}</h2>
        <div className="party-what">
          <span className="night-mini"><PosterFill src={what.poster} name={what.title} /></span>
          <span>
            <b>{what.title}</b>
            <span>{[ep, what.runtime ? t('{n} min', { n: what.runtime }) : null].filter(Boolean).join(' · ')}</span>
          </span>
        </div>

        <div className="night-group">
          <b id="party-with">{t('With')}</b>
          {households.length === 0 ? (
            <p className="night-sub">{t('No other households in the family yet.')}</p>
          ) : (
            <div className="night-chips" role="group" aria-labelledby="party-with">
              {households.map((h) => {
                const on = guests.includes(h.id)
                return (
                  <button key={h.id} type="button" role="switch" aria-checked={on} className={on ? 'on' : ''} onClick={() => setGuests(on ? guests.filter((x) => x !== h.id) : [...guests, h.id])}>
                    {householdLabel(h, people)}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="night-group" role="radiogroup" aria-label={t('When')}>
          <b>{t('When')}</b>
          <div className="night-chips">
            <button type="button" role="radio" aria-checked={when === 'now'} className={when === 'now' ? 'on' : ''} onClick={() => setWhen('now')}>
              {t('Now')}
            </button>
            <button type="button" role="radio" aria-checked={when === 'evening'} className={when === 'evening' ? 'on' : ''} onClick={() => setWhen('evening')}>
              {evening === nine ? t('Tonight {time}', { time: timeLabel(new Date(evening).toISOString()) }) : t('In 30 min')}
            </button>
            <button type="button" role="radio" aria-checked={when === 'pick'} className={when === 'pick' ? 'on' : ''} onClick={() => setWhen('pick')}>
              {t('Pick a time')}
            </button>
          </div>
          {when === 'pick' && (
            <input
              className="party-time"
              type="datetime-local"
              aria-label={t('Party time')}
              value={picked}
              min={toLocalInput(now)}
              onChange={(e) => e.target.value && setPicked(e.target.value)}
            />
          )}
          {!pickValid && <p className="night-note" role="alert">{t('Pick a time in the next 30 days.')}</p>}
        </div>

        <div className="night-spacer" />
        <button
          type="button"
          className="btn primary block"
          disabled={!guests.length || !pickValid || sending}
          onClick={async () => {
            setSending(true)
            const ok = await onCreate(guests, startsAt)
            setSending(false)
            if (ok) onClose()
          }}
        >
          {sending ? t('Sending…') : t('Send invitations')}
        </button>
        <p className="night-note">{guests.length ? t('They get a notification and can say Join or Can\'t make it.') : t('Pick at least one household.')}</p>
      </div>
    </div>,
    document.body,
  )
}

/** 3 + 4 · The party room: lobby, the shared 3-2-1, then chat, reactions and pause for everyone. */
export function PartyRoom({ party, answers, messages, people, households, me, myHousehold, offset, canMark, onAnswer, onControl, onSend, onMark, onSyncClock, onClose }: {
  party: WatchParty
  answers: PartyAnswer[]
  messages: PartyMessage[]
  people: Person[]
  households: Household[]
  me: string
  myHousehold: string | null
  /** server clock minus this phone's (ms) */
  offset: number
  /** After the party: label of the button that marks it watched in your own log, or null */
  canMark: string | null
  onAnswer: (a: PartyAnswer['answer']) => void
  onControl: (action: PartyAction, atSec?: number | null) => Promise<boolean>
  onSend: (kind: PartyMessage['kind'], body: string, atSec: number | null) => void
  onMark: () => void
  onSyncClock: () => void
  onClose: () => void
}) {
  useEscape(onClose)
  const [now, setNow] = useState(() => Date.now() + offset)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const chatEnd = useRef<HTMLDivElement>(null)
  const here = partyPhase(party, now)
  const { joined, no } = answersFor(party, answers)
  const amIn = joined.includes(me)
  const host = party.hostHouseholdId === myHousehold
  const hostName = householdLabel(households.find((h) => h.id === party.hostHouseholdId), people)
  const lines = messages.filter((m) => m.partyId === party.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const ep = partyEpisode(party)
  const at = here.phase === 'playing' || here.phase === 'paused' ? here.at : null

  useEffect(() => {
    onSyncClock()
  }, [onSyncClock])
  useEffect(() => {
    const fast = here.phase === 'countdown' || here.phase === 'playing'
    const id = window.setInterval(() => setNow(Date.now() + offset), fast ? 250 : 1000)
    return () => window.clearInterval(id)
  }, [here.phase, offset])
  useEffect(() => {
    chatEnd.current?.scrollIntoView?.({ block: 'end' })
  }, [lines.length])

  async function act(action: PartyAction, atSec: number | null = null) {
    setBusy(true)
    await onControl(action, atSec)
    setBusy(false)
  }

  const header = (
    <div className="party-head">
      <span className="night-mini"><PosterFill src={party.poster} name={party.title} /></span>
      <span>
        <b>{party.title}</b>
        <span>{[ep, here.phase === 'playing' || here.phase === 'paused' ? t('{time} in', { time: clockLabel(here.at) }) : null].filter(Boolean).join(' · ')}</span>
      </span>
    </div>
  )

  let stage: React.ReactNode
  if (here.phase === 'over') {
    stage = (
      <div className="party-stage">
        <p className="night-big" aria-hidden="true">{party.state === 'cancelled' ? '🗓️' : '🎬'}</p>
        <h2 className="night-title">{party.state === 'cancelled' ? t('Party cancelled') : t("That's a wrap")}</h2>
        {party.state === 'ended' && canMark && (
          <button type="button" className="btn primary" onClick={onMark}>
            ✓ {canMark}
          </button>
        )}
        {lines.length > 0 && <p className="night-note">{t('The chat stays on the show\'s page.')}</p>}
      </div>
    )
  } else if (here.phase === 'planned') {
    stage = (
      <div className="party-stage">
        <p className="night-kicker">{t('Hosted by {host}', { host: hostName })}</p>
        <h2 className="night-title">{here.startsIn > 0 ? t('Starts {when}', { when: whenLabel(party.startsAt) }) : t('Everyone ready?')}</h2>
        <ul className="party-people" aria-label={t('Who is coming')}>
          {joined.map((id) => (
            <li key={id}>
              <Avatar people={people} id={id} size={28} /> {id === me ? t('You') : nameOf(people, id)} <span className="party-yes">{t('in')}</span>
            </li>
          ))}
          {no.map((id) => (
            <li key={id} className="party-no">
              <Avatar people={people} id={id} size={28} /> {id === me ? t('You') : nameOf(people, id)} <span>{t("can't make it")}</span>
            </li>
          ))}
        </ul>
        {!amIn ? (
          <div className="party-card-actions">
            <button type="button" className="btn primary" onClick={() => onAnswer('join')}>{t('Join')}</button>
            {!no.includes(me) && <button type="button" className="btn ghost night-ghost" onClick={() => onAnswer('no')}>{t("Can't make it")}</button>}
          </div>
        ) : (
          <button type="button" className="btn primary block" disabled={busy} onClick={() => act('start')}>
            ▶ {t('Start the 3-2-1 for everyone')}
          </button>
        )}
        <p className="night-note">{t('When it starts, everyone gets a 3-2-1 and presses play at the same moment.')}</p>
      </div>
    )
  } else if (here.phase === 'countdown') {
    stage = (
      <div className="party-stage" aria-live="assertive">
        <p className="night-sub">{party.positionSec ? t('Resuming at {time}', { time: clockLabel(party.positionSec) }) : t("Everyone's here")}</p>
        <p className="party-count" aria-label={t('{n} seconds', { n: here.left })}>{here.left}</p>
        <p className="night-sub">{t('Press play when it hits 0')}</p>
      </div>
    )
  } else {
    stage = (
      <>
        {here.phase === 'paused' && (
          <p className="party-paused" role="status">
            ⏸ {t('{name} paused at {time}', { name: party.pausedBy === me ? t('You') : nameOf(people, party.pausedBy), time: clockLabel(here.at) })}
          </p>
        )}
        <div className="party-chat" aria-label={t('Party chat')} role="log">
          {lines.length === 0 && <p className="night-note">{t('Say something, or tap a reaction.')}</p>}
          {lines.map((m) => (
            <p key={m.id} className={`party-line ${m.kind === 'react' ? 'react' : ''} ${m.personId === me ? 'mine' : ''}`}>
              <Avatar people={people} id={m.personId} size={20} />
              <span className="sr-only">{nameOf(people, m.personId)}: </span>
              <span className="party-body">{m.body}</span>
              {m.atSec != null && <span className="party-at">{clockLabel(m.atSec)}</span>}
            </p>
          ))}
          <div ref={chatEnd} />
        </div>
        <div className="party-reacts" role="group" aria-label={t('React')}>
          {PARTY_REACTIONS.map((e) => (
            <button key={e} type="button" aria-label={t('React {emoji}', { emoji: e })} onClick={() => onSend('react', e, at)}>
              {e}
            </button>
          ))}
        </div>
        <form
          className="party-say"
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim()) return
            onSend('text', text, at)
            setText('')
          }}
        >
          <input value={text} maxLength={500} enterKeyHint="send" onChange={(e) => setText(e.target.value)} placeholder={t('Say something')} aria-label={t('Message the party')} />
          <button type="submit" className="chat-send" aria-label={t('Send')} disabled={!text.trim()}>
            <Icon name="right" size={18} stroke={2.6} />
          </button>
        </form>
        {amIn &&
          (here.phase === 'playing' ? (
            <button type="button" className="btn block night-watch" disabled={busy} onClick={() => act('pause', here.at)}>
              ⏸ {t('Pause for everyone')}
            </button>
          ) : (
            <button type="button" className="btn primary block" disabled={busy} onClick={() => act('resume')}>
              ▶ {t('Resume for everyone (3-2-1)')}
            </button>
          ))}
      </>
    )
  }

  return createPortal(
    <div className="night party" role="dialog" aria-modal="true" aria-label={t('Watch party')}>
      <button type="button" className="night-close icon-btn" aria-label={t('Close')} onClick={onClose}>
        <Icon name="close" size={20} />
      </button>
      <div className="night-body">
        {header}
        {stage}
        {host && here.phase !== 'over' && (
          <button
            type="button"
            className={`link-btn party-end ${confirmEnd ? 'danger' : ''}`}
            onClick={() => (confirmEnd ? act(here.phase === 'planned' ? 'cancel' : 'end') : setConfirmEnd(true))}
          >
            {confirmEnd ? t('Tap again to confirm') : here.phase === 'planned' ? t('Cancel the party') : t('End the party')}
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** On the show's page afterwards: what was said at the party */
export function PartyChatLog({ parties, messages, people }: { parties: WatchParty[]; messages: PartyMessage[]; people: Person[] }) {
  const [open, setOpen] = useState(false)
  const lines = messages.filter((m) => parties.some((p) => p.id === m.partyId) && m.kind === 'text')
  if (!lines.length) return null
  return (
    <section className="card pad party-log">
      <button type="button" className="party-log-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <b>🎉 {t('Watch party chat')}</b>
        <span className="muted">{t('{n} messages', { n: lines.length })}</span>
      </button>
      {open && (
        <ul>
          {lines.map((m) => (
            <li key={m.id}>
              <Avatar people={people} id={m.personId} size={22} />
              <span>
                <b>{nameOf(people, m.personId)}</b> {m.body}
              </span>
              {m.atSec != null && <span className="muted">{clockLabel(m.atSec)}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
