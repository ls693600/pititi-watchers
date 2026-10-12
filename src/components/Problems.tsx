import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { timeAgo } from '../logic'
import type { ProblemReport } from '../store/cloud'
import type { Person } from '../types'

/** Admin only: what went wrong on family phones lately, grouped by problem. */
export function Problems({ load, clear, people }: { load: () => Promise<ProblemReport[]>; clear: () => Promise<void>; people: Person[] }) {
  const [list, setList] = useState<ProblemReport[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    load()
      .then(setList)
      .catch(() => setFailed(true))
  }, [load])

  if (failed) return null
  const groups = [...new Map((list ?? []).map((p) => [p.message, (list ?? []).filter((x) => x.message === p.message)])).values()]
  const phone = (ua: string) => (/iphone|ipad/i.test(ua) ? 'iPhone' : /android/i.test(ua) ? 'Android' : t('Computer'))

  return (
    <section className="card">
      <button className="field" style={{ width: '100%' }} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          {t('Problems reported')}
          <small className="muted" style={{ display: 'block', fontSize: 12.5 }}>
            {list == null ? t('Checking…') : groups.length ? t('{n} in the last 30 days', { n: list.length }) : t('None in the last 30 days 🎉')}
          </small>
        </span>
        {groups.length > 0 && <span className="badge-count">{groups.length}</span>}
      </button>
      {open && groups.length > 0 && (
        <ul className="problems">
          {groups.map((g) => {
            const last = g[0]
            const who = [...new Set(g.map((p) => people.find((x) => x.id === p.person_id)?.name).filter(Boolean))].join(', ')
            return (
              <li key={last.id}>
                <b>{last.message}</b>
                <small className="muted">
                  {g.length}× · {timeAgo(last.created_at)} · {last.screen || '–'} · {phone(last.user_agent)} · {last.version}
                  {who ? ` · ${who}` : ''}
                </small>
              </li>
            )
          })}
          <li>
            <button
              className="btn sm ghost-dark"
              onClick={async () => {
                await clear().catch(() => undefined)
                setList([])
              }}
            >
              {t('Clear all')}
            </button>
          </li>
        </ul>
      )}
    </section>
  )
}
