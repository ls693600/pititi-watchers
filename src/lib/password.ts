import { t } from '../i18n'

export const MIN_PASSWORD = 6

/** Returns the problem with a new password, or null when it's fine. */
export function passwordProblem(next: string, confirm: string, current?: string): string | null {
  if (next.length < MIN_PASSWORD) return t('Use at least 6 characters for the password.')
  if (next !== confirm) return t("The two new passwords don't match.")
  if (current != null && next === current) return t('Pick a password different from the old one.')
  return null
}
