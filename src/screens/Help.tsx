import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'

interface QA {
  id: string
  q: string
  a: string[]
}

interface Section {
  title: string
  items: QA[]
}

const SECTIONS: Section[] = [
  {
    title: 'Getting started',
    items: [
      {
        id: 'install',
        q: 'How do I install the app on my iPhone?',
        a: [
          'Open the app link in Safari (it must be Safari).',
          'Tap Share (the square with an arrow), then Add to Home Screen, then Add.',
          'Open Pititi from your home screen from now on.',
        ],
      },
      {
        id: 'update',
        q: 'How do I get the newest version?',
        a: [
          'Updates install themselves. Swipe Pititi away completely and open it again.',
          'If it still looks the same, do it once more: the first launch downloads the update, the next one shows it.',
        ],
      },
      {
        id: 'join',
        q: 'How does someone in the family join?',
        a: [
          'Leandro (the admin) shares the invite code from the Family tab.',
          'They install the app, tap Create account, enter the code, and pick their name (or type a new one).',
          'Nobody can sign up without the code.',
        ],
      },
    ],
  },
  {
    title: 'Logging shows',
    items: [
      {
        id: 'log',
        q: 'How do I log a show?',
        a: [
          'Tap + at the bottom, search the show, and tap it.',
          'Choose Finished it or Still watching, check who watched, give your stars, and tap Log it.',
          'Month, rewatch and notes are under More options.',
        ],
      },
      {
        id: 'shelf',
        q: 'What\'s the difference between Currently watching and Watched this month?',
        a: [
          'Currently watching lists every show you\'re in the middle of, no matter when you started it. Tap + 1 ep after each episode.',
          'Watched this month shows what you finished this month.',
          'Episodes from shows you\'re still watching count in this month\'s numbers too.',
        ],
      },
      {
        id: 'month',
        q: 'How do I log something we watched in an earlier month?',
        a: ['On Home, use the arrows to go to that month, then tap +. The screen says "Adding to <month>".', 'You can also change "Watched in" on any show.'],
      },
      {
        id: 'airing',
        q: 'What does "Caught up" mean?',
        a: [
          'Some seasons are still airing (for example 3 of 10 episodes are out).',
          'Then the app logs you as caught up with the episodes released so far, and only those count toward episodes and hours.',
          'When new episodes air, mark them on the show page or tap +1 ep.',
        ],
      },
      {
        id: 'episodes',
        q: 'How do I mark episodes?',
        a: [
          'Open the show and tap the last episode you watched in the grid. Everything before it is marked.',
          'Tapped the wrong one? Tap it again to go back one.',
          'Faded episodes haven\'t aired yet and can\'t be marked.',
          'On Home, +1 ep marks the next episode in one tap.',
        ],
      },
      {
        id: 'seasons',
        q: 'We watched Season 1 last year and Season 2 now. How do I log both?',
        a: [
          'Each season is its own log. Log Season 2 in this month as usual.',
          'For Season 1, go to that month on Home (arrows), tap +, pick the show and choose Season 1.',
          'That way each month only counts what you watched in it.',
        ],
      },
      {
        id: 'rewatch',
        q: 'How do rewatches work?',
        a: ['Logging a season you already logged turns Rewatch on by itself. Times watched shows the count.'],
      },
    ],
  },
  {
    title: 'Ratings and the reveal',
    items: [
      {
        id: 'blind',
        q: 'Why can\'t I see Ana\'s stars?',
        a: [
          'Ratings are blind: you only see your own until everyone who watched has rated.',
          'Then the reveal plays with everyone\'s stars, the family average and a verdict.',
          '"Rated · hidden" means they rated; "Not rated yet" means they haven\'t.',
        ],
      },
      {
        id: 'average',
        q: 'How is the average calculated?',
        a: ['It\'s the average of everyone marked under "Who watched?", shown once all of them have rated.'],
      },
      {
        id: 'others',
        q: 'Can I rate for someone else?',
        a: ['Only for family members without their own account (like a grandparent or kid). Everyone with an account rates for themselves.'],
      },
    ],
  },
  {
    title: 'Up Next',
    items: [
      {
        id: 'upnext',
        q: 'What is Up Next?',
        a: [
          'The family list of shows you want to watch. Save a show with the bookmark next to any search result.',
          'Tap ♡ on shows you want. The most-hearted one is Tonight\'s pick; Pick again draws another, favoring popular ones.',
          'Watch it logs the show and removes it from the list.',
        ],
      },
    ],
  },
  {
    title: 'Stats and badges',
    items: [
      {
        id: 'counts',
        q: 'How are shows, episodes and hours counted?',
        a: [
          'Shows: different shows in that month or year (two seasons of the same show count once).',
          'Episodes: counted in the month you watched them. Watch 5 in September and 5 in October, and each month gets 5.',
          'Only aired episodes count.',
          'Hours: episodes × the show\'s average episode length, rounded.',
        ],
      },
      {
        id: 'taste',
        q: 'What is Taste match?',
        a: [
          'How close two people\'s stars are on shows they both rated. 100% means identical ratings every time.',
          'It unlocks after 3 shows rated together and names the show you disagreed on most.',
        ],
      },
      {
        id: 'badges',
        q: 'How do Family badges work?',
        a: [
          'They\'re earned automatically from what the family logs. Color = earned, grey with a bar = progress.',
          'On a roll: log shows 3 months in a row.',
          'Binge mode: 50 episodes in one month.',
          'Soulmates: 5 shows where everyone gave the same stars.',
          'Family night: a show watched by 3 or more people.',
          'Agree to disagree: a show rated 3+ stars apart.',
          'Rewatch royalty: 5 rewatches.',
          'Explorer: shows from 6 genres.',
          'Night owl: log a show between 1 and 5 AM.',
          'Centurion: 100 different shows.',
        ],
      },
    ],
  },
  {
    title: 'Settings and help',
    items: [
      {
        id: 'dark',
        q: 'How do I change light or dark mode?',
        a: ['Tap your avatar on Home → Appearance. Auto goes dark from 7 PM to 7 AM. Each phone keeps its own choice.'],
      },
      {
        id: 'admin',
        q: 'What can the admin do?',
        a: ['Leandro is the only admin: he manages family members and the invite code, and can remove any log. Everyone can log, rate and use Up Next, and remove what they added.'],
      },
      {
        id: 'offline',
        q: 'It says "Offline". What now?',
        a: ['You\'re seeing the last synced copy. Check your internet; the app syncs again as soon as it\'s back.'],
      },
    ],
  },
]

export function Help({ topic, onBack }: { topic: string | null; onBack: () => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(topic)
  const opened = useRef<HTMLDetailsElement | null>(null)

  useEffect(() => {
    if (topic) opened.current?.scrollIntoView({ block: 'start' })
  }, [topic])

  const q = query.trim().toLowerCase()
  const sections = SECTIONS.map((s) => ({
    ...s,
    items: q ? s.items.filter((i) => (i.q + ' ' + i.a.join(' ')).toLowerCase().includes(q)) : s.items,
  })).filter((s) => s.items.length)

  return (
    <div className="screen">
      <header className="topbar">
        <button className="icon-btn" aria-label="Back" onClick={onBack} style={{ marginRight: 4 }}>
          <Icon name="left" size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <p className="eyebrow">Questions and answers</p>
          <h1 className="title-xl">Help</h1>
        </div>
      </header>

      <div className="searchbox">
        <Icon name="search" size={20} />
        <input type="search" placeholder="Search questions" aria-label="Search help" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {sections.length === 0 && (
        <p className="muted center" style={{ padding: 20 }}>
          Nothing matches "{query.trim()}". Try another word, or ask Leandro.
        </p>
      )}

      {sections.map((s) => (
        <section key={s.title}>
          <h2 className="h2" style={{ marginBottom: 10 }}>{s.title}</h2>
          <div className="card faq">
            {s.items.map((i) => (
              <details
                key={i.id}
                open={q ? true : open === i.id}
                ref={i.id === topic ? opened : undefined}
                onToggle={(e) => {
                  const isOpen = (e.currentTarget as HTMLDetailsElement).open
                  if (!q) setOpen(isOpen ? i.id : open === i.id ? null : open)
                }}
              >
                <summary>
                  {i.q}
                  <Icon name="right" size={16} stroke={2.4} />
                </summary>
                <div className="faq-a">
                  {i.a.map((line, n) => (
                    <p key={n}>{line}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
