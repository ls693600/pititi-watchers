import { PEOPLE } from '../config'
import type { Session } from '../store/store'
import type { Watch } from '../types'

interface Props {
  mode: 'local' | 'cloud'
  session: Session | null
  watches: Watch[]
  onSignOut: () => void
}

export function Settings({ mode, session, watches, onSignOut }: Props) {
  function exportBackup() {
    const blob = new Blob([JSON.stringify(watches, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `couchlog-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const me = PEOPLE.find((p) => p.id === session?.person)

  return (
    <div className="screen">
      <h1 className="screen-title">Settings</h1>

      <section className="card">
        <div className="field">
          <span>Sync</span>
          <span className={mode === 'cloud' ? 'ok' : 'muted'}>{mode === 'cloud' ? 'On · both phones' : 'Off · this phone only'}</span>
        </div>
        {session && (
          <div className="field">
            <span>Signed in as</span>
            <span className="muted">{me?.name} · {session.email}</span>
          </div>
        )}
        {mode === 'local' && (
          <p className="muted small">
            Your log is saved on this phone only. To sync with {PEOPLE[1].name}, connect Supabase (steps in the README).
          </p>
        )}
      </section>

      <section className="card">
        <div className="field">
          <span>Logged shows</span>
          <strong>{watches.length}</strong>
        </div>
        <button className="btn block" onClick={exportBackup} disabled={watches.length === 0}>
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
