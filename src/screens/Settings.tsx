import { useEffect, useState, type FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import type { Session } from '../store/store'
import type { Person, Watch } from '../types'

interface Props {
  mode: 'local' | 'cloud'
  session: Session | null
  people: Person[]
  watches: Watch[]
  onAddPerson: (name: string) => Promise<void>
  loadInvite: (() => Promise<string>) | null
  renewInvite: (() => Promise<string>) | null
  onSignOut: () => void
}

const APP_URL = 'https://ls693600.github.io/pititi-watchers/'

export function Settings({ mode, session, people, watches, onAddPerson, loadInvite, renewInvite, onSignOut }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)

  useEffect(() => {
    loadInvite?.()
      .then(setCode)
      .catch(() => setInviteMsg("Couldn't load the invite code. Check your connection."))
  }, [loadInvite])

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
      <h1 className="screen-title">Settings</h1>

      <h2 className="section">Family</h2>
      <section className="card">
        <ul className="people-list">
          {people.map((p) => (
            <li key={p.id}>
              <Avatar people={people} id={p.id} size={28} />
              <span className="name">
                {p.name}
                {me?.id === p.id && <span className="you"> you</span>}
              </span>
              {mode === 'cloud' && (
                <span className={`badge ${p.userId ? 'ok' : ''}`}>{p.userId ? 'Has account' : 'No account yet'}</span>
              )}
            </li>
          ))}
        </ul>
        <form className="inline-form" onSubmit={add} noValidate>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            placeholder="Mom"
            aria-label="New family member's name"
            maxLength={30}
          />
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Adding…' : 'Add person'}
          </button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="muted small" style={{ paddingBottom: 10 }}>
          Add anyone you watch with. They can be marked in "Watched by" right away, even without a phone.
        </p>
      </section>

      {mode === 'cloud' && (
        <section className="card">
          <div className="invite">
            <div>
              <p className="muted small">Invite code</p>
              <code>{code ?? '········'}</code>
            </div>
            <button className="btn primary" onClick={shareInvite} disabled={!code}>
              Share invite
            </button>
          </div>
          <p className="muted small">
            Family members install the app, tap Create account, and enter this code. If you added them above, they pick
            their name; otherwise they type it.
          </p>
          {inviteMsg && <p className="ok small" role="status">{inviteMsg}</p>}
          <button className="btn danger block" onClick={renew} disabled={!code}>
            Make a new code
          </button>
        </section>
      )}

      <section className="card">
        <div className="field">
          <span>Sync</span>
          <span className={mode === 'cloud' ? 'ok' : 'muted'}>{mode === 'cloud' ? 'On · all family phones' : 'Off · this phone only'}</span>
        </div>
        {session && (
          <div className="field">
            <span>Signed in as</span>
            <span className="muted">{me?.name} · {session.email}</span>
          </div>
        )}
        <div className="field">
          <span>Logged shows</span>
          <strong>{watches.length}</strong>
        </div>
        <button className="btn block" onClick={exportBackup} disabled={watches.length === 0} style={{ margin: '10px 0' }}>
          Export backup (JSON)
        </button>
      </section>

      {session && (
        <button className="btn danger block" onClick={onSignOut}>
          Sign out
        </button>
      )}

      <p className="muted small center">Show data from TVmaze</p>
    </div>
  )
}
