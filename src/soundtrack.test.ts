import { describe, expect, it } from 'vitest'
import { pickMime } from './lib/recordCanvas'
import { BPM, moodFor, soundtrack } from './soundtrack'

// A typical 20 s video: title, totals, top, episode, photos, outro
const scenes = [
  { kind: 'title' as const, start: 0, ms: 3000 },
  { kind: 'totals' as const, start: 3000, ms: 3800 },
  { kind: 'top' as const, start: 6800, ms: 4600 },
  { kind: 'episode' as const, start: 11400, ms: 3400 },
  { kind: 'photos' as const, start: 14800, ms: 3600 },
  { kind: 'outro' as const, start: 18400, ms: 2600 },
]
const beat = 60 / BPM

describe('soundtrack', () => {
  it('mixes the three moods: chill title, upbeat middle, epic outro', () => {
    expect(scenes.map((s) => moodFor(s.kind))).toEqual(['chill', 'lift', 'upbeat', 'upbeat', 'upbeat', 'epic'])
  })

  it('lasts exactly as long as the video and fades out at the end', () => {
    const tr = soundtrack(scenes)
    expect(tr.durationSec).toBe(21)
    expect(tr.fadeSec).toBeGreaterThan(0)
    expect(tr.notes.every((n) => n.at >= 0 && n.at + n.dur <= tr.durationSec + 1e-9)).toBe(true)
    expect(tr.notes.every((n) => n.gain > 0 && n.gain <= 1)).toBe(true)
  })

  it('no drums on the title: it starts calm', () => {
    const tr = soundtrack(scenes)
    const drums = tr.notes.filter((n) => ['kick', 'snare', 'hat'].includes(n.voice))
    expect(drums.filter((n) => n.at < 3 - beat * 1.01)).toEqual([])
    expect(tr.notes.some((n) => n.voice === 'pad' && n.at === 0)).toBe(true)
  })

  it('full beat in the middle: kick every beat, snare on 2 and 4', () => {
    const tr = soundtrack(scenes)
    const kicks = tr.notes.filter((n) => n.voice === 'kick' && n.at >= 6.8 && n.at < 18).map((n) => n.at)
    expect(kicks.length).toBeGreaterThanOrEqual(20)
    expect(tr.notes.some((n) => n.voice === 'snare' && n.at >= 7 && n.at < 18)).toBe(true)
  })

  it('the outro lands on one big chord with a boom and a crash, on the outro start', () => {
    const tr = soundtrack(scenes)
    const at18 = tr.notes.filter((n) => Math.abs(n.at - 18.4) < 1e-9)
    expect(at18.map((n) => n.voice)).toEqual(expect.arrayContaining(['boom', 'crash', 'brass']))
    expect(tr.notes.filter((n) => n.voice === 'brass').length).toBeGreaterThanOrEqual(4)
    // Nothing on the beat grid plays over the ending
    expect(tr.notes.filter((n) => n.at > 18.4 && n.voice === 'kick')).toEqual([])
    // A whoosh leads into it
    expect(tr.notes.some((n) => n.voice === 'riser' && n.at < 18.4 && n.at + n.dur > 17.5)).toBe(true)
  })

  it('a short year (no top shows, no photos) still goes calm → epic', () => {
    const short = [
      { kind: 'title' as const, start: 0, ms: 6000 },
      { kind: 'totals' as const, start: 6000, ms: 7000 },
      { kind: 'outro' as const, start: 13000, ms: 5000 },
    ]
    const tr = soundtrack(short)
    expect(tr.durationSec).toBe(18)
    expect(tr.notes.some((n) => n.voice === 'boom' && n.at === 13)).toBe(true)
  })

  it('plays faster with a faster video (tests), so it still lines up', () => {
    const fast = scenes.map((s) => ({ ...s, start: s.start / 10, ms: s.ms / 10 }))
    const tr = soundtrack(fast, 10)
    expect(tr.durationSec).toBeCloseTo(2.1)
    expect(tr.notes.some((n) => n.voice === 'boom' && Math.abs(n.at - 1.84) < 1e-9)).toBe(true)
    expect(tr.notes.every((n) => n.at + n.dur <= tr.durationSec + 1e-9)).toBe(true)
  })

  it('no scenes, no music', () => {
    expect(soundtrack([])).toEqual({ notes: [], durationSec: 0, fadeSec: 0 })
  })
})

describe('pickMime with sound', () => {
  it('asks for AAC in MP4 first, Opus in WebM otherwise', () => {
    expect(pickMime(() => true, true)).toBe('video/mp4;codecs=avc1.42E01E,mp4a.40.2')
    expect(pickMime((t) => t === 'video/mp4', true)).toBe('video/mp4')
    expect(pickMime((t) => t.includes('opus'), true)).toBe('video/webm;codecs=vp9,opus')
    expect(pickMime(() => false, true)).toBeNull()
  })
})
