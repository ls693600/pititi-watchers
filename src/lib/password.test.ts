import { describe, expect, it } from 'vitest'
import { passwordProblem } from './password'

describe('passwordProblem', () => {
  it('accepts a matching new password of 6+ characters', () => {
    expect(passwordProblem('abc123', 'abc123')).toBeNull()
    expect(passwordProblem('abc123', 'abc123', 'old-one')).toBeNull()
  })
  it('rejects one shorter than 6 (5 characters is the boundary)', () => {
    expect(passwordProblem('abc12', 'abc12')).toMatch(/at least 6/)
    expect(passwordProblem('', '')).toMatch(/at least 6/)
  })
  it('rejects when the two new passwords differ', () => {
    expect(passwordProblem('abc123', 'abc124')).toMatch(/match/)
  })
  it('rejects reusing the current password', () => {
    expect(passwordProblem('same-pass', 'same-pass', 'same-pass')).toMatch(/different/)
  })
})
