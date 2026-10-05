import { useEffect, useState, type FormEvent } from 'react'
import { PEOPLE } from '../config'
import type { PersonId } from '../types'

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>
  /** Resolves false when the account needs email confirmation before signing in. */
  onSignUp: (email: string, password: string, person: PersonId) => Promise<boolean>
  loadTaken: () => Promise<PersonId[]>
}

export function Login({ onSignIn, onSignUp, loadTaken }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [person, setPerson] = useState<PersonId | null>(null)
  const [taken, setTaken] = useState<PersonId[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (mode !== 'signup') return
    loadTaken()
      .then((t) => {
        setTaken(t)
        setPerson((cur) => (cur && !t.includes(cur) ? cur : PEOPLE.find((p) => !t.includes(p.id))?.id ?? null))
      })
      .catch(() => setTaken([]))
  }, [mode, loadTaken])

  const free = PEOPLE.filter((p) => !taken.includes(p.id))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return setError('Enter your email and password.')
    if (mode === 'signup') {
      if (password.length < 6) return setError('Use at least 6 characters for the password.')
      if (!person) return setError('Both accounts already exist. Sign in instead.')
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signin') {
        await onSignIn(email.trim(), password)
      } else {
        const signedIn = await onSignUp(email.trim(), password, person!)
        if (!signedIn) {
          setNotice('Account created. Open the confirmation email, then come back and sign in.')
          setMode('signin')
        }
      }
    } catch (err) {
      const msg = (err as Error).message || ''
      setError(/invalid login/i.test(msg) ? 'Wrong email or password.' : msg || "Couldn't sign in. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="screen login" onSubmit={submit} noValidate>
      <div className="logo" aria-hidden="true">▶</div>
      <h1>Pititi Watchers</h1>
      <p className="muted center">{PEOPLE.map((p) => p.name).join(' and ')}'s shows</p>

      <div className="segmented wide" role="tablist" aria-label="Account">
        {(['signin', 'signup'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={mode === m ? 'on' : ''}
            onClick={() => {
              setMode(m)
              setError(null)
            }}
          >
            {m === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      {mode === 'signup' && (
        <div className="stack">
          <span className="muted">I'm</span>
          {free.length === 0 ? (
            <p className="muted">Both accounts already exist. Sign in instead.</p>
          ) : (
            <div className="segmented wide" role="radiogroup" aria-label="Who are you">
              {free.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={person === p.id}
                  className={person === p.id ? 'on' : ''}
                  onClick={() => setPerson(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <label className="stack">
        <span className="muted">Email</span>
        <input
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </label>
      <label className="stack">
        <span className="muted">Password</span>
        <input
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {notice && <p className="ok" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn primary block" type="submit" disabled={busy}>
        {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
      </button>
    </form>
  )
}
