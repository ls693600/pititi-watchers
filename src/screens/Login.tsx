import { useEffect, useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import type { JoinAs, JoinOptions } from '../store/cloud'
import { popularPosters } from '../tvmaze'

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>
  /** Resolves false when the account needs email confirmation before signing in. */
  onSignUp: (email: string, password: string, code: string, as: JoinAs) => Promise<boolean>
  loadOptions: (code: string) => Promise<JoinOptions>
}

const NEW = '__new__'

export function Login({ onSignIn, onSignUp, loadOptions }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [options, setOptions] = useState<JoinOptions | null>(null)
  const [checking, setChecking] = useState(false)
  const [pick, setPick] = useState<string>(NEW)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [posters, setPosters] = useState<string[]>([])

  useEffect(() => {
    popularPosters().then(setPosters).catch(() => setPosters([]))
  }, [])

  // Check the invite code as it's typed, then offer the matching profiles
  useEffect(() => {
    const c = code.trim()
    if (mode !== 'signup' || c.length < 6) return
    let alive = true
    const t = setTimeout(async () => {
      setChecking(true)
      try {
        const o = await loadOptions(c)
        if (!alive) return
        setOptions(o)
        setPick(o.profiles[0]?.id ?? NEW)
      } catch {
        if (alive) setOptions(null)
      } finally {
        if (alive) setChecking(false)
      }
    }, 350)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [code, mode, loadOptions])

  const codeOk = options?.valid && code.trim().length >= 6

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return setError('Enter your email and password.')
    if (mode === 'signup') {
      if (!codeOk) return setError('Enter the invite code from Settings on a family member’s phone.')
      if (pick === NEW && !name.trim()) return setError('Enter your name.')
      if (password.length < 6) return setError('Use at least 6 characters for the password.')
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signin') {
        await onSignIn(email.trim(), password)
      } else {
        const as: JoinAs = pick === NEW ? { name: name.trim() } : { personId: pick }
        const signedIn = await onSignUp(email.trim(), password, code.trim().toUpperCase(), as)
        if (!signedIn) {
          setNotice('Account created. Open the confirmation email, then come back and sign in.')
          setMode('signin')
        }
      }
    } catch (err) {
      setError((err as Error).message || "Couldn't sign in. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="login" onSubmit={submit} noValidate>
      <div className="mosaic" aria-hidden="true">
        <div className="mosaic-grid">
          {Array.from({ length: 4 }, (_, col) => (
            <div key={col} className={col % 2 ? 'col2' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: 4 }, (_, row) => {
                const src = posters[col * 4 + row]
                return src ? (
                  <img key={row} src={src} alt="" style={{ animationDelay: `${(col + row) * 60}ms` }} />
                ) : (
                  <div key={row} className="ph" />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="login-body">
      <div className="logo" aria-hidden="true">
        <Icon name="tv" size={32} stroke={2.2} />
      </div>
      <h1>
        Pititi <span className="grad-text">Watchers</span>
      </h1>
      <p className="tagline">Everything your family watches. Rated, remembered, together.</p>

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
        <>
          <label className="stack-field">
            <span className="muted">Invite code</span>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase())
                setOptions(null)
                setError(null)
              }}
              placeholder="A1B2C3D4"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={12}
            />
            {checking && <span className="muted small">Checking…</span>}
            {!checking && options && !options.valid && (
              <span className="error small">That code isn't right. Check Settings → Invite code on a family member's phone.</span>
            )}
          </label>

          {codeOk && (
            <div className="stack-field">
              <span className="muted">I'm</span>
              <div className="chips" role="radiogroup" aria-label="Who are you">
                {options!.profiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={pick === p.id}
                    className={pick === p.id ? 'on' : ''}
                    onClick={() => setPick(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
                <button
                  type="button"
                  role="radio"
                  aria-checked={pick === NEW}
                  className={pick === NEW ? 'on' : ''}
                  onClick={() => setPick(NEW)}
                >
                  Someone new
                </button>
              </div>
              {pick === NEW && (
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={30} aria-label="Your name" />
              )}
            </div>
          )}
        </>
      )}

      <label className="stack-field">
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
      <label className="stack-field">
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
      </div>
    </form>
  )
}
