import { describe, expect, it } from 'vitest'
import { easter, festiveById, festiveFor, type FestiveId } from './festive'
import { picksFor } from './festivePicks'

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
    expect(on('2026-10-20')).toBeNull()
  })
  it('Canadian dates', () => {
    // Family Day: 3rd Monday of February
    expect(on('2027-02-15')).toBe('familyday')
    expect(on('2028-02-21')).toBe('familyday')
    // Victoria Day: Monday before May 25, Saturday to Monday
    expect(on('2027-05-22')).toBe('victoria')
    expect(on('2027-05-24')).toBe('victoria')
    expect(on('2027-05-25')).toBeNull()
    expect(on('2026-05-18')).toBe('victoria')
    expect(on('2028-05-22')).toBe('victoria')
    expect(on('2027-07-01')).toBe('canadaday')
    // Labour Day weekend (1st Monday of September), across the month line
    expect(on('2025-08-30')).toBe('labourday')
    expect(on('2025-09-01')).toBe('labourday')
    expect(on('2027-09-06')).toBe('labourday')
    // Thanksgiving weekend: 2nd Monday of October
    expect(on('2027-10-09')).toBe('thanksgiving')
    expect(on('2027-10-11')).toBe('thanksgiving')
    expect(on('2027-10-13')).toBeNull()
    expect(festiveFor(new Date('2027-07-01T12:00:00'))?.country).toBe('CA')
  })
  it('Brazilian dates', () => {
    expect(on('2027-04-21')).toBe('tiradentes')
    expect(on('2027-05-01')).toBe('trabalhador')
    expect(on('2027-09-07')).toBe('independencia')
    expect(on('2027-10-12')).toBe('criancas')
    expect(on('2027-11-15')).toBe('republica')
    expect(on('2027-11-20')).toBe('consciencia')
    expect(festiveFor(new Date('2027-09-07T12:00:00'))?.country).toBe('BR')
  })
  it("Father's Day: June in Canada, August in Brazil", () => {
    const ca = festiveFor(new Date('2027-06-20T12:00:00'))
    const br = festiveFor(new Date('2027-08-08T12:00:00'))
    expect([ca?.id, ca?.country]).toEqual(['fathers', 'CA'])
    expect([br?.id, br?.country]).toEqual(['fathers', 'BR'])
    // Inside Festa Junina, Father's Day wins its Sunday
    expect(on('2027-06-19')).toBe('junina')
  })
  it('collisions: the single day wins, the long weekend keeps its other days', () => {
    // 2026: Thanksgiving Monday is Oct 12 (Children's Day); Labour Day is Sep 7 (Independence)
    expect(on('2026-10-12')).toBe('criancas')
    expect(on('2026-10-11')).toBe('thanksgiving')
    expect(on('2026-09-07')).toBe('independencia')
    expect(on('2026-09-06')).toBe('labourday')
    // Easter weekend beats Tiradentes (Easter Sunday 2030 is Apr 21)
    expect(on('2030-04-21')).toBe('easter')
    // Carnaval beats Family Day (2026: both Feb 16)
    expect(on('2026-02-16')).toBe('carnaval')
  })
  it('every look has its picks', () => {
    const ids: FestiveId[] = ['halloween', 'christmas', 'newyear', 'valentines', 'namorados', 'stpatricks', 'easter', 'carnaval', 'junina', 'mothers', 'familyday', 'victoria', 'canadaday', 'labourday', 'thanksgiving', 'tiradentes', 'trabalhador', 'independencia', 'criancas', 'republica', 'consciencia', 'fathers']
    for (const id of ids) {
      expect(festiveById(id), id).not.toBeNull()
      expect(picksFor(id).length, id).toBeGreaterThanOrEqual(6)
    }
  })
})
