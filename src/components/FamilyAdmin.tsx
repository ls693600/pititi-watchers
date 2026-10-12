import { useState, type FormEvent } from 'react'
import { householdLabel } from '../logic'
import { t } from '../i18n'
import type { Household, Person } from '../types'
import { Avatar } from './Avatar'
import { Icon } from './Icon'

const APP_URL = 'https://ls693600.github.io/pititi-watchers/'

interface Props {
  people: Person[]
  households: Household[]
  me: Person | undefined
  isAdmin: boolean
  onAddHousehold: (name: string) => Promise<string | null>
  onUpdateHousehold: (h: Household) => Promise<void>
  onMovePerson: (personId: string, householdId: string | null) => Promise<void>
  onAddPerson: (name: string, householdId: string | null) => Promise<void>
  householdCode: (id: string) => Promise<string | null>
  onSetViewer: (id: string, viewer: boolean) => Promise<void>
  viewerCode: string | null
}

async function shareText(text: string, onCopied: () => void) {
  try {
    if (navigator.share) await navigator.share({ title: 'Pititi Watchers', text })
    else {
      await navigator.clipboard.writeText(text)
      onCopied()
    }
  } catch {
    // Share sheet dismissed
  }
}

function inviteText(code: string, household: string): string {
  return t(
    'Join {household} on Pititi Watchers! Open {link}\niPhone: in Safari tap Share → Add to Home Screen.\nAndroid: in Chrome tap ⋮ → Add to Home screen.\nThen create your account (the code {code} is already filled in).',
    { household, link: `${APP_URL}?invite=${encodeURIComponent(code)}`, code },
  )
}

/** Households in the family circle: who's in each, their invite links, and (for the admin) moving people around. */
export function FamilyAdmin({ people, households, me, isAdmin, onAddHousehold, onUpdateHousehold, onMovePerson, onAddPerson, householdCode, onSetViewer, viewerCode }: Props) {
  const [msg, setMsg] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState<{ household: string | null; name: string } | null>(null)
  const ordered = [...households].sort((a, b) => Number(b.id === me?.householdId) - Number(a.id === me?.householdId))
  const viewers = people.filter((p) => p.isViewer)
  const canManage = (h: Household) => isAdmin || (h.id === me?.householdId && !me?.isViewer)

  async function share(h: Household) {
    const code = await householdCode(h.id).catch(() => null)
    if (!code) return setMsg(t("Couldn't load the invite code. Check your connection."))
    await shareText(inviteText(code, householdLabel(h, people)), () => setMsg(t('Invite copied. Paste it in a message.')))
  }

  async function create(e: FormEvent) {
    e.preventDefault()
    const n = newName.trim()
    if (!n) return
    setBusy(true)
    const code = await onAddHousehold(n)
    setBusy(false)
    if (code) {
      setNewName('')
      await shareText(inviteText(code, n), () => setMsg(t('Invite copied. Paste it in a message.')))
    }
  }

  async function addPerson(e: FormEvent) {
    e.preventDefault()
    if (!adding?.name.trim()) return
    setBusy(true)
    await onAddPerson(adding.name.trim(), adding.household)
    setBusy(false)
    setAdding(null)
  }

  return (
    <>
      {msg && (
        <p className="ok small center" role="status">
          {msg}
        </p>
      )}
      {ordered.map((h) => {
        const members = people.filter((p) => p.householdId === h.id && !p.isViewer)
        const mine = h.id === me?.householdId
        return (
          <section key={h.id} className="card house-card">
            <div className="house-head">
              <span className="stack">
                {members.slice(0, 4).map((p) => (
                  <Avatar key={p.id} people={people} id={p.id} size={30} />
                ))}
              </span>
              <span className="house-name">
                <b>{householdLabel(h, people)}</b>
                <small>{mine ? t('Your household') : t('{n} people', { n: members.length })}</small>
              </span>
              {canManage(h) && (
                <button
                  className="icon-btn"
                  aria-label={t('Rename {name}', { name: householdLabel(h, people) })}
                  onClick={() => {
                    const name = prompt(t('Household name'), h.name)?.trim()
                    if (name) onUpdateHousehold({ ...h, name: name.slice(0, 40) })
                  }}
                >
                  <Icon name="settings" size={18} />
                </button>
              )}
            </div>
            <ul>
              {members.map((p) => (
                <li key={p.id} className="lrow">
                  <Avatar people={people} id={p.id} size={34} />
                  <span className="lrow-text">
                    <span className="lrow-title">
                      {p.name} {me?.id === p.id && <span className="you">{t('you')}</span>}
                    </span>
                    <span className="muted">{p.isAdmin ? t('Admin') : p.userId ? t('Joined') : t('No account yet')}</span>
                  </span>
                  {isAdmin && !p.isAdmin && (
                    <select
                      className="move-select"
                      aria-label={t('Move {name}', { name: p.name })}
                      value={p.householdId ?? ''}
                      onChange={(e) => onMovePerson(p.id, e.target.value || null)}
                    >
                      {households.map((x) => (
                        <option key={x.id} value={x.id}>
                          {householdLabel(x, people)}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              ))}
            </ul>
            {canManage(h) && (
              <>
                <div className="field" style={{ borderBottom: 0 }}>
                  <span>
                    {t('Share our watch log')}
                    <small className="muted" style={{ display: 'block', fontSize: 12.5 }}>
                      {h.shareLog ? t('The family sees what you finish and your averages') : t('Only your household sees your log')}
                    </small>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={h.shareLog}
                    aria-label={t('Share our watch log')}
                    className={`toggle ${h.shareLog ? 'on' : ''}`}
                    onClick={() => onUpdateHousehold({ ...h, shareLog: !h.shareLog })}
                  />
                </div>
                <div className="house-actions">
                  <button className="btn sm primary" onClick={() => share(h)}>
                    <Icon name="share" size={15} /> {t('Invite to {name}', { name: householdLabel(h, people) })}
                  </button>
                  {isAdmin && (
                    <button className="btn sm ghost-dark" onClick={() => setAdding({ household: h.id, name: '' })}>
                      <Icon name="plus" size={15} /> {t('Someone without a phone')}
                    </button>
                  )}
                </div>
                {adding?.household === h.id && (
                  <form className="inline-form" onSubmit={addPerson}>
                    <input
                      value={adding.name}
                      maxLength={30}
                      autoFocus
                      placeholder={t('Name, like Grandma')}
                      aria-label={t('Name')}
                      onChange={(e) => setAdding({ ...adding, name: e.target.value })}
                    />
                    <button className="btn dark sm" type="submit" disabled={busy}>
                      {t('Add')}
                    </button>
                  </form>
                )}
              </>
            )}
          </section>
        )
      })}

      {isAdmin && (
        <>
          <h2 className="h2">{t('New household')}</h2>
          <form className="card pad stack-col" onSubmit={create}>
            <p className="muted" style={{ fontSize: 14.5 }}>
              {t('For a couple or a family member: they get their own log, stats and lists, and can see and share with everyone here.')}
            </p>
            <div className="inline-form" style={{ padding: 0 }}>
              <input value={newName} maxLength={40} placeholder={t('Fernando & Lara')} aria-label={t('Household name')} onChange={(e) => setNewName(e.target.value)} />
              <button className="btn primary sm" type="submit" disabled={busy || !newName.trim()}>
                {t('Create')}
              </button>
            </div>
          </form>
        </>
      )}

      {(viewers.length > 0 || (isAdmin && viewerCode)) && (
        <>
          <h2 className="h2">
            {t('Viewers')}
            <small>{t('see + chat')}</small>
          </h2>
          <section className="card">
            {viewers.length > 0 && (
              <ul>
                {viewers.map((p) => (
                  <li key={p.id} className="lrow">
                    <Avatar people={people} id={p.id} size={34} />
                    <span className="lrow-text">
                      <span className="lrow-title">{p.name}</span>
                      <span className="muted">{t('Viewer · sees and chats')}</span>
                    </span>
                    {isAdmin && (
                      <select
                        className="move-select"
                        aria-label={t('Make {name} a member of', { name: p.name })}
                        value=""
                        onChange={async (e) => {
                          if (!e.target.value) return
                          await onMovePerson(p.id, e.target.value)
                          await onSetViewer(p.id, false)
                        }}
                      >
                        <option value="">{t('Make member of…')}</option>
                        {households.map((x) => (
                          <option key={x.id} value={x.id}>
                            {householdLabel(x, people)}
                          </option>
                        ))}
                      </select>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {isAdmin && viewerCode && (
              <div className="pad">
                <p className="muted" style={{ fontSize: 14 }}>
                  {t("Someone who follows along without their own log: they see everything you share and can chat, but can't add or rate.")}
                </p>
                <button
                  className="btn ghost block"
                  onClick={() =>
                    shareText(
                      t('Take a look at our Pititi Watchers! Open {link}\nThen create your account (code {code}, already filled in).', {
                        link: `${APP_URL}?invite=${encodeURIComponent(viewerCode)}`,
                        code: viewerCode,
                      }),
                      () => setMsg(t('Invite copied. Paste it in a message.')),
                    )
                  }
                >
                  <Icon name="share" size={16} /> {t('Share viewer invite')}
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}
