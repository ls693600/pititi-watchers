// Records an animated canvas into a video file on the phone: canvas.captureStream + MediaRecorder, no audio.
// MP4 first (WhatsApp plays it everywhere; iPhone Safari and recent Chrome make it), WebM otherwise.

export const VIDEO_TYPES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'] as const

/** The first video type this browser can record, or null. `isTypeSupported` is injectable for tests. */
export function pickMime(isTypeSupported?: (type: string) => boolean): string | null {
  const check = isTypeSupported ?? (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function' ? (x: string) => MediaRecorder.isTypeSupported(x) : null)
  if (!check) return null
  for (const type of VIDEO_TYPES) {
    try {
      if (check(type)) return type
    } catch {
      // Some browsers throw on codecs they don't know: try the next one
    }
  }
  return null
}

/** "video/mp4;codecs=…" → "video/mp4": what the file says it is. */
export function baseType(mime: string): string {
  return mime.split(';')[0].trim()
}

export function extFor(mime: string): 'mp4' | 'webm' {
  return baseType(mime) === 'video/mp4' ? 'mp4' : 'webm'
}

/** Can this browser make a video from a canvas at all? */
export function canRecordCanvas(): boolean {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return false
  if (typeof HTMLCanvasElement === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') return false
  return pickMime() != null
}

export interface RecordOptions {
  /** Length of the video */
  durationMs: number
  /** Paints the frame for `ms` into the video */
  draw: (ms: number) => void
  mime: string
  fps?: number
  /** 0–1 while recording */
  onProgress?: (done: number) => void
  signal?: AbortSignal
}

const abortError = () => new DOMException('Cancelled', 'AbortError')

/**
 * Plays the animation in real time on `canvas` while MediaRecorder captures it. Resolves with the video,
 * rejects with an AbortError on cancel, or an Error if the browser fails or produces an empty file.
 */
export function recordCanvas(canvas: HTMLCanvasElement, opts: RecordOptions): Promise<Blob> {
  const fps = opts.fps ?? 30
  return new Promise<Blob>((resolve, reject) => {
    if (opts.signal?.aborted) return reject(abortError())
    let stream: MediaStream
    let recorder: MediaRecorder
    try {
      opts.draw(0)
      stream = canvas.captureStream(fps)
      // ~6 Mbps keeps 1080×1920 text sharp; a 20 s video stays around 10–15 MB
      recorder = new MediaRecorder(stream, { mimeType: opts.mime, videoBitsPerSecond: 6_000_000 })
    } catch (e) {
      return reject(e instanceof Error ? e : new Error(String(e)))
    }
    const chunks: Blob[] = []
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    let failed: Error | null = null
    const stopTracks = () => stream.getTracks().forEach((tr) => tr.stop())
    const finish = () => {
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onAbort)
      if (recorder.state !== 'inactive') {
        try {
          recorder.requestData()
        } catch {
          // Not all browsers allow it right before stop; stop() flushes anyway
        }
        recorder.stop()
      }
    }
    const onAbort = () => {
      cancelled = true
      finish()
    }
    opts.signal?.addEventListener('abort', onAbort)
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data)
    }
    recorder.onerror = (e) => {
      failed = (e as Event & { error?: Error }).error ?? new Error('Recording failed')
      finish()
    }
    recorder.onstop = () => {
      stopTracks()
      if (cancelled) return reject(abortError())
      if (failed) return reject(failed)
      const blob = new Blob(chunks, { type: baseType(opts.mime) })
      if (!blob.size) return reject(new Error('Empty video'))
      resolve(blob)
    }

    // Frames follow the real clock (the recording is real time); a timer keeps going when rAF would pause
    const t0 = performance.now()
    const tick = () => {
      if (cancelled || failed) return
      const ms = Math.min(performance.now() - t0, opts.durationMs)
      try {
        opts.draw(ms)
      } catch (e) {
        failed = e instanceof Error ? e : new Error(String(e))
        return finish()
      }
      // captureStream(fps) only sends frames when the canvas changes; ask for one explicitly where supported
      const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void }
      track?.requestFrame?.()
      opts.onProgress?.(ms / opts.durationMs)
      if (ms >= opts.durationMs) {
        // Hold the last frame a moment so players don't cut it off
        timer = setTimeout(finish, 250)
        return
      }
      timer = setTimeout(tick, 1000 / fps)
    }
    recorder.start(500)
    tick()
  })
}
