import { useEffect, useRef, useState } from 'react'
import { COMMENT_MAX, chatLocked, cleanComment, commentsFor, mentionParts, mentionsIn, timeAgo } from '../logic'
import type { Comment, Person, Watch } from '../types'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { t } from '../i18n'

interface Props {
  /** The show this chat is about; null for the Family chat */
  watch: Watch | null
  comments: Comment[]
  people: Person[]
  me: string | null
  onSend: (text: string) => Promise<boolean>
  onRemove: (c: Comment) => void
  /** Called while the messages are on screen, to clear unread badges */
  onSeen?: () => void
  /** Messages screen: no card title, roomier */
  bare?: boolean
}

/** A few lines about the show. Watchers read it after rating, so nobody's stars get nudged. */
export function FamilyChat({ watch, comments, people, me, onSend, onRemove, onSeen, bare = false }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const list = commentsFor(comments, watch?.id ?? null)
  // Locked means "rate first so your stars aren't nudged", but it's your call: Read anyway opens it
  const [peek, setPeek] = useState(false)
  const locked = watch != null && chatLocked(watch, me) && !peek
  const input = useRef<HTMLInputElement>(null)
  const others = people.filter((p) => p.id !== me)
  const from = [...new Set(list.map((c) => c.personId))].filter((id) => id !== me).map((id) => people.find((p) => p.id === id)?.name ?? t('Someone'))

  const seen = useRef(onSeen)
  useEffect(() => {
    seen.current = onSeen
  })
  useEffect(() => {
    if (!locked) seen.current?.()
  }, [locked, list.length])

  function mention(name: string) {
    setText((cur) => `${cur}${cur && !cur.endsWith(' ') ? ' ' : ''}@${name} `)
    input.current?.focus()
  }
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? t('Someone')

  async function send() {
    const clean = cleanComment(text)
    if (!clean || sending) return
    setSending(true)
    if (await onSend(clean)) setText('')
    setSending(false)
  }

  return (
    <section className={`card chat ${bare ? 'bare' : ''}`} aria-label={watch ? t('Chat about {show}', { show: watch.showName }) : t('Family chat')}>
      {!bare && (
        <p className="field-label chat-head">
          {t('Family chat')} {list.length > 0 && <small>{list.length}</small>}
        </p>
      )}
      {locked ? (
        <div className="chat-locked">
          <Icon name="lock" size={16} stroke={2.2} />
          <div>
            <p>
              {list.length
                ? from.length
                  ? list.length === 1
                    ? t('1 message from {names}.', { names: from.join(' & ') })
                    : t('{n} messages from {names}.', { n: list.length, names: from.join(' & ') })
                  : list.length === 1
                    ? t('1 message.')
                    : t('{n} messages.', { n: list.length })
                : t('No messages yet.')}{' '}
              {t("Rate it first if you don't want your stars nudged.")}
            </p>
            <button className="btn sm ghost-dark" onClick={() => setPeek(true)}>
              {list.length ? t('Read anyway') : t('Write anyway')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {list.length === 0 ? (
            <p className="muted chat-empty">{watch ? t('No messages yet. What did you think of it?') : t('Say hi to the family. Plans for tonight? A show everyone should see?')}</p>
          ) : (
            <ul className="chat-list">
              {list.map((c) => (
                <li key={c.id} className={`${c.personId === me ? 'mine' : ''} ${me && c.personId !== me && mentionsIn(c.text, people).includes(me) ? 'to-me' : ''}`}>
                  <Avatar people={people} id={c.personId} size={28} />
                  <div className="bubble">
                    <span className="chat-meta">
                      <b>{c.personId === me ? t('You') : nameOf(c.personId)}</b> · {timeAgo(c.createdAt)}
                    </span>
                    <p>
                      {mentionParts(c.text, people).map((part, n) =>
                        part.personId ? (
                          <b key={n} className={`mention ${part.personId === me ? 'me' : ''}`}>{part.text}</b>
                        ) : (
                          <span key={n}>{part.text}</span>
                        ),
                      )}
                    </p>
                  </div>
                  {c.personId === me && (
                    <button className="chat-x" aria-label={t('Remove message')} onClick={() => onRemove(c)}>
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
                ref={input}
                value={text}
                maxLength={COMMENT_MAX}
                placeholder={t('Message the family…')}
                aria-label={t('Message')}
                enterKeyHint="send"
                onChange={(e) => setText(e.target.value)}
              />
              <button className="chat-send" aria-label={t('Send')} disabled={!cleanComment(text) || sending}>
                <Icon name="right" size={18} stroke={2.6} />
              </button>
            </form>
          )}
          {me && others.length > 0 && (
            <div className="mention-row" role="group" aria-label={t('Mention someone')}>
              {others.map((p) => (
                <button key={p.id} type="button" className="mention-chip" onClick={() => mention(p.name)}>
                  <Avatar people={people} id={p.id} size={18} /> @{p.name}
                </button>
              ))}
            </div>
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
