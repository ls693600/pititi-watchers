import { flushSync } from 'react-dom'

// Screen changes animate with the browser's View Transitions: the tapped poster grows into the show page, other
// screen changes cross-fade. Phones without it (older iOS) and "Reduce motion" just switch instantly, as before.

/** Where the last tap landed, to find the poster that was tapped. */
let lastTap: Element | null = null
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => (lastTap = e.target as Element), { capture: true, passive: true })
}

const NAME = 'poster'

function canAnimate(): boolean {
  if (typeof document === 'undefined' || !('startViewTransition' in document)) return false
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** The poster image inside whatever was just tapped (a grid card, the Currently watching card, a list row). */
function tappedPoster(): HTMLElement | null {
  const card = lastTap?.closest('.pcard, .hero, .lrow, .qrow, .back-row, .feed-item, li, button')
  return (card?.querySelector('img.poster, .pcard-img img, .poster, img') as HTMLElement | null) ?? null
}

/** Run a screen change as an animated transition. `grow`: the tapped poster becomes the show page's poster. */
export function animate(update: () => void, grow = false): void {
  if (!canAnimate()) return update()
  const from = grow ? tappedPoster() : null
  if (from) from.style.viewTransitionName = NAME
  const vt = document.startViewTransition(() => {
    if (from) from.style.viewTransitionName = ''
    flushSync(update)
  })
  vt.finished.finally(() => {
    if (from) from.style.viewTransitionName = ''
    lastTap = null
  })
}
