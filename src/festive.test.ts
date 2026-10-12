import { describe, expect, it } from 'vitest'
import { easter, festiveFor } from './festive'

const on = (s: string) => festiveFor(new Date(`${s}T12:00:00`))?.id ?? null

describe('festive days', () => {
  it('computes Easter Sunday', () => {
    expect(easter(2026)).toEqual({ month: 4, day: 5 })
    expect(easter(2027)).toEqual({ month: 3, day: 28 })
    expect(easter(2025)).toEqual({ month: 4, day: 20 })
  })
  it('fixed dates', () => {
    expect(on('2026-10-31')).toBe('halloween')
    expect(on('2026-10-25')).toBe('halloween')
    expect(on('2026-10-24')).toBeNull()
    expect(on('2026-12-25')).toBe('christmas')
    expect(on('2026-12-31')).toBe('newyear')
    expect(on('2027-01-01')).toBe('newyear')
    expect(on('2027-01-02')).toBeNull()
    expect(on('2027-02-14')).toBe('valentines')
    expect(on('2027-03-17')).toBe('stpatricks')
    expect(on('2027-06-24')).toBe('junina')
    expect(on('2027-06-12')).toBe('namorados')
  })
  it('moving dates: Easter weekend, Carnaval, Mother\'s Day', () => {
    expect(on('2026-04-03')).toBe('easter')
    expect(on('2026-04-05')).toBe('easter')
    expect(on('2026-04-06')).toBeNull()
    // Easter 2026 is Apr 5: Carnaval Sat Feb 14 is Valentine's (fixed dates win), Mon Feb 16 / Tue Feb 17
    expect(on('2026-02-16')).toBe('carnaval')
    expect(on('2026-02-17')).toBe('carnaval')
    expect(on('2026-02-18')).toBeNull()
    expect(on('2026-05-10')).toBe('mothers')
    expect(on('2026-05-03')).toBeNull()
  })
  it('an ordinary day has no theme', () => {
    expect(on('2026-10-11')).toBeNull()
  })
})
