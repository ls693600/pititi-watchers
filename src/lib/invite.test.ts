import { describe, expect, it } from 'vitest'
import { inviteCodeFrom } from './invite'

describe('invite codes', () => {
  it('takes the code itself, any case or spacing', () => {
    expect(inviteCodeFrom('ab12cd34')).toBe('AB12CD34')
    expect(inviteCodeFrom(' AB12 CD34 ')).toBe('AB12CD34')
  })
  it('takes it from the whole link or the whole WhatsApp message', () => {
    expect(inviteCodeFrom('https://ls693600.github.io/pititi-watchers/?invite=AB12CD34')).toBe('AB12CD34')
    expect(inviteCodeFrom('Join Márcia & Pero on Pititi Watchers! Open https://x.io/?invite=C0FFEE12\nThen create your account (the code C0FFEE12 is already filled in).')).toBe('C0FFEE12')
    expect(inviteCodeFrom('Then create your account (code 9F3A1B2C, already filled in).')).toBe('9F3A1B2C')
  })
})
