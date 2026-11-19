// Offline shell: hashed assets are cache-first, the page itself is network-first.
const CACHE = 'pititi-v3'
// The number on the app icon while the app is closed (the app writes the real count here; src/hooks/useAppBadge.ts)
const BADGE_CACHE = 'pititi-badge'
const BADGE_ENTRY = '/pititi-badge-count'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== BADGE_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  // Only this app's own files; Supabase and TVmaze always go to the network
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    e.respondWith(
      // Skip the browser's HTTP cache (GitHub Pages allows 10 minutes): always the newest page when online
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./'))),
    )
    return
  }

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})

// Notifications sent by the server (messages, @mentions, new episodes)
self.addEventListener('push', (e) => {
  let data = {}
  try {
    data = e.data ? e.data.json() : {}
  } catch {
    data = { title: 'Pititi Watchers', body: e.data ? e.data.text() : '' }
  }
  e.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'Pititi Watchers', {
        body: data.body || '',
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: data.tag,
        data: { open: data.open || '' },
      }),
      bumpIconBadge(),
    ]),
  )
})

// Same as bumpBadge in src/badge.ts (tested there): one more than the stored count, unreadable = 0, at most 999
function bumpBadge(stored) {
  const n = Number.parseInt(stored == null ? '' : stored, 10)
  return Math.min(999, (Number.isFinite(n) && n > 0 ? n : 0) + 1)
}

// A push while the app is closed: the icon's number goes up by one (an open app keeps the real count itself).
// iPhone home-screen apps show it; elsewhere setAppBadge is missing or shows a dot. Never blocks the notification.
async function bumpIconBadge() {
  try {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (open.some((c) => c.visibilityState === 'visible')) return
    const cache = await caches.open(BADGE_CACHE)
    const hit = await cache.match(BADGE_ENTRY)
    const count = bumpBadge(hit ? await hit.text() : null)
    await cache.put(BADGE_ENTRY, new Response(String(count)))
    if (self.navigator.setAppBadge) await self.navigator.setAppBadge(count)
  } catch {
    // No badge this time
  }
}

// Tapping a notification opens the app on that chat (or show)
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const open = e.notification.data && e.notification.data.open
  const url = new URL(open ? `./?open=${encodeURIComponent(open)}` : './', self.registration.scope).href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const win = list.find((c) => c.url.startsWith(self.registration.scope))
      if (win) {
        win.postMessage({ type: 'open', open })
        return win.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
