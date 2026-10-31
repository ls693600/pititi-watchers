import { locale } from '../i18n'

/** Longest side of a saved photo, in pixels: sharp on a phone, ~200 KB as JPEG. */
const MAX_SIDE = 1280
const QUALITY = 0.8

/** The (width, height) to draw at so the longest side is at most `max`. */
export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  // Bitmaps follow the photo's rotation (EXIF); older Safari falls back to an <img>, which also does
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Fall through
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** A phone photo (any size, JPEG/PNG/HEIC as Safari hands it over) → a small JPEG for the family album. */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  const img = await decode(file)
  const { width, height } = fitWithin('naturalWidth' in img ? img.naturalWidth : img.width, 'naturalHeight' in img ? img.naturalHeight : img.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
  if ('close' in img) img.close()
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read the photo'))), 'image/jpeg', QUALITY))
}

/** Tonight, as the phone sees it (YYYY-MM-DD). Just after midnight still counts as the evening before. */
export function tonight(now = new Date()): string {
  const d = new Date(now)
  if (d.getHours() < 5) d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "Fri, Oct 31" in the app's language. */
export function nightLabel(night: string): string {
  return new Date(`${night}T12:00:00`).toLocaleDateString(locale(), { weekday: 'short', month: 'short', day: 'numeric' })
}
