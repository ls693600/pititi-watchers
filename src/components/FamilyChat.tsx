import { useState } from 'react'
import { COMMENT_MAX, chatLocked, cleanComment, commentsFor, timeAgo } from '../logic'
import type { Comment, Person, Watch } from '../types'
import { Avatar } from './Avatar'
import { Icon } from './Icon'

interface Props {
  watch: Watch
  comments: Comment[]
  people: Person[]
  me: string | null
  onSend: (text: string) => Promise<boolean>
  onRemove: (c: Comment) => void
}

/** A few lines about the show. Watchers read it after rating, so nobody's stars get nudged. */
export function FamilyChat({ watch, comments, people, me, onSend, onRemove }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const list = commentsFor(comments, watch.id)
  const locked = chatLocked(watch, me)
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? 'Someone'

  async function send() {
    const clean = cleanComment(text)
    if (!clean || sending) return
    setSending(true)
    if (await onSend(clean)) setText('')
    setSending(false)
  }

  return (
    <section className="card chat" aria-label="Family chat">
      <p className="field-label chat-head">
        Family chat {list.length > 0 && <small>{list.length}</small>}
      </p>
      {locked ? (
        <p className="chat-locked">
          <Icon name="lock" size={16} stroke={2.2} />
          <span>
            {list.length ? `${list.length} ${list.length === 1 ? 'message' : 'messages'} waiting.` : 'No messages yet.'} Rate it first to read and write, so
            nobody's stars get nudged.
          </span>
        </p>
      ) : (
        <>
          {list.length === 0 ? (
            <p className="muted chat-empty">No messages yet. What did you think of it?</p>
          ) : (
            <ul className="chat-list">
              {list.map((c) => (
                <li key={c.id} className={c.personId === me ? 'mine' : ''}>
                  <Avatar people={people} id={c.personId} size={28} />
                  <div className="bubble">
                    <span className="chat-meta">
                      <b>{c.personId === me ? 'You' : nameOf(c.personId)}</b> · {timeAgo(c.createdAt)}
                    </span>
                    <p>{c.text}</p>
                  </div>
                  {c.personId === me && (
                    <button className="chat-x" aria-label="Remove message" onClick={() => onRemove(c)}>
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {me && (
            <form
              className="chat-compose"
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
            >
              <input
                value={text}
                maxLength={COMMENT_MAX}
                placeholder="Message the family…"
                aria-label="Message"
                enterKeyHint="send"
                onChange={(e) => setText(e.target.value)}
              />
              <button className="chat-send" aria-label="Send" disabled={!cleanComment(text) || sending}>
                <Icon name="right" size={18} stroke={2.6} />
              </button>
            </form>
          )}
          {text.length > COMMENT_MAX - 40 && (
            <p className="muted chat-count">
              {text.length}/{COMMENT_MAX}
            </p>
          )}
        </>
      )}
    </section>
  )
}
