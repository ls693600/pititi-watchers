import { useCallback, useState } from 'react'
import { t } from '../i18n'
import { CHAT_KEY, readSet, writeSet } from '../lib/seen'
import { newId, toggleReaction } from '../logic'
import type { Snapshot, Store } from '../store/store'
import type { Comment, Reaction } from '../types'
import type { Flash } from './useToast'

/** Family chats and reactions: what's loaded, sending, removing (with Undo), and putting a show's chat back. */
export function useChat(store: Store, me: string | null, flash: Flash) {
  const [comments, setComments] = useState<Comment[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  /** Reactions and chat need migration 006; hidden until it's run */
  const [social, setSocial] = useState(false)

  const take = useCallback((snap: Pick<Snapshot, 'comments' | 'reactions'> & { social?: boolean }) => {
    setComments(snap.comments ?? [])
    setReactions(snap.reactions ?? [])
    if (snap.social !== undefined) setSocial(snap.social)
  }, [])

  async function react(watchId: string, targetId: string, emoji: string) {
    if (!me) return
    const r = { watchId, personId: me, targetId, emoji }
    const same = (x: Reaction) => x.watchId === watchId && x.personId === me && x.targetId === targetId
    const before = reactions.find(same) ?? null
    // Same emoji again takes it back; another emoji replaces it
    const kept = before?.emoji !== emoji
    setReactions((list) => toggleReaction(list, r))
    try {
      await store.setReaction({ ...r, emoji: kept ? emoji : null })
    } catch {
      setReactions((list) => [...list.filter((x) => !same(x)), ...(before ? [before] : [])])
      flash(t("Couldn't send your reaction. Check your connection."))
    }
  }

  async function send(watchId: string | null, text: string) {
    if (!me) return false
    const c: Comment = { id: newId(), watchId, personId: me, text, createdAt: new Date().toISOString() }
    setComments((list) => [...list, c])
    // Your own line never gets announced back to you
    const seen = readSet(CHAT_KEY)
    if (seen) writeSet(CHAT_KEY, seen.add(c.id))
    try {
      await store.addComment(c)
      return true
    } catch {
      setComments((list) => list.filter((x) => x.id !== c.id))
      flash(t("Couldn't send it. Check your connection."))
      return false
    }
  }

  async function remove(c: Comment) {
    setComments((list) => list.filter((x) => x.id !== c.id))
    try {
      await store.removeComment(c.id)
      flash(t('Message removed'), async () => {
        setComments((list) => [...list.filter((x) => x.id !== c.id), c])
        await store.addComment(c).catch(() => {
          setComments((list) => list.filter((x) => x.id !== c.id))
          flash(t("Couldn't bring it back. Check your connection."))
        })
      })
    } catch (e) {
      setComments((list) => [...list, c])
      flash((e as Error).message || t("Couldn't remove it. Check your connection."))
    }
  }

  /** A show's chat and reactions, kept so Undo on "remove show" can bring them back. */
  const forWatch = (watchId: string) => ({ chat: comments.filter((c) => c.watchId === watchId), reacts: reactions.filter((r) => r.watchId === watchId) })

  /** Best effort: the show is back even if a message can't be restored. */
  async function restore(watchId: string, chat: Comment[], reacts: Reaction[]) {
    await Promise.all([...chat.map((c) => store.addComment(c)), ...reacts.map((r) => store.setReaction(r))]).catch(() => undefined)
    setComments((list) => [...list.filter((c) => c.watchId !== watchId), ...chat])
    setReactions((list) => [...list.filter((r) => r.watchId !== watchId), ...reacts])
  }

  return { comments, reactions, social, take, react, send, remove, forWatch, restore }
}
