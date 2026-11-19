import { useEffect, useRef, useState } from 'react'
import { useBackClose } from '../hooks/useBackClose'
import { t } from '../i18n'
import { baseType, extFor, pickMime, recordCanvas } from '../lib/recordCanvas'
import { livePlayback, primeAudio, renderSoundtrack, type LivePlayback } from '../lib/soundtrackAudio'
import { soundtrack } from '../soundtrack'
import { APP_URL } from '../config'
import { VIDEO_H, VIDEO_W, drawFrame, sceneImages, totalMs, videoScenes, type VideoData, type VideoImage } from '../yearVideo'
import { Icon } from './Icon'

type State = { step: 'loading' } | { step: 'recording'; pct: number } | { step: 'done'; file: File; url: string; poster: string } | { step: 'error' }

/** e2e tests make a short video: `window.__PITITI_VIDEO_SPEED__ = 10` (see src/yearVideo.ts) */
function speed(): number {
  const s = Number((window as { __PITITI_VIDEO_SPEED__?: unknown }).__PITITI_VIDEO_SPEED__)
  return Number.isFinite(s) && s > 0 ? s : 1
}

/**
 * Loads a poster or photo for drawing on the video canvas without "tainting" it (a tainted canvas can't be
 * recorded): fetch → blob → bitmap. Anything that fails (no CORS, offline, slow) is skipped, never fatal.
 */
async function loadImage(url: string, signal: AbortSignal): Promise<VideoImage | null> {
  const timeout = AbortSignal.timeout?.(8000)
  const any = timeout && 'any' in AbortSignal ? (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any([signal, timeout]) : signal
  try {
    const res = await fetch(url, { mode: 'cors', signal: any })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/') && blob.type !== '') return null
    if (typeof createImageBitmap === 'function') return await createImageBitmap(blob)
    // Older Safari: a same-origin blob URL is still safe for the canvas
    const src = URL.createObjectURL(blob)
    try {
      const img = new Image()
      img.src = src
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(src)
    }
  } catch {
    return null
  }
}

function download(file: File) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Big file: give the browser time to start saving it before letting go
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000)
}

/** Share sheet (WhatsApp is in it) when the phone can share files; otherwise saves the file. */
async function shareVideo(file: File, year: number, fallback: boolean): Promise<'shared' | 'saved' | 'cancelled' | 'blocked'> {
  const data = { files: [file], title: t('Our {year} on the couch', { year }), text: `${t('Our {month} on Pititi Watchers', { month: year })}\n${APP_URL}` }
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share(data)
      return 'shared'
    } catch (e) {
      const name = (e as Error).name
      if (name === 'AbortError') return 'cancelled'
      // Too long since the tap (making the video takes ~20 s): the "Share video" button asks again
      if (name === 'NotAllowedError' && !fallback) return 'blocked'
    }
  }
  if (!fallback) return 'blocked'
  download(file)
  return 'saved'
}

interface Props {
  data: VideoData
  /** What the person tapped: share it when ready, or save it */
  intent: 'share' | 'save'
  onClose: () => void
  onFlash: (msg: string) => void
  /** The picture card, offered if the video can't be made */
  onPicture?: () => void
}

/** Makes the year video on the phone with a live preview, progress and Cancel, then shares or saves it. */
export function YearVideo({ data, intent, onClose, onFlash, onPicture }: Props) {
  useBackClose(true, onClose)
  const canvas = useRef<HTMLCanvasElement>(null)
  const firstBtn = useRef<HTMLButtonElement>(null)
  const [state, setState] = useState<State>({ step: 'loading' })
  const [attempt, setAttempt] = useState(0)
  /** The phone's speaker while it's being made (the video always has the music) */
  const [sound, setSound] = useState(true)
  const live = useRef<LivePlayback | null>(null)
  const soundRef = useRef(sound)
  useEffect(() => {
    soundRef.current = sound
    live.current?.setMonitor(sound)
  }, [sound])
  const canShareFiles = state.step === 'done' && !!navigator.canShare?.({ files: [state.file] })

  // The effect reads these when it runs; a new attempt (Try again) starts it over
  const latest = useRef({ data, intent, onFlash })
  useEffect(() => {
    latest.current = { data, intent, onFlash }
  })

  useEffect(() => {
    const { data, intent, onFlash } = latest.current
    const ctl = new AbortController()
    let url = ''
    ;(async () => {
      setState({ step: 'loading' })
      const k = speed()
      const scenes = videoScenes(data, { speed: k })
      const urls = sceneImages(scenes)
      // The music is written while the pictures load; no music (old phone, no Web Audio) never stops the video
      const [loaded, music] = await Promise.all([Promise.all(urls.map((u) => loadImage(u, ctl.signal))), renderSoundtrack(soundtrack(scenes, k)).catch(() => null)])
      if (ctl.signal.aborted) return
      const images = new Map<string, VideoImage>()
      urls.forEach((u, i) => loaded[i] && images.set(u, loaded[i]))
      const el = canvas.current
      const ctx = el?.getContext('2d')
      const silentMime = pickMime()
      if (!el || !ctx || !silentMime) return setState({ step: 'error' })
      setState({ step: 'recording', pct: 0 })
      const record = (mime: string, audio: LivePlayback | null) =>
        recordCanvas(el, {
          durationMs: totalMs(scenes),
          mime,
          signal: ctl.signal,
          audio: audio ?? undefined,
          draw: (ms) => drawFrame(ctx, scenes, ms, images, k),
          onProgress: (p) => setState((s) => (s.step === 'recording' && Math.round(p * 100) !== s.pct ? { step: 'recording', pct: Math.round(p * 100) } : s)),
        })
      const avMime = music ? pickMime(undefined, true) : null
      const audio = music && avMime ? livePlayback(music, soundRef.current) : null
      live.current = audio
      let mime = audio && avMime ? avMime : silentMime
      let blob: Blob
      try {
        blob = await record(mime, audio)
      } catch (e) {
        // This phone can't put sound in the video: make it without music rather than not at all
        if ((e as Error)?.name === 'AbortError' || !audio) throw e
        audio.stop()
        live.current = null
        mime = silentMime
        setState({ step: 'recording', pct: 0 })
        blob = await record(mime, null)
      } finally {
        live.current?.stop()
        live.current = null
      }
      const file = new File([blob], `pititi-${data.year}.${extFor(mime)}`, { type: baseType(mime) })
      url = URL.createObjectURL(file)
      // The preview's cover: the title frame once everything has arrived (the very first frame is empty)
      drawFrame(ctx, scenes, scenes[0].ms * 0.75, images, k)
      let poster = ''
      try {
        poster = el.toDataURL('image/jpeg', 0.8)
      } catch {
        // No cover: the player shows its own
      }
      setState({ step: 'done', file, url, poster })
      if (intent === 'save') {
        download(file)
        onFlash(t('Video saved. Send it from your photos or files.'))
      } else {
        const how = await shareVideo(file, data.year, false)
        if (how === 'shared') onFlash(t('Video shared'))
      }
    })().catch((e: Error) => {
      if (e?.name !== 'AbortError') setState({ step: 'error' })
    })
    return () => {
      ctl.abort()
      live.current?.stop()
      live.current = null
      if (url) URL.revokeObjectURL(url)
    }
  }, [attempt])

  // Escape closes (and cancels); focus goes to the panel's first button (the opener gets it back on close)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    firstBtn.current?.focus()
  }, [state.step])

  const pct = state.step === 'recording' ? state.pct : 0
  // Screen readers hear every 10%, not every frame
  const spoken = Math.floor(pct / 10) * 10

  return (
    <div className="yv" role="dialog" aria-modal="true" aria-label={t('Year video')} onClick={(e) => e.stopPropagation()}>
      <div className="yv-frame">
        <canvas ref={canvas} width={VIDEO_W} height={VIDEO_H} className="yv-canvas" hidden={state.step === 'done'} aria-label={t('Video preview')} role="img" />
        {state.step === 'done' && <video className="yv-canvas" src={state.url} poster={state.poster || undefined} controls playsInline preload="metadata" aria-label={t('Video preview')} />}
      </div>

      {(state.step === 'loading' || state.step === 'recording') && (
        <div className="yv-panel">
          <p className="yv-status" role="status" aria-live="polite">
            {state.step === 'loading' ? t('Getting the pictures ready…') : t('Making your video… {n}%', { n: spoken })}
          </p>
          <div className="yv-bar" role="progressbar" aria-label={t('Video progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="yv-row">
            <button className="yv-btn ghost" aria-pressed={sound} onClick={() => setSound((on) => !on)}>
              <Icon name={sound ? 'volume' : 'mute'} size={18} /> {sound ? t('Sound on') : t('Sound off')}
            </button>
            <button ref={firstBtn} className="yv-btn ghost" onClick={onClose}>
              {t('Cancel')}
            </button>
          </div>
        </div>
      )}

      {state.step === 'done' && (
        <div className="yv-panel">
          <p className="yv-status" role="status" aria-live="polite">
            <Icon name="check" size={18} stroke={2.6} /> {t('Your video is ready')}
          </p>
          {canShareFiles && (
            <button
              ref={firstBtn}
              className="yv-btn primary"
              onClick={async () => {
                const how = await shareVideo(state.file, data.year, true)
                if (how === 'shared') onFlash(t('Video shared'))
                if (how === 'saved') onFlash(t('Video saved. Send it from your photos or files.'))
              }}
            >
              <Icon name="share" size={18} /> {t('Share video')}
            </button>
          )}
          <button
            ref={canShareFiles ? undefined : firstBtn}
            className={`yv-btn ${canShareFiles ? 'ghost' : 'primary'}`}
            onClick={() => {
              download(state.file)
              onFlash(t('Video saved. Send it from your photos or files.'))
            }}
          >
            <Icon name="download" size={18} /> {t('Save video')}
          </button>
          <button className="yv-btn ghost" onClick={onClose}>
            {t('Done')}
          </button>
        </div>
      )}

      {state.step === 'error' && (
        <div className="yv-panel">
          <p className="yv-status" role="alert">
            {t("Couldn't make the video. Try again, or share a picture instead.")}
          </p>
          <button ref={firstBtn} className="yv-btn primary" onClick={() => {
              primeAudio()
              setAttempt((n) => n + 1)
            }}>
            {t('Try again')}
          </button>
          {onPicture && (
            <button
              className="yv-btn ghost"
              onClick={() => {
                onClose()
                onPicture()
              }}
            >
              <Icon name="share" size={18} /> {t('Share a picture')}
            </button>
          )}
          <button className="yv-btn ghost" onClick={onClose}>
            {t('Close')}
          </button>
        </div>
      )}
    </div>
  )
}
