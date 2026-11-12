import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { jobLate, timeAgo } from '../logic'
import type { JobRun } from '../store/cloud'

/** Admin only: are the scheduled notifications running? Amber when one missed its slot (you also get one push). */
export function AppHealth({ load }: { load: () => Promise<JobRun[]> }) {
  const [runs, setRuns] = useState<JobRun[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    load()
      .then(setRuns)
      .catch(() => setFailed(true))
  }, [load])
  // Before migration 016 there's nothing to show
  if (failed) return null
  const label = (j: JobRun['job']) => (j === 'reminders' ? t('Daily reminders (21:00)') : t('Evening reminders (hourly)'))
  const late = (runs ?? []).filter((r) => jobLate(r.job, r.lastOk))

  return (
    <section className="card pad health" aria-labelledby="health-title">
      <div className="eps-head">
        <b id="health-title">{t('App health')}</b>
        <span className={late.length ? 'health-state warn' : 'health-state ok'}>
          {runs == null ? t('Checking…') : late.length ? t('Needs a look') : t('All good')}
        </span>
      </div>
      <ul className="health-rows">
        {(runs ?? []).map((r) => {
          const bad = jobLate(r.job, r.lastOk)
          return (
            <li key={r.job}>
              <span className={`health-dot ${bad ? 'warn' : 'ok'}`} aria-hidden="true" />
              <span className="health-text">
                <b>{label(r.job)}</b>
                <span className="muted">
                  {bad ? t('Late: last good run {when} ago', { when: timeAgo(r.lastOk) }) : t('Last good run {when} ago', { when: timeAgo(r.lastOk) })}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="muted small">{t('Checked every hour. If a job misses its slot, you get one notification.')}</p>
    </section>
  )
}
