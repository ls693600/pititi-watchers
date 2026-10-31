import { useCallback, useState } from 'react'
import { t } from '../i18n'
import { shrinkPhoto, tonight } from '../lib/photo'
import { isNetworkError } from '../store/outbox'
import { newId } from '../logic'
import type { Snapshot, Store } from '../store/store'
import type { CouchPhoto, Watch } from '../types'
import type { Flash } from './useToast'

/** Couch night photos: what's loaded, adding (shrunk on the phone first), removing, and putting back on Undo. */
export function usePhotos(store: Store, me: string | null, flash: Flash) {
  const [photos, setPhotos] = useState<CouchPhoto[]>([])
  /** Photos need migration 014; hidden until it's run */
  const [photosOn, setPhotosOn] = useState(false)
  /** Log ids with a photo on its way up */
  const [uploading, setUploading] = useState<string[]>([])

  const take = useCallback((snap: Partial<Pick<Snapshot, 'photos' | 'photosOn'>>) => {
    if (snap.photos) setPhotos(snap.photos)
    if (snap.photosOn !== undefined) setPhotosOn(snap.photosOn)
  }, [])

  async function add(w: Watch, file: File): Promise<boolean> {
    if (!me) return false
    setUploading((ids) => [...ids, w.id])
    try {
      const image = await shrinkPhoto(file).catch(() => {
        throw new Error(t("Couldn't read that photo. Try another one."))
      })
      const photo = await store.addPhoto({ id: newId(), watchId: w.id, personId: me, night: tonight(), createdAt: new Date().toISOString() }, image)
      setPhotos((list) => [photo, ...list.filter((p) => p.id !== photo.id)])
      flash(t('Photo added'))
      return true
    } catch (e) {
      flash(isNetworkError(e) ? t("Couldn't upload the photo. Check your connection.") : (e as Error).message || t("Couldn't upload the photo. Check your connection."))
      return false
    } finally {
      setUploading((ids) => ids.filter((id) => id !== w.id))
    }
  }

  async function remove(p: CouchPhoto): Promise<boolean> {
    setPhotos((list) => list.filter((x) => x.id !== p.id))
    try {
      await store.removePhoto(p)
      flash(t('Photo removed'))
      return true
    } catch (e) {
      setPhotos((list) => [p, ...list.filter((x) => x.id !== p.id)])
      flash((e as Error).message || t("Couldn't remove it. Check your connection."))
      return false
    }
  }

  /** A log's photos, kept so Undo on "remove show" can bring them back (the files stay). */
  const forWatch = (watchId: string) => photos.filter((p) => p.watchId === watchId)

  async function restore(list: CouchPhoto[]) {
    await Promise.all(list.map((p) => store.restorePhoto(p))).catch(() => undefined)
    setPhotos((cur) => [...list, ...cur.filter((p) => !list.some((x) => x.id === p.id))])
  }

  return { photos, photosOn, uploading, take, add, remove, forWatch, restore }
}
