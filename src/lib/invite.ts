// Reading an invite code from whatever someone types or pastes.

/** The code from whatever was pasted: the code itself, or the whole invite link / message. */
export function inviteCodeFrom(text: string): string {
  const fromLink = text.match(/[?&]invite=([A-Za-z0-9]+)/)?.[1]
  if (fromLink) return fromLink.toUpperCase().slice(0, 16)
  const words = text.toUpperCase().match(/\b[A-F0-9]{8}\b/)
  return words ? words[0] : text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16)
}
