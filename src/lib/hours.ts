import { locale } from '../i18n'

/** "10 PM" / "22:00", in the app's language. */
export function hourLabel(hour: number): string {
  return new Date(2026, 0, 1, hour).toLocaleTimeString(locale(), { hour: 'numeric', minute: locale() === 'pt-BR' ? '2-digit' : undefined })
}
