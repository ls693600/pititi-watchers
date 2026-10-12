import { describe, expect, it } from 'vitest'
import { inviteCodeFrom } from './invite'

describe('invite codes', () => {
  it('takes the code itself, any case or spacing', () => {
    expect(inviteCodeFrom('5ab08d14')).toBe('5AB08D14')
    expect(inviteCodeFrom(' 5AB0 8D14 ')).toBe('5AB08D14')
  })
  it('takes it from the whole link or the whole WhatsApp message', () => {
    expect(inviteCodeFrom('https://ls693600.github.io/pititi-watchers/?invite=5AB08D14')).toBe('5AB08D14')
    expect(inviteCodeFrom('Join Márcia & Pero on Pititi Watchers! Open https://x.io/?invite=C0FFEE12\nThen create your account (the code C0FFEE12 is already filled in).')).toBe('C0FFEE12')
    expect(inviteCodeFrom('Then create your account (code 9F3A1B2C, already filled in).')).toBe('9F3A1B2C')
  })
})
