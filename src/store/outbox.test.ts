import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearOutbox, isNetworkError, isRetryable, readOutbox, withOutbox } from './outbox'
import { LogGone } from './diff'
import type { Store } from './store'

// Minimal localStorage for node
const mem = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage

const offline = () => Object.assign(new TypeError('Failed to fetch'))

function fakeStores() {
  const calls: string[] = []
  let online = false
  const cloud = {
    save: vi.fn(async (w: { id: string }) => {
      if (!online) throw offline()
      if (w.id === 'gone') throw new LogGone()
      if (w.id === 'busy') throw Object.assign(new Error('JWT expired'), { code: 'PGRST301' })
      calls.push(`save:${w.id}`)
    }),
    addComment: vi.fn(async (c: { id: string }) => {
      if (!online) throw offline()
      if (c.id === 'dup') throw Object.assign(new Error('duplicate key value'), { code: '23505' })
      if (c.id === 'nope') throw Object.assign(new Error('new row violates row-level security'), { code: '42501' })
      calls.push(`comment:${c.id}`)
    }),
  } as unknown as Store
  const mirror = { save: vi.fn(async () => undefined), addComment: vi.fn(async () => undefined) } as unknown as Store
  return { cloud, mirror, calls, goOnline: () => (online = true) }
}

describe('offline saving', () => {
  beforeEach(() => mem.clear())

  it('recognizes "no signal" errors and nothing else', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new TypeError('Load failed'))).toBe(true)
    expect(isNetworkError({ message: 'new row violates row-level security policy' })).toBe(false)
  })

  it('queues while offline, keeps it on the phone, and syncs in order later', async () => {
    const { cloud, mirror, calls, goOnline } = fakeStores()
    const s = withOutbox(cloud, mirror)
    await s.save({ id: 'a' } as never)
    await s.addComment({ id: 'c1' } as never)
    await s.save({ id: 'b' } as never)
    expect(readOutbox().map((x) => x.op)).toEqual(['save', 'addComment', 'save'])
    expect(mirror.save).toHaveBeenCalledTimes(2)
    // Still offline: nothing lost
    expect(await s.flush()).toEqual({ sent: 0, dropped: 0 })
    expect(readOutbox()).toHaveLength(3)
    goOnline()
    expect(await s.flush()).toEqual({ sent: 3, dropped: 0 })
    expect(calls).toEqual(['save:a', 'comment:c1', 'save:b'])
    expect(readOutbox()).toHaveLength(0)
  })

  it('a change that already arrived counts as sent; one the server refuses is dropped, not retried forever', async () => {
    const { cloud, mirror, goOnline } = fakeStores()
    const s = withOutbox(cloud, mirror)
    await s.addComment({ id: 'dup' } as never)
    await s.addComment({ id: 'nope' } as never)
    await s.addComment({ id: 'ok' } as never)
    goOnline()
    expect(await s.flush()).toEqual({ sent: 2, dropped: 1 })
    expect(readOutbox()).toHaveLength(0)
  })

  it('errors that are not about the network still reach the screen', async () => {
    const { cloud, mirror, goOnline } = fakeStores()
    goOnline()
    const s = withOutbox(cloud, mirror)
    await expect(s.addComment({ id: 'nope' } as never)).rejects.toThrow(/row-level security/)
    expect(readOutbox()).toHaveLength(0)
  })
  it('a late change to a log someone removed meanwhile is dropped quietly, never bringing it back', async () => {
    const { cloud, mirror, calls, goOnline } = fakeStores()
    const s = withOutbox(cloud, mirror)
    await s.save({ id: 'gone' } as never)
    await s.save({ id: 'a' } as never)
    goOnline()
    expect(await s.flush()).toEqual({ sent: 2, dropped: 0 })
    expect(calls).toEqual(['save:a'])
  })

  it('an expired sign-in or a server hiccup waits for the next try instead of losing the change', async () => {
    expect(isRetryable({ message: 'JWT expired', code: 'PGRST301' })).toBe(true)
    expect(isRetryable({ message: 'x', status: 503 })).toBe(true)
    expect(isRetryable({ message: 'new row violates row-level security policy', code: '42501' })).toBe(false)
    const { cloud, mirror, goOnline } = fakeStores()
    const s = withOutbox(cloud, mirror)
    await s.save({ id: 'busy' } as never)
    goOnline()
    expect(await s.flush()).toEqual({ sent: 0, dropped: 0 })
    expect(readOutbox()).toHaveLength(1)
  })

  it('signing out clears what this phone was holding for the person leaving', async () => {
    const { cloud, mirror } = fakeStores()
    const s = withOutbox(cloud, mirror)
    await s.save({ id: 'a' } as never)
    clearOutbox()
    expect(readOutbox()).toHaveLength(0)
  })
})
