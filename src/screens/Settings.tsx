import { useEffect, useState, type FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { checkForUpdate, versionLabel } from '../updates'
import type { Session } from '../store/store'
import { getThemePref, setThemePref, type ThemePref } from '../theme'
import type { Household, Person, Watch } from '../types'
import { FamilyAdmin } from '../components/FamilyAdmin'
import { hourLabel } from '../lib/hours'
import { Problems } from '../components/Problems'
import { PasswordSheet } from '../components/PasswordSheet'
import type { ProblemReport } from '../store/cloud'
import { setFestivePref, useFestivePref } from '../useFestive'
import { getLang, setLang, t } from '../i18n'

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
  /** Settings → Family & invites */
  onOpenFamily?: () => void
  /** Viewer invite (see + chat only) and switching someone between viewer and member */
  loadViewerInvite?: (() => Promise<string | null>) | null
  onSetViewer?: (id: string, viewer: boolean) => Promise<void>
  /** Push notifications switch (null when there's no sync) */
  notify?: { state: 'on' | 'off' | 'unsupported' | 'install' | 'denied'; onEnable: () => void; onDisable: () => void } | null
  /** Households (after migration 008): the family view is organized by household */
  households?: Household[]
  /** Who's using the app (works in single-phone mode too) */
  meId?: string | null
  /** Your evening reminder hour (null = off) */
  evening?: { hour: number | null; onChange: (hour: number | null) => void } | null
  /** Admin: problems reported from family phones */
  problems?: { load: () => Promise<ProblemReport[]>; clear: () => Promise<void> } | null
  admin?: {
    onAddHousehold: (name: string) => Promise<string | null>
    onUpdateHousehold: (h: Household) => Promise<void>
    onMovePerson: (personId: string, householdId: string | null) => Promise<void>
    onAddPerson: (name: string, householdId: string | null) => Promise<void>
    householdCode: (id: string) => Promise<string | null>
  }
  /** Settings has no tab of its own; this returns to where you came from */
  onBack?: () => void
  onOpenHelp?: () => void
  /** Signed in with an account: change your own password (checks the current one first) */
  onChangePassword?: ((current: string, next: string) => Promise<void>) | null
}

const APP_URL = 'https://ls693600.github.io/pititi-watchers/'

export function Settings({ mode, session, isAdmin, people, watches, onAddPerson, loadInvite, renewInvite, onSignOut, view, onOpenSettings, onOpenFamily, notify, onBack, onOpenHelp, loadViewerInvite, onSetViewer, households = [], admin, meId, problems, evening, onChangePassword }: Props) {
  const [pwOpen, setPwOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemePref>(getThemePref)
  const [viewerCode, setViewerCode] = useState<string | null>(null)
  const festiveOn = useFestivePref()
  const [update, setUpdate] = useState<'idle' | 'checking' | 'latest' | 'updating' | 'offline'>('idle')

  async function checkUpdates() {
    setUpdate('checking')
    setUpdate(await checkForUpdate())
  }

  useEffect(() => {
    if (!isAdmin || !loadViewerInvite) return
    loadViewerInvite()
      .then(setViewerCode)
      .catch(() => setViewerCode(null))
  }, [loadViewerInvite, isAdmin])

  async function shareViewerInvite() {
    if (!viewerCode) return
    const link = `${APP_URL}?invite=${encodeURIComponent(viewerCode)}`
    const text = t('Take a look at our Pititi Watchers (you can see our shows and chat with us). Open {link}\niPhone: in Safari tap Share → Add to Home Screen.\nAndroid: in Chrome tap ⋮ → Add to Home screen.\nThen create your account (code {code}, already filled in).', { link, code: viewerCode })
    try {
      if (navigator.share) await navigator.share({ title: 'Pititi Watchers', text })
      else {
        await navigator.clipboard.writeText(text)
        setInviteMsg(t('Viewer invite copied. Paste it in a message.'))
      }
    } catch {
      // Share sheet dismissed
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    loadInvite?.()
      .then(setCode)
      .catch(() => setInviteMsg(t("Couldn't load the invite code. Check your connection.")))
  }, [loadInvite, isAdmin])

  const me = people.find((p) => p.id === session?.personId)

  async function add(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setError(t('Enter a name.'))
    if (n.length > 30) return setError(t('Keep the name under 30 characters.'))
    if (people.some((p) => p.name.toLowerCase() === n.toLowerCase())) return setError(t('{name} is already in the family.', { name: n }))
    setBusy(true)
    setError(null)
    try {
      await onAddPerson(n)
      setName('')
    } catch {
      setError(t("Couldn't add them. Check your connection and try again."))
    } finally {
      setBusy(false)
    }
  }

  async function shareInvite() {
    if (!code) return
    const link = `${APP_URL}?invite=${encodeURIComponent(code)}`
    const text = t('Join our Pititi Watchers! Open {link}\niPhone: in Safari tap Share → Add to Home Screen.\nAndroid: in Chrome tap ⋮ → Add to Home screen.\nThen create your account (invite code {code}, already filled in).', { link, code })
    try {
      if (navigator.share) await navigator.share({ title: 'Pititi Watchers', text })
      else {
        await navigator.clipboard.writeText(text)
        setInviteMsg(t('Invite copied. Paste it in a message.'))
      }
    } catch {
      // Share sheet dismissed
    }
  }

  async function renew() {
    if (!renewInvite || !confirm(t('Make a new invite code? The old code stops working for new accounts.'))) return
    try {
      setCode(await renewInvite())
      setInviteMsg(t('New code ready. Existing accounts are not affected.'))
    } catch {
      setInviteMsg(t("Couldn't change the code. Try again."))
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
        {onBack && (
          <button className="icon-btn" aria-label={t('Back')} onClick={onBack} style={{ marginRight: 4 }}>
            <Icon name="left" size={20} />
          </button>
        )}
        <div style={{ flex: 1 }}>
          <p className="eyebrow">{view === 'family' ? t('Who watches with you') : t('Your account')}</p>
          <h1 className="title-xl">{view === 'family' ? t('Family') : t('Settings')}</h1>
        </div>
        {view === 'family' && onOpenSettings && (
          <button className="icon-btn" aria-label={t('Settings')} onClick={onOpenSettings}>
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
              <Icon name="crown" size={12} stroke={2.4} /> {t('Admin')}
            </span>
          )}
        </section>
      )}

      {view === 'family' && households.length > 0 && admin && onSetViewer && (
        <FamilyAdmin
          people={people}
          households={households}
          me={me ?? people.find((p) => p.id === meId)}
          isAdmin={isAdmin}
          viewerCode={viewerCode}
          onSetViewer={onSetViewer}
          {...admin}
        />
      )}

      {view === 'family' && !(households.length > 0 && admin) && (
      <>
      <h2 className="h2">
        {t('Members')}
        <small>{people.length === 1 ? t('{n} person', { n: people.length }) : t('{n} people', { n: people.length })}</small>
      </h2>
      <section className="card">
        <ul>
          {people.map((p) => (
            <li key={p.id}>
              <div className="lrow">
                <Avatar people={people} id={p.id} size={38} />
                <span className="lrow-text">
                  <span className="lrow-title">
                    {p.name} {me?.id === p.id && <span className="you">{t('you')}</span>}
                  </span>
                  {p.isAdmin ? <span className="muted">{t('Admin')}</span> : p.isViewer ? <span className="muted">{t('Viewer · sees and chats')}</span> : null}
                </span>
                {isAdmin && onSetViewer && !p.isAdmin && p.userId ? (
                  <button
                    className={`badge ${p.isViewer ? 'viewer' : 'ok'}`}
                    onClick={() => {
                      const next = !p.isViewer
                      if (confirm(next ? t("Make {name} a viewer? They'll see everything and chat, but can't add or rate shows.", { name: p.name }) : t("Make {name} a full member? They'll be able to add, rate and edit shows.", { name: p.name })))
                        onSetViewer(p.id, next)
                    }}
                    aria-label={p.isViewer ? t('{name}: viewer. Change', { name: p.name }) : t('{name}: member. Change', { name: p.name })}
                  >
                    {p.isViewer ? t('Viewer') : t('Member')}
                  </button>
                ) : (
                  mode === 'cloud' && <span className={`badge ${p.userId ? 'ok' : ''}`}>{p.userId ? t('Joined') : t('Not joined')}</span>
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
                placeholder={t('Add someone, like Mom')}
                aria-label={t("New family member's name")}
                maxLength={30}
              />
              <button className="btn dark sm" type="submit" disabled={busy} style={{ minHeight: 46 }}>
                {busy ? t('Adding…') : t('Add')}
              </button>
            </form>
            {error && <p className="error" role="alert">{error}</p>}
            <p className="muted small" style={{ padding: '4px 0 14px' }}>
              {t('They can be picked in "Who watched?" right away, even without a phone.')}
            </p>
          </>
        ) : (
          <p className="muted small" style={{ padding: '4px 0 14px' }}>
            {t('{name} manages the family and invites.', { name: people.find((p) => p.isAdmin)?.name ?? t('The admin') })}
          </p>
        )}
      </section>

      {mode === 'cloud' && isAdmin && (
        <>
          <h2 className="h2">{t('Invite family')}</h2>
          <section className="card pad">
            <p className="muted" style={{ fontSize: 14.5 }}>
              {t('Share this code. They install the app, tap Create account, and enter it.')}
            </p>
            <div className="invite-code" aria-label={t('Invite code')}>{code ?? '········'}</div>
            <button className="btn primary block" onClick={shareInvite} disabled={!code}>
              <Icon name="share" size={18} /> {t('Share invite')}
            </button>
            {inviteMsg && <p className="ok small center" role="status" style={{ marginTop: 10 }}>{inviteMsg}</p>}
            <button className="btn ghost block" onClick={renew} disabled={!code} style={{ marginTop: 4 }}>
              {t('Make a new code')}
            </button>
          </section>
          {viewerCode && (
            <>
              <h2 className="h2">
                {t('Invite a viewer')}
                <small>{t('see + chat')}</small>
              </h2>
              <section className="card pad">
                <p className="muted" style={{ fontSize: 14.5 }}>
                  {t("For someone who wants to follow along, like a friend testing the app. They see your shows, ratings and stats, and can chat and react, but can't add, rate or change anything. You can make them a full member later.")}
                </p>
                <div className="invite-code" aria-label={t('Viewer invite code')}>{viewerCode}</div>
                <button className="btn primary block" onClick={shareViewerInvite}>
                  <Icon name="share" size={18} /> {t('Share viewer invite')}
                </button>
              </section>
            </>
          )}
        </>
      )}

      </>
      )}

      {view === 'account' && (
      <>
      {session && onChangePassword && (
        <section className="card">
          <button className="field" onClick={() => setPwOpen(true)} style={{ width: '100%' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="lock" size={18} /> {t('Change password')}
            </span>
            <span className="chev"><Icon name="right" size={20} /></span>
          </button>
        </section>
      )}
      {pwOpen && session && onChangePassword && (
        <PasswordSheet
          mode="change"
          email={session.email}
          onClose={() => setPwOpen(false)}
          onSave={async (current, next) => {
            await onChangePassword(current, next)
            setPwOpen(false)
          }}
        />
      )}
      {onOpenFamily && (
        <section className="card">
          <button className="field" onClick={onOpenFamily} style={{ width: '100%' }}>
            <span>{t('Family and invites')}</span>
            <span className="chev">
              <span className="stack" style={{ marginRight: 6 }}>
                {people.slice(0, 4).map((p) => (
                  <Avatar key={p.id} people={people} id={p.id} size={22} />
                ))}
              </span>
              <Icon name="right" size={20} />
            </span>
          </button>
          {evening && (
            <label className="field">
              <span>
                {t('Evening reminder')}
                <small className="muted" style={{ display: 'block', fontSize: 12.5 }}>
                  {t("Only on days you haven't marked anything")}
                </small>
              </span>
              <select
                className="move-select"
                value={evening.hour ?? ''}
                aria-label={t('Evening reminder')}
                onChange={(e) => evening.onChange(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">{t('Off')}</option>
                {[19, 20, 21, 22, 23].map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {notify && (
            <div className="field">
              <span>
                {t('Notifications')}
                <small className="muted" style={{ display: 'block', fontSize: 12.5 }}>
                  {notify.state === 'install'
                    ? t('Open Pititi from your home screen icon to turn on')
                    : notify.state === 'denied'
                      ? t('Blocked in your phone settings')
                      : notify.state === 'unsupported'
                        ? t('Not available in this browser')
                        : t('Messages, @mentions and new episodes')}
                </small>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={notify.state === 'on'}
                aria-label={t('Notifications')}
                className={`toggle ${notify.state === 'on' ? 'on' : ''}`}
                disabled={notify.state !== 'on' && notify.state !== 'off'}
                onClick={() => (notify.state === 'on' ? notify.onDisable() : notify.onEnable())}
              />
            </div>
          )}
        </section>
      )}

      <h2 className="h2">{t('App')}</h2>
      <section className="card">
        <div className="field">
          <span>{t('Appearance')}</span>
          <div className="segmented" role="radiogroup" aria-label={t('Appearance')}>
            {(['auto', 'light', 'dark'] as const).map((th) => (
              <button
                key={th}
                type="button"
                role="radio"
                aria-checked={theme === th}
                className={theme === th ? 'on' : ''}
                onClick={() => {
                  setTheme(th)
                  setThemePref(th)
                }}
              >
                {th === 'auto' ? t('Auto') : th === 'light' ? t('Light') : t('Dark')}
              </button>
            ))}
          </div>
        </div>
        {theme === 'auto' && <p className="muted small" style={{ marginTop: -6, paddingBottom: 10 }}>{t("Dark from 7 PM to 7 AM, when you're watching.")}</p>}
        <div className="field">
          <span>{t('Language')}</span>
          <div className="segmented" role="radiogroup" aria-label={t('Language')}>
            {(['en', 'pt'] as const).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={getLang() === l} className={getLang() === l ? 'on' : ''} lang={l === 'pt' ? 'pt-BR' : 'en'} onClick={() => setLang(l)}>
                {l === 'en' ? 'English' : 'Português'}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>
            {t('Festive looks')}
            <small className="muted" style={{ display: 'block', fontSize: 12.5 }}>{t('Halloween, Christmas, Carnaval and more change the colors for the day')}</small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={festiveOn}
            aria-label={t('Festive looks')}
            className={`toggle ${festiveOn ? 'on' : ''}`}
            onClick={() => setFestivePref(!festiveOn)}
          />
        </div>
        <div className="field">
          <span>{t('Sync')}</span>
          <span className={mode === 'cloud' ? 'ok' : 'muted'}>{mode === 'cloud' ? t('On · every family phone') : t('Off · this phone only')}</span>
        </div>
        <div className="field">
          <span>{t('Logged shows')}</span>
          <strong>{watches.length}</strong>
        </div>
        {onOpenHelp && (
          <button className="field" onClick={onOpenHelp} style={{ width: '100%' }}>
            <span>{t('Help and questions')}</span>
            <span className="chev"><Icon name="right" size={20} /></span>
          </button>
        )}
        <div className="field">
          <span>
            {t('Version')}
            <small className="muted" style={{ display: 'block', fontSize: 12.5 }}>
              {versionLabel()} · {__APP_SHA__}
            </small>
          </span>
          <button className="btn sm ghost-dark" onClick={checkUpdates} disabled={update === 'checking' || update === 'updating'}>
            {update === 'checking'
              ? t('Checking…')
              : update === 'updating'
                ? t('Updating…')
                : update === 'latest'
                  ? `✓ ${t('Up to date')}`
                  : update === 'offline'
                    ? t('Offline · try again')
                    : t('Check for updates')}
          </button>
        </div>
        <button className="field" onClick={exportBackup} disabled={watches.length === 0} style={{ width: '100%' }}>
          <span>{t('Export backup')}</span>
          <span className="chev"><Icon name="download" size={20} /></span>
        </button>
      </section>

      {isAdmin && problems && <Problems load={problems.load} clear={problems.clear} people={people} />}

      {session && (
        <button className="btn danger block" onClick={onSignOut}>
          <Icon name="logout" size={18} /> {t('Sign out')}
        </button>
      )}
      </>
      )}

      {view === 'account' && <p className="muted small center">{t('Show data from TVmaze')}</p>}
    </div>
  )
}
