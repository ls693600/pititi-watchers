import { useEffect, useState } from 'react'
import { getLang, t } from '../i18n'
import { RELEASE_NOTES } from '../releaseNotes'
import { Icon } from './Icon'

const SEEN = 'pititi.whatsnew.seen'

function seenId(): string | null {
  try {
    return localStorage.getItem(SEEN)
  } catch {
    return null
  }
}

/** Once after each update: what changed, on Home, until it's dismissed. */
export function WhatsNewCard() {
  const latest = RELEASE_NOTES[0]
  const [open, setOpen] = useState(() => latest != null && seenId() !== latest.id)
  if (!open || !latest) return null
  const close = () => {
    try {
      localStorage.setItem(SEEN, latest.id)
    } catch {
      // Shows again next time: harmless
    }
    setOpen(false)
  }
  return (
    <section className="whatsnew" aria-labelledby="whatsnew-title">
      <div className="whatsnew-top">
        <span className="whatsnew-icon" aria-hidden="true"><Icon name="sparkle" size={18} stroke={2.2} /></span>
        <h2 id="whatsnew-title">{t("What's new in Pititi")}</h2>
        <button className="icon-btn" aria-label={t('Close')} onClick={close}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <ul>
        {(getLang() === 'pt' ? latest.pt : latest.en).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <button className="btn sm primary" onClick={close}>{t('Got it')}</button>
    </section>
  )
}

/** Settings → What's new: every release, newest first. */
export function WhatsNewSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const pt = getLang() === 'pt'
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={t("What's new")}>
      <button className="sheet-dim" aria-label={t('Close')} onClick={onClose} />
      <div className="sheet">
        <div className="grabber" aria-hidden="true" />
        <div className="topbar" style={{ paddingTop: 0 }}>
          <h2 className="sheet-title">{t("What's new")}</h2>
          <button className="icon-btn" aria-label={t('Close')} onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>
        {RELEASE_NOTES.map((n) => (
          <section key={n.id} className="whatsnew-release">
            <p className="label-sm">{new Date(`${n.id}T12:00:00`).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'long' })}</p>
            <ul>
              {(pt ? n.pt : n.en).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
