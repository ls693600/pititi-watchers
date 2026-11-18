import { describe, expect, it } from 'vitest'
import { clip, sceneAt, sceneImages, totalMs, videoScenes, yearVideoData, TARGET_MS, type Scene } from './yearVideo'
import { baseType, extFor, pickMime, VIDEO_TYPES } from './lib/recordCanvas'
import type { CouchPhoto, EpisodeReaction, Person, Watch } from './types'

const L = 'p-l'
const A = 'p-a'
const people: Person[] = [
  { id: L, name: 'Leandro', userId: 'u1', isAdmin: true },
  { id: A, name: 'Ana', userId: 'u2', isAdmin: false },
] as Person[]

let n = 0
function watch(name: string, extra: Partial<Watch> = {}): Watch {
  n++
  return {
    id: `w-${n}`,
    kind: 'tv',
    householdId: 'h1',
    showId: 100 + n,
    showName: name,
    poster: `https://static.tvmaze.com/uploads/images/medium_portrait/${n}.jpg`,
    network: null,
    genres: ['Drama'],
    year: '2024',
    season: 1,
    episodesWatched: 5,
    totalEpisodes: 8,
    runtime: 50,
    month: '2026-10',
    status: 'watching',
    watchedBy: [L, A],
    ratings: {},
    isRewatch: false,
    notes: '',
    episodesByMonth: { '2026-10': 5 },
    createdBy: L,
    createdAt: '2026-10-01T20:00:00Z',
    updatedAt: '2026-10-01T20:00:00Z',
    ...extra,
  }
}

const photo = (id: string, watchId: string, night: string): CouchPhoto => ({ id, watchId, personId: L, path: `p/${id}`, night, createdAt: `${night}T22:00:00Z`, url: `https://photos.test/${id}.jpg` })
const react = (w: Watch, episode: number, personId: string, emoji: EpisodeReaction['emoji']): EpisodeReaction => ({ kind: 'tv', showId: w.showId, season: w.season, episode, personId, emoji, createdAt: '2026-10-02T21:00:00Z' })

function normalYear() {
  const bear = watch('The Bear', { ratings: { [L]: 9, [A]: 8 }, status: 'done' })
  const lioness = watch('Lioness', { ratings: { [L]: 8, [A]: 7 } })
  const seen = watch('Last Seen', { ratings: { [L]: 6, [A]: 8 } })
  const extra = watch('Severance')
  const movie = watch('Dune: Part Two', { kind: 'movie', episodesWatched: 1, totalEpisodes: 1, episodesByMonth: { '2026-09': 1 }, month: '2026-09', ratings: { [L]: 10, [A]: 10 }, runtime: 167 })
  const watches = [bear, lioness, seen, extra, movie]
  return {
    watches,
    bear,
    episodeReactions: [react(bear, 7, L, '🤯'), react(bear, 7, A, '😭')],
    photos: [photo('a', bear.id, '2026-10-01'), photo('b', bear.id, '2026-10-01'), photo('c', lioness.id, '2026-10-04'), photo('d', seen.id, '2026-09-12'), photo('e', seen.id, '2026-08-01')],
  }
}

const kinds = (s: Scene[]) => s.map((x) => x.kind)

describe('year video: data', () => {
  it('packs the totals, the top 3 (best average first), the episode of the year and up to 3 photos', () => {
    const y = normalYear()
    const d = yearVideoData({ year: 2026, people, ...y, now: new Date(2026, 11, 31) })
    expect(d.totals).toMatchObject({ series: 4, movies: 1 })
    expect(d.top.map((s) => s.name)).toEqual(['Dune: Part Two', 'The Bear', 'Lioness'])
    expect(d.top[1].avg).toBe(8.5)
    // Bigger posters for the video
    expect(d.top[1].poster).toContain('/original_untouched/')
    expect(d.episode).toMatchObject({ show: 'The Bear', label: 'S1 · E7', emojis: '🤯 😭' })
    // One per night, newest first: Oct 4, Oct 1 (one of two), Sep 12; 4 nights in total
    expect(d.photos).toEqual(['https://photos.test/c.jpg', expect.stringMatching(/photos\.test\/[ab]\.jpg/), 'https://photos.test/d.jpg'])
    expect(d.nights).toBe(4)
    expect(d.names).toBe('Leandro & Ana')
  })

  it('ignores photos from other years and logs that are not ours', () => {
    const y = normalYear()
    const d = yearVideoData({ year: 2026, people, watches: y.watches, photos: [photo('x', 'w-gone', '2026-10-01'), photo('y', y.bear.id, '2025-12-31')] })
    expect(d.photos).toEqual([])
    expect(d.nights).toBe(0)
  })
})

describe('year video: scenes', () => {
  it('a full year: title, totals, top 3, episode, photos, outro, about 20 seconds', () => {
    const y = normalYear()
    const scenes = videoScenes(yearVideoData({ year: 2026, people, ...y }))
    expect(kinds(scenes)).toEqual(['title', 'totals', 'top', 'episode', 'photos', 'outro'])
    expect(totalMs(scenes)).toBeGreaterThanOrEqual(19_000)
    expect(totalMs(scenes)).toBeLessThanOrEqual(21_000)
    const title = scenes[0] as Extract<Scene, { kind: 'title' }>
    expect(title.title).toBe('Our 2026 on the couch')
    const totals = scenes[1] as Extract<Scene, { kind: 'totals' }>
    expect(totals.stats.map((s) => s.label)).toEqual(['episodes', 'hours', 'shows', 'movie'])
    const top = scenes[2] as Extract<Scene, { kind: 'top' }>
    expect(top.kicker).toBe('Our top 3')
    expect(top.shows.map((s) => s.rank)).toEqual([1, 2, 3])
    expect(top.shows[0].score).toBe('10.0')
    expect(scenes.at(-1)).toMatchObject({ kind: 'outro', title: 'Made with Pititi' })
    // Scenes follow each other with no gaps
    scenes.forEach((s, i) => i && expect(s.start).toBe(scenes[i - 1].start + scenes[i - 1].ms))
    expect(scenes.every((s) => s.count === 6)).toBe(true)
  })

  it('no photos: the album scene is skipped and the rest stretches a little', () => {
    const y = normalYear()
    const scenes = videoScenes(yearVideoData({ year: 2026, people, ...y, photos: [] }))
    expect(kinds(scenes)).toEqual(['title', 'totals', 'top', 'episode', 'outro'])
    expect(totalMs(scenes)).toBeGreaterThan(16_000)
    expect(totalMs(scenes)).toBeLessThanOrEqual(TARGET_MS * 1.05)
  })

  it('no episode of the year: no episode scene', () => {
    const y = normalYear()
    const scenes = videoScenes(yearVideoData({ year: 2026, people, ...y, episodeReactions: [] }))
    expect(kinds(scenes)).toEqual(['title', 'totals', 'top', 'photos', 'outro'])
  })

  it('a single show: "Show of the year", no movies stat, never longer than 26 s', () => {
    const only = watch('Shrinking', { ratings: { [L]: 8, [A]: 9 } })
    const scenes = videoScenes(yearVideoData({ year: 2026, people, watches: [only] }))
    expect(kinds(scenes)).toEqual(['title', 'totals', 'top', 'outro'])
    const top = scenes[2] as Extract<Scene, { kind: 'top' }>
    expect(top.kicker).toBe('Show of the year')
    expect(top.shows).toHaveLength(1)
    const totals = scenes[1] as Extract<Scene, { kind: 'totals' }>
    expect(totals.stats.map((s) => s.label)).toEqual(['episodes', 'hours', 'show'])
    expect(totalMs(scenes)).toBeGreaterThan(14_000)
    expect(totalMs(scenes)).toBeLessThanOrEqual(26_000)
  })

  it('long show titles are ellipsized', () => {
    const long = watch('The Marvelous Mrs. Maisel and the Extraordinarily Long Season Finale', { ratings: { [L]: 9, [A]: 9 } })
    const other = watch('Lioness', { ratings: { [L]: 5, [A]: 5 } })
    const scenes = videoScenes(yearVideoData({ year: 2026, people, watches: [long, other] }))
    const top = scenes.find((s) => s.kind === 'top') as Extract<Scene, { kind: 'top' }>
    expect(top.shows[0].name.endsWith('…')).toBe(true)
    expect(Array.from(top.shows[0].name).length).toBeLessThanOrEqual(30)
    expect(top.shows[1].name).toBe('Lioness')
    expect(clip('Short', 10)).toBe('Short')
    expect(clip('Abcdefghijk', 6)).toBe('Abcde…')
  })

  it('speed makes a short version with the same scenes (for tests)', () => {
    const y = normalYear()
    const data = yearVideoData({ year: 2026, people, ...y })
    const fast = videoScenes(data, { speed: 10 })
    expect(kinds(fast)).toEqual(kinds(videoScenes(data)))
    expect(totalMs(fast)).toBeLessThan(2_200)
  })

  it('lists the images to load and finds the scene on screen at any moment', () => {
    const y = normalYear()
    const scenes = videoScenes(yearVideoData({ year: 2026, people, ...y }))
    const urls = sceneImages(scenes)
    expect(urls.filter((u) => u.includes('photos.test'))).toHaveLength(3)
    expect(urls.filter((u) => u.includes('tvmaze'))).toHaveLength(3)
    expect(sceneAt(scenes, 0).scene.kind).toBe('title')
    expect(sceneAt(scenes, scenes[2].start + 10)).toMatchObject({ scene: { kind: 'top' }, t: 10 })
    expect(sceneAt(scenes, 999_999).scene.kind).toBe('outro')
  })
})

describe('video type', () => {
  it('prefers MP4 (H.264) for WhatsApp, then plain MP4, then WebM', () => {
    expect(pickMime(() => true)).toBe('video/mp4;codecs=avc1.42E01E')
    expect(pickMime((t) => t === 'video/mp4')).toBe('video/mp4')
    expect(pickMime((t) => t.startsWith('video/webm'))).toBe('video/webm;codecs=vp9')
    expect(pickMime((t) => t === 'video/webm')).toBe('video/webm')
    expect(pickMime(() => false)).toBeNull()
  })

  it('skips types the browser throws on', () => {
    expect(
      pickMime((t) => {
        if (t.includes('avc1')) throw new Error('nope')
        return t === 'video/mp4'
      }),
    ).toBe('video/mp4')
  })

  it('no MediaRecorder at all: null', () => {
    expect(pickMime()).toBeNull()
  })

  it('names the file and its type from the chosen mime', () => {
    expect(extFor('video/mp4;codecs=avc1.42E01E')).toBe('mp4')
    expect(extFor('video/webm;codecs=vp9')).toBe('webm')
    expect(baseType('video/mp4;codecs=avc1.42E01E')).toBe('video/mp4')
    expect(VIDEO_TYPES[0]).toBe('video/mp4;codecs=avc1.42E01E')
  })
})
