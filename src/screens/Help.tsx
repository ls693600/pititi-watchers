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
          'Currently watching is the swipeable banner at the top: one card per show you\'re in the middle of, no matter when you started it. Swipe or tap the dots to move between shows, and tap Watched next after each episode.',
          'Each card says what\'s waiting, using real air dates from TVmaze: "2 new episodes" means they aired in the last 30 days and you haven\'t seen them; "2 episodes to go" means older episodes you haven\'t watched yet; "Next ep · Fri, Oct 9" means you\'re caught up until then; "Up to date" means you\'ve seen everything that\'s out.',
          'Shows with new episodes come first, then the ones airing soonest.',
          'Coming up shows the next new episode of each show for the next 30 days, like a TV guide.',
          'Watched this month shows what you finished this month.',
          'Episodes from shows you\'re still watching count in this month\'s numbers too.',
        ],
      },
      {
        id: 'hold',
        q: 'What happens when I press and hold a show?',
        a: [
          'Press and hold any show on Home (or tap ••• on the Currently watching banner) for quick actions.',
          'Watched episode N marks the next one. Finished the season marks every episode; if it\'s still airing it says Caught up and marks what\'s out.',
          'Give your stars right there, or tap I watched this too if you were on the couch but not listed.',
        ],
      },
      {
        id: 'undo',
        q: 'I tapped the wrong thing. Can I undo it?',
        a: [
          'Yes. After marking an episode, rating, saving, removing a show, merging or removing from Up Next, the message at the bottom has Undo for a few seconds.',
          'Removing a show brings it back with its chat and reactions.',
        ],
      },
      {
        id: 'new-show',
        q: 'I added a show. Why are no episodes marked?',
        a: [
          'New shows start as "Still watching" with nothing marked, so only what you really watched counts.',
          'Mark episodes as you watch them: tap Watched next on Home, or tap the last episode you saw on the show page.',
          'Already finished the whole season? Pick Finished it when you add it.',
        ],
      },
      {
        id: 'duplicate',
        q: 'A show says "logged twice". What do I do?',
        a: [
          'That happens when the same season was added twice. Open it and tap Merge into one: it keeps the furthest progress, everyone who watched and all ratings.',
          'Adding a show you\'re already watching now opens your existing log instead of making a copy.',
        ],
      },
      {
        id: 'watchers',
        q: 'Why does a show say "Waiting for Ana" when she didn\'t watch it?',
        a: [
          'Only people marked under "Who watched?" rate a show and count in its stats. New shows only list you, so add the others if they watched with you.',
          'To fix an older show, open it and tap the person\'s name under "Who watched?" to remove them.',
        ],
      },
      {
        id: 'month',
        q: 'How do I log something we watched in an earlier month?',
        a: [
          'Tap +, then tap Change next to "Adding to <month>" and pick the month.',
          'A show can\'t be filed before its season premiered; the app moves it to the right month and tells you.',
          'You can also change "Watched in" on any show.',
        ],
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
        id: 'react',
        q: 'How do reactions and the family chat work?',
        a: [
          'Once everyone\'s stars are revealed, tap + under someone\'s stars to react (😂 🔥 😱 👏 🙄 ❤️). Tap your emoji again to take it back.',
          'Each show has a Family chat under the ratings, open while you\'re watching. When a show is finished, watchers read and write after they rate, so nobody\'s stars get nudged.',
          'New messages and reactions pop up at the bottom the next time you open the app.',
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
    title: 'Sharing',
    items: [
      {
        id: 'share',
        q: 'How do I show the family what we\'re watching?',
        a: [
          'Stats → tap any month → Share: a picture of that month\'s shows, your stars and totals.',
          'On a show\'s page, tap the share icon at the top for that show with everyone\'s stars.',
          'It opens your phone\'s share sheet, so you can send it on WhatsApp, Messages or anywhere. Stars that are still hidden (blind rating) stay hidden in the picture.',
          'To have them join and log their own shows, Leandro shares the invite code from the Family tab.',
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
