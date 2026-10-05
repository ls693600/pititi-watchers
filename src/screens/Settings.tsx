import { useEffect, useState, type FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import type { Session } from '../store/store'
import { getThemePref, setThemePref, type ThemePref } from '../theme'
import type { Person, Watch } from '../types'

interface Props {
  mode: 'local' | 'cloud'
  session: Session | null
  /** Admin manages family members and the invite code */
  isAdmin: boolean
  people: Person[]
  watches: Watch[]
  onAddPerson: (name: string) => Promise<void>
  loadInvite: (() => Promise<string>) | null
  renewInvite: (() => Promise<string>) | null
  onSignOut: () => void
  /** Family tab shows people and invites; Settings tab shows account and app */
  view: 'family' | 'account'
  /** Family tab shows a gear that opens Settings */
  onOpenSettings?: () => void
  /** Settings has no tab of its own; this returns to where you came from */
  onBack?: () => void
  onOpenHelp?: () => void
}

const APP_URL = 'https://ls693600.github.io/pititi-watchers/'

export function Settings({ mode, session, isAdmin, people, watches, onAddPerson, loadInvite, renewInvite, onSignOut, view, onOpenSettings, onBack, onOpenHelp }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemePref>(getThemePref)

  useEffect(() => {
    if (!isAdmin) return
    loadInvite?.()
      .then(setCode)
      .catch(() => setInviteMsg("Couldn't load the invite code. Check your connection."))
  }, [loadInvite, isAdmin])

  const me = people.find((p) => p.id === session?.personId)

  async function add(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setError('Enter a name.')
    if (n.length > 30) return setError('Keep the name under 30 characters.')
    if (people.some((p) => p.name.toLowerCase() === n.toLowerCase())) return setError(`${n} is already in the family.`)
    setBusy(true)
    setError(null)
    try {
      await onAddPerson(n)
      setName('')
    } catch {
      setError("Couldn't add them. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  async function shareInvite() {
    if (!code) return
    const text = `Join Pititi Watchers: open ${APP_URL} in Safari, tap Share → Add to Home Screen, then Create account with invite code ${code}`
    try {
      if (navigator.share) await navigator.share({ title: 'Pititi Watchers', text })
      else {
        await navigator.clipboard.writeText(text)
        setInviteMsg('Invite copied. Paste it in a message.')
      }
    } catch {
      // Share sheet dismissed
    }
  }

  async function renew() {
    if (!renewInvite || !confirm('Make a new invite code? The old code stops working for new accounts.')) return
    try {
      setCode(await renewInvite())
      setInviteMsg('New code ready. Existing accounts are not affected.')
    } catch {
      setInviteMsg("Couldn't change the code. Try again.")
    }
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ people, watches }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pititi-watchers-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="screen">
      <header className="topbar">
        {view === 'account' && onBack && (
          <button className="icon-btn" aria-label="Back" onClick={onBack} style={{ marginRight: 4 }}>
            <Icon name="left" size={20} />
          </button>
        )}
        <div style={{ flex: 1 }}>
          <p className="eyebrow">{view === 'family' ? 'Who watches with you' : 'Your account'}</p>
          <h1 className="title-xl">{view === 'family' ? 'Family' : 'Settings'}</h1>
        </div>
        {view === 'family' && onOpenSettings && (
          <button className="icon-btn" aria-label="Settings" onClick={onOpenSettings}>
            <Icon name="settings" size={20} />
          </button>
        )}
      </header>

      {view === 'account' && me && (
        <section className="card pad profile">
          <Avatar people={people} id={me.id} size={58} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="profile-name">{me.name}</p>
            <p className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{session?.email}</p>
          </div>
          {isAdmin && (
            <span className="badge admin">
              <Icon name="crown" size={12} stroke={2.4} /> Admin
            </span>
          )}
        </section>
      )}

      {view === 'family' && (
      <>
      <h2 className="h2">
        Members
        <small>{people.length} {people.length === 1 ? 'person' : 'people'}</small>
      </h2>
      <section className="card">
        <ul>
          {people.map((p) => (
            <li key={p.id}>
              <div className="lrow">
                <Avatar people={people} id={p.id} size={38} />
                <span className="lrow-text">
                  <span className="lrow-title">
                    {p.name} {me?.id === p.id && <span className="you">you</span>}
                  </span>
                  {p.isAdmin && <span className="muted">Admin</span>}
                </span>
                {mode === 'cloud' && (
                  <span className={`badge ${p.userId ? 'ok' : ''}`}>{p.userId ? 'Joined' : 'Not joined'}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
        {isAdmin ? (
          <>
            <form className="inline-form" onSubmit={add} noValidate>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError(null)
                }}
                placeholder="Add someone, like Mom"
                aria-label="New family member's name"
                maxLength={30}
              />
              <button className="btn dark sm" type="submit" disabled={busy} style={{ minHeight: 46 }}>
                {busy ? 'Adding…' : 'Add'}
              </button>
            </form>
            {error && <p className="error" role="alert">{error}</p>}
            <p className="muted small" style={{ padding: '4px 0 14px' }}>
              They can be picked in "Who watched?" right away, even without a phone.
            </p>
          </>
        ) : (
          <p className="muted small" style={{ padding: '4px 0 14px' }}>
            {people.find((p) => p.isAdmin)?.name ?? 'The admin'} manages the family and invites.
          </p>
        )}
      </section>

      {mode === 'cloud' && isAdmin && (
        <>
          <h2 className="h2">Invite family</h2>
          <section className="card pad">
            <p className="muted" style={{ fontSize: 14.5 }}>
              Share this code. They install the app, tap Create account, and enter it.
            </p>
            <div className="invite-code" aria-label="Invite code">{code ?? '········'}</div>
            <button className="btn primary block" onClick={shareInvite} disabled={!code}>
              <Icon name="share" size={18} /> Share invite
            </button>
            {inviteMsg && <p className="ok small center" role="status" style={{ marginTop: 10 }}>{inviteMsg}</p>}
            <button className="btn ghost block" onClick={renew} disabled={!code} style={{ marginTop: 4 }}>
              Make a new code
            </button>
          </section>
        </>
      )}

      </>
      )}

      {view === 'account' && (
      <>
      <h2 className="h2">App</h2>
      <section className="card">
        <div className="field">
          <span>Appearance</span>
          <div className="segmented" role="radiogroup" aria-label="Appearance">
            {(['auto', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={theme === t}
                className={theme === t ? 'on' : ''}
                onClick={() => {
                  setTheme(t)
                  setThemePref(t)
                }}
              >
                {t === 'auto' ? 'Auto' : t === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </div>
        {theme === 'auto' && <p className="muted small" style={{ marginTop: -6, paddingBottom: 10 }}>Dark from 7 PM to 7 AM, when you're watching.</p>}
        <div className="field">
          <span>Sync</span>
          <span className={mode === 'cloud' ? 'ok' : 'muted'}>{mode === 'cloud' ? 'On · every family phone' : 'Off · this phone only'}</span>
        </div>
        <div className="field">
          <span>Logged shows</span>
          <strong>{watches.length}</strong>
        </div>
        {onOpenHelp && (
          <button className="field" onClick={onOpenHelp} style={{ width: '100%' }}>
            <span>Help and questions</span>
            <span className="chev"><Icon name="right" size={20} /></span>
          </button>
        )}
        <button className="field" onClick={exportBackup} disabled={watches.length === 0} style={{ width: '100%' }}>
          <span>Export backup</span>
          <span className="chev"><Icon name="download" size={20} /></span>
        </button>
      </section>

      {session && (
        <button className="btn danger block" onClick={onSignOut}>
          <Icon name="logout" size={18} /> Sign out
        </button>
      )}
      </>
      )}

      {view === 'account' && <p className="muted small center">Show data from TVmaze</p>}
    </div>
  )
}
