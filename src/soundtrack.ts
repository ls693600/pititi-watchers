// The year video's music: one original track the app writes itself (no song files, nothing to license).
// It follows the video: chill on the title, it picks up on the totals, goes upbeat for the top shows,
// the episode and the photos, and lands on a big epic chord for the outro, then fades out.
// This file only plans the notes (pure, tested); src/lib/soundtrackAudio.ts turns them into sound.
import type { Scene } from './yearVideo'

export type Voice = 'pad' | 'pluck' | 'bass' | 'kick' | 'snare' | 'hat' | 'stab' | 'boom' | 'crash' | 'riser' | 'brass'
export type Mood = 'chill' | 'lift' | 'upbeat' | 'epic'

export interface Note {
  /** Seconds from the start of the video */
  at: number
  /** Seconds */
  dur: number
  voice: Voice
  /** Hz (drums ignore it) */
  freq: number
  /** 0–1 */
  gain: number
}

export interface Track {
  notes: Note[]
  /** Same length as the video */
  durationSec: number
  /** The last stretch fades to silence (seconds) */
  fadeSec: number
}

/** 120 beats a minute: a beat is half a second, a bar two seconds */
export const BPM = 120

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12)

/** Am – F – C – G, the classic singalong loop. Root (bass, MIDI) and the chord on top (MIDI). */
const CHORDS: { root: number; chord: number[] }[] = [
  { root: 45, chord: [57, 60, 64] }, // A minor
  { root: 41, chord: [57, 60, 65] }, // F
  { root: 48, chord: [55, 60, 64] }, // C
  { root: 43, chord: [55, 59, 62] }, // G
]
/** The ending chord: C major, wide */
const FINAL = { root: 36, chord: [48, 55, 60, 64, 67, 72] }

/** Which part of the music each scene gets */
export function moodFor(kind: Scene['kind']): Mood {
  if (kind === 'title') return 'chill'
  if (kind === 'totals') return 'lift'
  if (kind === 'outro') return 'epic'
  return 'upbeat'
}

/**
 * The whole track for these scenes. `speed` matches the video's (tests make a 10× shorter video,
 * so the music plays 10× faster too and still lines up).
 */
export function soundtrack(scenes: Pick<Scene, 'kind' | 'start' | 'ms'>[], speed = 1): Track {
  const k = speed > 0 ? speed : 1
  const last = scenes[scenes.length - 1]
  const durationSec = last ? (last.start + last.ms) / 1000 : 0
  const notes: Note[] = []
  if (!last) return { notes, durationSec, fadeSec: 0 }
  const beat = 60 / BPM / k
  const outro = scenes.find((s) => s.kind === 'outro')
  const epicAt = outro ? outro.start / 1000 : durationSec
  const moodAt = (sec: number): Mood => {
    const ms = sec * 1000
    const s = scenes.find((x) => ms < x.start + x.ms) ?? last
    return moodFor(s.kind)
  }
  const add = (at: number, dur: number, voice: Voice, freq: number, gain: number) => {
    if (at >= 0 && at < durationSec) notes.push({ at, dur: Math.min(dur, durationSec - at), voice, freq, gain })
  }

  // Everything before the outro runs on the beat grid
  const beats = Math.floor(epicAt / beat)
  for (let b = 0; b < beats; b++) {
    const at = b * beat
    const mood = moodAt(at)
    const inBar = b % 4
    const { root, chord } = CHORDS[Math.floor(b / 4) % CHORDS.length]
    const nextMood = moodAt(at + beat)

    // Warm pad under everything, one per bar
    if (inBar === 0) chord.forEach((n) => add(at, beat * 4, 'pad', midi(n), mood === 'chill' ? 0.11 : 0.07))

    // Arpeggio: soft eighths when chill, brighter when upbeat
    const arp = [chord[0], chord[1], chord[2], chord[1] + 12]
    for (let h = 0; h < 2; h++) {
      const n = arp[(inBar * 2 + h) % arp.length] + (mood === 'upbeat' ? 12 : 0)
      add(at + h * beat * 0.5, beat * 0.45, 'pluck', midi(n), mood === 'chill' ? 0.16 : mood === 'lift' ? 0.18 : 0.13)
    }

    if (mood === 'lift') {
      // Picking up: a soft kick on every beat and a bass that follows the chord
      add(at, beat, 'kick', 0, 0.38)
      add(at, beat * 0.9, 'bass', midi(root), 0.24)
      add(at + beat * 0.5, beat * 0.2, 'hat', 0, 0.1)
    }

    if (mood === 'upbeat') {
      // Four on the floor, snare on 2 and 4, eighth-note hats, driving bass, chord stabs
      add(at, beat, 'kick', 0, 0.85)
      if (inBar === 1 || inBar === 3) add(at, beat * 0.5, 'snare', 0, 0.55)
      add(at, beat * 0.15, 'hat', 0, 0.12)
      add(at + beat * 0.5, beat * 0.15, 'hat', 0, 0.2)
      add(at, beat * 0.45, 'bass', midi(root), 0.4)
      add(at + beat * 0.5, beat * 0.45, 'bass', midi(root + 12), 0.3)
      if (inBar === 0 || inBar === 2) chord.forEach((n) => add(at + beat * 0.5, beat * 0.35, 'stab', midi(n), 0.08))
    }

    // Into a new part: a whoosh, and a snare fill into the upbeat
    if (nextMood !== mood) {
      add(Math.max(0, at - beat * 3), beat * 4, 'riser', 0, nextMood === 'epic' ? 0.32 : 0.2)
      if (nextMood === 'upbeat' || nextMood === 'epic') for (let i = 0; i < 4; i++) add(at + i * beat * 0.25, beat * 0.2, 'snare', 0, 0.2 + i * 0.1)
    }
  }
  // The outro's riser and fill (the grid stops at the outro, so the last beat may not see the change)
  if (outro && beats > 0 && moodAt((beats - 1) * beat) !== 'epic' && !notes.some((n) => n.voice === 'riser' && Math.abs(n.at + n.dur - epicAt) < beat * 1.5)) {
    add(Math.max(0, epicAt - beat * 4), beat * 4, 'riser', 0, 0.32)
  }

  // The outro: one big chord with a boom and a crash, brass on top, ringing out to the end
  const ring = durationSec - epicAt
  if (ring > 0) {
    add(epicAt, ring, 'boom', midi(FINAL.root - 12), 1)
    add(epicAt, ring, 'crash', 0, 0.5)
    add(epicAt, ring, 'bass', midi(FINAL.root), 0.45)
    FINAL.chord.forEach((n) => add(epicAt, ring, 'brass', midi(n), 0.09))
    FINAL.chord.forEach((n) => add(epicAt, ring, 'pad', midi(n), 0.08))
  }
  notes.sort((a, b) => a.at - b.at)
  return { notes, durationSec, fadeSec: Math.min(1.5 / k, durationSec / 4) }
}
