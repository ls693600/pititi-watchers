// Turns the planned soundtrack (src/soundtrack.ts) into sound: rendered offline into one buffer
// (fast, exact timing), then played live into the video recording and, quietly, the phone's speaker.
import type { Note, Track } from '../soundtrack'

type Ctx = BaseAudioContext

/** White noise, made once per render (drums, risers) */
function noiseBuffer(ctx: Ctx, sec: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * sec)), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

/** Attack, hold, release on a gain node: no clicks at the start or the end of a note */
function envelope(g: GainNode, at: number, dur: number, peak: number, attack: number, release: number) {
  const end = at + dur
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(peak, at + Math.min(attack, dur / 2))
  g.gain.setValueAtTime(peak, Math.max(at + attack, end - release))
  g.gain.linearRampToValueAtTime(0, end)
}

function osc(ctx: Ctx, type: OscillatorType, freq: number, at: number, dur: number, out: AudioNode, detune = 0) {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  o.detune.setValueAtTime(detune, at)
  o.connect(out)
  o.start(at)
  o.stop(at + dur + 0.05)
  return o
}

function play(ctx: Ctx, n: Note, out: AudioNode, noise: AudioBuffer) {
  const g = ctx.createGain()
  g.connect(out)
  const { at, dur, freq, gain } = n
  switch (n.voice) {
    case 'pad': {
      // Two detuned soft saws through a low filter: warm, slow in and out
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.setValueAtTime(900, at)
      f.connect(g)
      envelope(g, at, dur, gain, Math.min(0.6, dur / 3), Math.min(0.8, dur / 3))
      osc(ctx, 'sawtooth', freq, at, dur, f, -7)
      osc(ctx, 'triangle', freq, at, dur, f, 7)
      break
    }
    case 'brass': {
      // Bright, swelling saws with the filter opening: the epic ending
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.setValueAtTime(600, at)
      f.frequency.exponentialRampToValueAtTime(3200, at + Math.min(0.5, dur / 2))
      f.connect(g)
      envelope(g, at, dur, gain, 0.12, Math.min(1, dur / 2))
      osc(ctx, 'sawtooth', freq, at, dur, f, -5)
      osc(ctx, 'sawtooth', freq, at, dur, f, 5)
      break
    }
    case 'pluck': {
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(gain, at + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
      osc(ctx, 'triangle', freq, at, dur, g)
      break
    }
    case 'stab': {
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.setValueAtTime(2400, at)
      f.connect(g)
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(gain, at + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
      osc(ctx, 'sawtooth', freq, at, dur, f)
      osc(ctx, 'square', freq / 2, at, dur, f)
      break
    }
    case 'bass': {
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.setValueAtTime(500, at)
      f.connect(g)
      envelope(g, at, dur, gain, 0.01, Math.min(0.08, dur / 3))
      osc(ctx, 'sawtooth', freq, at, dur, f)
      osc(ctx, 'sine', freq / 2, at, dur, g)
      break
    }
    case 'kick':
    case 'boom': {
      // A sine that drops in pitch fast: the thump. The boom is a long, deep one.
      const o = ctx.createOscillator()
      const start = n.voice === 'kick' ? 150 : 110
      const low = n.voice === 'kick' ? 45 : Math.max(30, freq || 40)
      const fall = n.voice === 'kick' ? 0.12 : 0.6
      const ring = n.voice === 'kick' ? Math.min(dur, 0.35) : Math.min(dur, 2.5)
      o.frequency.setValueAtTime(start, at)
      o.frequency.exponentialRampToValueAtTime(low, at + fall)
      g.gain.setValueAtTime(gain, at)
      g.gain.exponentialRampToValueAtTime(0.0001, at + ring)
      o.connect(g)
      o.start(at)
      o.stop(at + ring + 0.05)
      break
    }
    case 'snare':
    case 'hat':
    case 'crash':
    case 'riser': {
      const src = ctx.createBufferSource()
      src.buffer = noise
      src.loop = true
      const f = ctx.createBiquadFilter()
      if (n.voice === 'snare') {
        f.type = 'bandpass'
        f.frequency.setValueAtTime(1800, at)
        f.Q.setValueAtTime(0.8, at)
      } else if (n.voice === 'riser') {
        f.type = 'bandpass'
        f.Q.setValueAtTime(2, at)
        f.frequency.setValueAtTime(400, at)
        f.frequency.exponentialRampToValueAtTime(6000, at + dur)
      } else {
        f.type = 'highpass'
        f.frequency.setValueAtTime(n.voice === 'hat' ? 7000 : 4000, at)
      }
      src.connect(f)
      f.connect(g)
      if (n.voice === 'riser') {
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(gain, at + dur * 0.95)
        g.gain.linearRampToValueAtTime(0, at + dur)
      } else {
        const ring = n.voice === 'crash' ? Math.min(dur, 2.2) : dur
        g.gain.setValueAtTime(gain, at)
        g.gain.exponentialRampToValueAtTime(0.0001, at + ring)
      }
      if (n.voice === 'snare') osc(ctx, 'triangle', 190, at, Math.min(dur, 0.1), g)
      src.start(at, Math.random() * 0.5)
      src.stop(at + dur + 0.05)
      break
    }
  }
}

/** The whole soundtrack as one stereo buffer. Throws where the browser has no Web Audio. */
export async function renderSoundtrack(track: Track, sampleRate = 44_100): Promise<AudioBuffer> {
  const OAC = (globalThis.OfflineAudioContext ?? (globalThis as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext) as typeof OfflineAudioContext | undefined
  if (!OAC) throw new Error('No Web Audio')
  const length = Math.max(1, Math.ceil((track.durationSec + 0.3) * sampleRate))
  const ctx = new OAC(2, length, sampleRate)
  // Master: a gentle compressor glues it together and keeps it from clipping; the end fades out
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.setValueAtTime(-14, 0)
  comp.ratio.setValueAtTime(4, 0)
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.7, 0)
  const fadeFrom = Math.max(0, track.durationSec - track.fadeSec)
  master.gain.setValueAtTime(0.7, fadeFrom)
  master.gain.linearRampToValueAtTime(0, track.durationSec)
  comp.connect(master)
  master.connect(ctx.destination)
  const noise = noiseBuffer(ctx, 1)
  for (const n of track.notes) play(ctx, n, comp, noise)
  return ctx.startRendering()
}

// ---- Playing it live ----

let shared: AudioContext | null = null

/**
 * Call from the tap that opens the video: iPhones only allow sound from a tap, so the audio is
 * switched on right there and kept for when the recording starts. Never throws.
 */
export function primeAudio(): void {
  try {
    const AC = (globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext | undefined
    if (!AC) return
    if (!shared || shared.state === 'closed') shared = new AC()
    if (shared.state === 'suspended') void shared.resume().catch(() => {})
  } catch {
    shared = null
  }
}

export interface LivePlayback {
  /** The music as a track for MediaRecorder */
  track: MediaStreamTrack
  /** Starts the music now (call when the recording starts) */
  start: () => void
  /** Speaker on/off; the recording always has the music */
  setMonitor: (on: boolean) => void
  stop: () => void
}

/** Plays the rendered music into a stream for the recording (and the speaker). Null when sound isn't available. */
export function livePlayback(buffer: AudioBuffer, monitor: boolean): LivePlayback | null {
  const ctx = shared
  if (!ctx || ctx.state === 'closed' || typeof ctx.createMediaStreamDestination !== 'function') return null
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  const dest = ctx.createMediaStreamDestination()
  const speaker = ctx.createGain()
  speaker.gain.value = monitor ? 0.6 : 0
  speaker.connect(ctx.destination)
  const track = dest.stream.getAudioTracks()[0]
  if (!track) return null
  let src: AudioBufferSourceNode | null = null
  return {
    track,
    start: () => {
      src = ctx.createBufferSource()
      src.buffer = buffer
      src.connect(dest)
      src.connect(speaker)
      src.start()
    },
    setMonitor: (on) => speaker.gain.setTargetAtTime(on ? 0.6 : 0, ctx.currentTime, 0.05),
    stop: () => {
      try {
        src?.stop()
      } catch {
        // Already stopped
      }
      src?.disconnect()
      speaker.disconnect()
      track.stop()
    },
  }
}

/** A finished buffer as a .wav file (used to make listening samples) */
export function toWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels
  const len = buf.length * ch * 2
  const out = new DataView(new ArrayBuffer(44 + len))
  const str = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  out.setUint32(4, 36 + len, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  out.setUint32(16, 16, true)
  out.setUint16(20, 1, true)
  out.setUint16(22, ch, true)
  out.setUint32(24, buf.sampleRate, true)
  out.setUint32(28, buf.sampleRate * ch * 2, true)
  out.setUint16(32, ch * 2, true)
  out.setUint16(34, 16, true)
  str(36, 'data')
  out.setUint32(40, len, true)
  const data = Array.from({ length: ch }, (_, i) => buf.getChannelData(i))
  let o = 44
  for (let i = 0; i < buf.length; i++)
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]))
      out.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      o += 2
    }
  return new Blob([out], { type: 'audio/wav' })
}
