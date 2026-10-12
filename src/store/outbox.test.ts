import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isNetworkError, readOutbox, withOutbox } from './outbox'
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
})
