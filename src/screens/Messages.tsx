import { Avatar } from '../components/Avatar'
import { FamilyChat } from '../components/FamilyChat'
import { Icon } from '../components/Icon'
import { Poster } from '../components/Poster'
import { chatLocked, threads, timeAgo } from '../logic'
import type { Comment, Person, Watch } from '../types'

interface Props {
  comments: Comment[]
  watches: Watch[]
  people: Person[]
  me: string | null
  lastRead: Record<string, string>
  /** undefined = the inbox; null = Family chat; id = a show's chat */
  thread: string | null | undefined
  onThread: (watchId: string | null | undefined) => void
  onSend: (watchId: string | null, text: string) => Promise<boolean>
  onRemove: (c: Comment) => void
  onSeen: (watchId: string | null) => void
  onOpenShow: (w: Watch) => void
  /** Push notifications: shown as a nudge at the top of the inbox until they're on */
  notify: { state: 'on' | 'off' | 'unsupported' | 'install' | 'denied'; onEnable: () => void } | null
}

/** All the family's chats in one place: the Family chat plus every show that has a conversation. */
export function Messages({ comments, watches, people, me, lastRead, thread, onThread, onSend, onRemove, onSeen, onOpenShow, notify }: Props) {
  const nameOf = (id: string) => (id === me ? 'You' : (people.find((p) => p.id === id)?.name ?? 'Someone'))

  if (thread !== undefined) {
    const w = thread ? watches.find((x) => x.id === thread) ?? null : null
    if (thread && !w) {
      // The show was removed (maybe on another phone)
      return (
        <div className="screen">
          <button className="icon-btn" aria-label="Back to messages" onClick={() => onThread(undefined)}>
            <Icon name="left" size={20} />
          </button>
          <p className="muted center">This show was removed from the log, along with its chat.</p>
        </div>
      )
    }
    return (
      <div className="screen thread">
        <header className="thread-head">
          <button className="icon-btn" aria-label="Back to messages" onClick={() => onThread(undefined)}>
            <Icon name="left" size={20} />
          </button>
          {w ? (
            <button className="thread-show" onClick={() => onOpenShow(w)}>
              <Poster src={w.poster} name={w.showName} w={40} />
              <span>
                <b>{w.showName}</b>
                <small>Season {w.season} · open show</small>
              </span>
            </button>
          ) : (
            <div className="thread-show">
              <span className="family-badge" aria-hidden="true">
                <Icon name="users" size={20} />
              </span>
              <span>
                <b>Family chat</b>
                <small>{people.map((p) => p.name).join(', ')}</small>
              </span>
            </div>
          )}
        </header>
        <FamilyChat watch={w} comments={comments} people={people} me={me} onSend={(text) => onSend(thread, text)} onRemove={onRemove} onSeen={() => onSeen(thread)} bare />
      </div>
    )
  }

  const list = threads(comments, lastRead, me)
  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <p className="eyebrow">Talk about what you watch</p>
          <h1 className="title-xl">Messages</h1>
        </div>
      </header>

      {notify && notify.state !== 'on' && (
        <div className="tip notify-tip" role="note">
          <span className="tip-icon" aria-hidden="true">
            <Icon name="bell" size={16} stroke={2.2} />
          </span>
          <p>
            {notify.state === 'install'
              ? 'To get notified on this iPhone, open Pititi from your home screen icon (not Safari).'
              : notify.state === 'denied'
                ? 'Notifications are blocked for Pititi. Turn them on in your phone settings.'
                : notify.state === 'unsupported'
                  ? "This browser can't show notifications. Use the home screen app."
                  : 'Get a notification when someone messages or @mentions you.'}
          </p>
          {notify.state === 'off' && (
            <button className="btn sm primary" onClick={notify.onEnable}>
              Turn on
            </button>
          )}
        </div>
      )}

      <ul className="inbox">
        {list.map((t) => {
          const w = t.watchId ? watches.find((x) => x.id === t.watchId) : null
          if (t.watchId && !w) return null
          // A finished show you haven't rated: say who wrote, not what
          const hidden = w && t.last && t.last.personId !== me && chatLocked(w, me)
          return (
            <li key={t.key}>
              <button className={`inbox-row ${t.unread ? 'unread' : ''}`} onClick={() => onThread(t.watchId)}>
                {w ? (
                  <Poster src={w.poster} name={w.showName} w={48} />
                ) : (
                  <span className="family-badge big" aria-hidden="true">
                    <Icon name="users" size={24} />
                  </span>
                )}
                <span className="inbox-text">
                  <span className="inbox-top">
                    <b>{w ? w.showName : 'Family chat'}</b>
                    {t.last && <small>{timeAgo(t.last.createdAt)}</small>}
                  </span>
                  <span className="inbox-last">
                    {t.last ? (
                      <>
                        <Avatar people={people} id={t.last.personId} size={16} />
                        {nameOf(t.last.personId)}: {hidden ? 'rate it to read' : t.last.text}
                      </>
                    ) : (
                      'Everyone in the family, any topic'
                    )}
                  </span>
                </span>
                {t.unread > 0 && <span className="badge-count" aria-label={`${t.unread} unread`}>{t.unread}</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {list.length === 1 && (
        <p className="muted center small" style={{ padding: '0 20px' }}>
          Show chats appear here too. Open any show and write in its Family chat.
        </p>
      )}
    </div>
  )
}
