// Announcing what happened since this phone last looked: chat lines, @mentions, reactions, badges.
// One message at a time (the most relevant), with an Open button that goes to it.
import { t } from '../i18n'
import { chatLocked, familyBadges, mentionsIn, newlyEarned, unseenComments } from '../logic'
import type { Flash } from '../hooks/useToast'
import type { Comment, Person, Reaction, Watch } from '../types'
import { BADGES_KEY, CHAT_KEY, readSet, writeSet } from './seen'

interface Go {
  flash: Flash
  openShow: (w: Watch) => void
  /** undefined = the inbox, null = Family chat, id = a show's chat */
  openThread: (watchId: string | null | undefined) => void
}

/** "Ana on Severance: …" for chat lines and reactions that arrived since this phone last looked. */
export function announceNew(
  snap: { watches: Watch[]; people: Person[]; reactions: Reaction[]; comments: Comment[] },
  me: string | null,
  { flash, openShow, openThread }: Go,
) {
  const rKey = (r: Reaction) => `r:${r.watchId}:${r.personId}:${r.emoji}`
  const forMe = snap.reactions.filter((r) => r.targetId === me && r.personId !== me)
  const seen = readSet(CHAT_KEY)
  const all = [...snap.comments.map((c) => c.id), ...forMe.map(rKey)]
  if (!seen) return writeSet(CHAT_KEY, new Set(all))
  const fresh = unseenComments(snap.comments, seen, me)
  const freshR = forMe.filter((r) => !seen.has(rKey(r)))
  all.forEach((id) => seen.add(id))
  writeSet(CHAT_KEY, seen)
  const nameOf = (id: string) => snap.people.find((p) => p.id === id)?.name ?? t('Someone')
  const show = (id: string | null) => (id ? snap.watches.find((w) => w.id === id) : undefined)
  const place = (watchId: string | null) => (watchId ? t('on {show}', { show: show(watchId)?.showName ?? t('a show') }) : t('in Family chat'))
  const short = (text: string) => (text.length > 60 ? text.slice(0, 58) + '…' : text)
  // Someone @mentioned you: that's meant for you, so it comes first and shows the words
  const toMe = me ? fresh.filter((c) => mentionsIn(c.text, snap.people).includes(me)) : []
  if (toMe.length) {
    const c = toMe[toMe.length - 1]
    return flash(t('{name} mentioned you {place}: “{text}”', { name: nameOf(c.personId), place: place(c.watchId), text: short(c.text) }), () => openThread(c.watchId), 'Open')
  }
  const count = fresh.length + freshR.length
  if (count > 1) {
    const from = [...new Set([...fresh.map((c) => c.personId), ...freshR.map((r) => r.personId)])].map(nameOf).join(' & ')
    const where = new Set([...fresh.map((c) => c.watchId), ...freshR.map((r) => r.watchId)])
    if (where.size === 1 && !freshR.length) {
      const id = [...where][0]
      return flash(t('{from}: {n} new {place}', { from, n: count, place: place(id) }), () => openThread(id), 'Open')
    }
    return flash(t('{from}: {n} new messages and reactions', { from, n: count }), () => openThread(undefined), 'Open')
  }
  if (fresh.length) {
    const c = fresh[0]
    const w = show(c.watchId)
    if (c.watchId && !w) return
    // Haven't rated yet: say who wrote, not what (no nudging your stars)
    return w && chatLocked(w, me)
      ? flash(t('{name} wrote {place}', { name: nameOf(c.personId), place: place(c.watchId) }), () => openThread(c.watchId), 'Open')
      : flash(t('{name} {place}: “{text}”', { name: nameOf(c.personId), place: place(c.watchId), text: short(c.text) }), () => openThread(c.watchId), 'Open')
  }
  if (freshR.length) {
    const r = freshR[0]
    const w = show(r.watchId)
    if (w) flash(t('{name} reacted {emoji} to your stars on {show}', { name: nameOf(r.personId), emoji: r.emoji, show: w.showName }), () => openShow(w), 'Open')
  }
}

/** Celebrates badges earned since this phone last looked (first run just records them). */
export function celebrateBadges(list: Watch[], flash: Flash) {
  const badges = familyBadges(list)
  const seen = readSet(BADGES_KEY)
  if (!seen) {
    writeSet(BADGES_KEY, new Set(badges.filter((b) => b.earned).map((b) => b.id)))
    return
  }
  const fresh = newlyEarned(badges, seen)
  if (!fresh.length) return
  fresh.forEach((b) => seen.add(b.id))
  writeSet(BADGES_KEY, seen)
  flash(
    fresh.length === 1
      ? t('Badge unlocked: {badge}', { badge: fresh[0].title })
      : fresh.length === 2
        ? t('Badges unlocked: {a} and {b}', { a: fresh[0].title, b: fresh[1].title })
        : t('{n} new badges unlocked · see Stats', { n: fresh.length }),
  )
}
