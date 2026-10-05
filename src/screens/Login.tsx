import { useState, type FormEvent } from 'react'
import { PEOPLE } from '../config'

export function Login({ onSignIn }: { onSignIn: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return setError('Enter your email and password.')
    setBusy(true)
    setError(null)
    try {
      await onSignIn(email.trim(), password)
    } catch (err) {
      setError((err as Error).message || "Couldn't sign in. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="screen login" onSubmit={submit} noValidate>
      <div className="logo" aria-hidden="true">▶</div>
      <h1>CouchLog</h1>
      <p className="muted center">{PEOPLE.map((p) => p.name).join(' and ')}'s shows</p>
      <label className="stack">
        <span className="muted">Email</span>
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </label>
      <label className="stack">
        <span className="muted">Password</span>
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn primary block" type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
