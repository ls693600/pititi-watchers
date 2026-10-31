import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { nightLabel } from '../lib/photo'
import type { CouchPhoto, Person } from '../types'
import { Icon } from './Icon'

/** A hidden file picker behind a button: the phone offers camera or library. */
export function PhotoPicker({ className, label, busy, onPick, children }: { className: string; label: string; busy: boolean; onPick: (f: File) => void; children: React.ReactNode }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <button type="button" className={className} aria-label={label} disabled={busy} aria-busy={busy || undefined} onClick={() => input.current?.click()}>
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        data-testid="photo-input"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onPick(f)
        }}
      />
    </>
  )
}

interface Props {
  photos: CouchPhoto[]
  people: Person[]
  me: string | null
  isAdmin: boolean
  /** Your household's log: you can add */
  canAdd: boolean
  uploading: boolean
  onAdd: (f: File) => void
  onRemove: (p: CouchPhoto) => Promise<boolean>
}

/** On a show's page: the photos of the nights you watched it. Tap one to see it big. */
export function CouchPhotos({ photos, people, me, isAdmin, canAdd, uploading, onAdd, onRemove }: Props) {
  const [open, setOpen] = useState<number | null>(null)
  const list = [...photos].sort((a, b) => b.night.localeCompare(a.night) || b.createdAt.localeCompare(a.createdAt))
  if (!list.length && !canAdd) return null
  const nameOf = (id: string) => (id === me ? t('You') : (people.find((p) => p.id === id)?.name ?? t('Someone')))

  return (
    <section className="card pad couch" aria-labelledby="couch-title">
      <div className="eps-head">
        <b id="couch-title">{t('Couch nights')}</b>
        {list.length > 0 && <span className="muted">{list.length === 1 ? t('1 photo') : t('{n} photos', { n: list.length })}</span>}
      </div>
      <div className="couch-strip">
        {canAdd && (
          <PhotoPicker className="couch-add" label={t('Add a photo of tonight')} busy={uploading} onPick={onAdd}>
            {uploading ? <span className="spinner" aria-hidden="true" /> : <Icon name="camera" size={22} />}
            <span>{uploading ? t('Uploading…') : list.length ? t('Add one') : t('Add a photo of tonight')}</span>
          </PhotoPicker>
        )}
        {list.map((p, i) => (
          <button key={p.id} type="button" className="couch-thumb" aria-label={t('Photo from {night} by {name}', { night: nightLabel(p.night), name: nameOf(p.personId) })} onClick={() => setOpen(i)}>
            <img src={p.url} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      {open != null && list[open] && (
        <PhotoViewer
          photos={list}
          index={open}
          nameOf={nameOf}
          canRemove={(p) => p.personId === me || isAdmin}
          onIndex={setOpen}
          onRemove={async (p) => {
            if (await onRemove(p)) setOpen(null)
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}

interface ViewerProps {
  photos: CouchPhoto[]
  index: number
  nameOf: (id: string) => string
  canRemove: (p: CouchPhoto) => boolean
  onIndex: (i: number) => void
  onRemove: (p: CouchPhoto) => void
  onClose: () => void
}

/** Full screen, one photo at a time. Remove asks twice (it can't be undone). */
export function PhotoViewer({ photos, index, nameOf, canRemove, onIndex, onRemove, onClose }: ViewerProps) {
  // Asked on this photo; moving to another one starts over
  const [confirmAt, setConfirmAt] = useState<number | null>(null)
  const confirm = confirmAt === index
  const p = photos[index]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndex(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos.length, onIndex, onClose])

  return (
    <div className="photo-view" role="dialog" aria-modal="true" aria-label={t('Photo from {night} by {name}', { night: nightLabel(p.night), name: nameOf(p.personId) })}>
      <button className="photo-close icon-btn" aria-label={t('Close')} onClick={onClose}>
        <Icon name="close" size={20} />
      </button>
      <img src={p.url} alt="" />
      <div className="photo-bar">
        <span>
          <b>{nameOf(p.personId)}</b> · {nightLabel(p.night)}
          {photos.length > 1 && <span className="muted"> · {index + 1}/{photos.length}</span>}
        </span>
        <span className="photo-actions">
          {photos.length > 1 && (
            <>
              <button className="icon-btn" aria-label={t('Previous photo')} disabled={index === 0} onClick={() => onIndex(index - 1)}>
                <Icon name="left" size={18} />
              </button>
              <button className="icon-btn" aria-label={t('Next photo')} disabled={index === photos.length - 1} onClick={() => onIndex(index + 1)}>
                <Icon name="right" size={18} />
              </button>
            </>
          )}
          {canRemove(p) && (
            <button className={`btn sm ${confirm ? 'danger' : 'ghost'}`} onClick={() => (confirm ? onRemove(p) : setConfirmAt(index))}>
              <Icon name="trash" size={16} /> {confirm ? t('Tap again to remove') : t('Remove')}
            </button>
          )}
        </span>
      </div>
    </div>
  )
}
