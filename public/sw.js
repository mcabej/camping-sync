// The worker exists for one situation: a campsite with no signal. The shell is
// kept so the app opens at all, and the last trip state the server sent is kept
// so it opens showing your list rather than an empty one.
//
// Both placeholders are stamped by server.js at boot from the same asset hashes
// that go into index.html — so a deploy changes this file's bytes, which is
// exactly what makes a browser treat it as a new worker.
const VERSION = '__VERSION__'
const PRECACHE = JSON.parse('__PRECACHE__')

// The shell is thrown away and refetched on every deploy; the data and the
// fonts outlive it, because a version bump is no reason to lose the list you
// were shown last night or to redownload a typeface that never changes.
const SHELL = `shell-${VERSION}`
const DATA = 'data-v1'
const FONTS = 'fonts-v1'
const KEEP = new Set([SHELL, DATA, FONTS])

const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com'])

// Trip state, the catalogue and the forecast are worth keeping. The revision
// counter is not: it is a question about right now, and a cached answer to it
// would tell a phone nothing has changed for as long as it stays offline.
//
// A forecast is the one cached answer that goes off on its own, so it carries
// the time it was fetched and the card says how old it is. Last night's outlook
// is worth having in a field with no bars; last night's outlook presented as
// this morning's would not be.
const CACHEABLE_API = /^\/api\/(catalog|weather|trips\/[^/]+(?:\/messages)?)$/

// Nothing here is huge, but a phone that has opened forty trips should not keep
// all forty forever. Oldest out first — the Cache API hands keys back in
// insertion order, and a refetched entry is deleted before it is re-put below.
const DATA_LIMIT = 30

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL)
    await cache.addAll(PRECACHE)
    // The running page keeps the code it booted with either way, so waiting
    // would only mean the next launch is the one that gets the new files.
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((n) => !KEEP.has(n)).map((n) => caches.delete(n)))
    await self.clients.claim()
    // A controller changing only says which worker owns the page; it does not
    // say whether the page itself is old. Give every open page the actual build
    // so it can make that comparison without a false reload warning.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) client.postMessage({ type: 'app-version', version: VERSION })
  })())
})

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let message = {}
    try { message = event.data?.json() ?? {} } catch { /* malformed payload */ }
    const url = typeof message.url === 'string' ? message.url : '/'
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const alreadyReading = windows.some((client) => {
      try { return client.visibilityState === 'visible' && new URL(client.url).pathname === url } catch { return false }
    })

    await self.registration.showNotification(message.title || 'Camping Sync', {
      body: message.body || 'There is a new Planning Room message.',
      icon: '/icons/icon-192.png',
      badge: '/icons/maskable-192.png',
      tag: message.tag || 'planning-room',
      renotify: false,
      silent: alreadyReading,
      data: { url },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const url = event.notification.data?.url || '/'
    const absolute = new URL(url, self.location.origin).href
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const exact = windows.find((client) => client.url === absolute)
    if (exact) return exact.focus()
    const existing = windows[0]
    if (existing) {
      if ('navigate' in existing && existing.url !== absolute) {
        const moved = await existing.navigate(absolute).catch(() => null)
        if (!moved) return self.clients.openWindow(absolute)
      }
      return existing.focus()
    }
    return self.clients.openWindow(absolute)
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  // A write is never answered from a cache and never replayed later: two people
  // are editing this list, and a claim that lands an hour late is a lie about
  // who is bringing the tent.
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) {
    if (FONT_HOSTS.has(url.hostname)) event.respondWith(fromCacheFirst(request, FONTS))
    return
  }

  // Network first, so a phone that has a signal always lands on the current
  // index.html — the one file carrying the hashes everything else hangs off.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/', { cacheName: SHELL })))
    return
  }

  if (url.pathname.startsWith('/api/')) {
    if (CACHEABLE_API.test(url.pathname)) event.respondWith(fromNetworkFirst(request))
    return
  }

  event.respondWith(fromCacheFirst(request, SHELL))
})

// For anything named by a hash of its own bytes, and for fonts. The cache is
// the answer; the network is only consulted for something that isn't in it yet.
async function fromCacheFirst(request, cacheName) {
  const hit = await caches.match(request, { cacheName })
  if (hit) return hit
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(request)
    // An opaque response is a cross-origin font we are not allowed to read.
    // It still renders, so it is still worth keeping.
    if (res.ok || res.type === 'opaque') await cache.put(request, res.clone())
    return res
  } catch (err) {
    // A shell asset that is missing under its exact URL is one whose hash moved
    // on — the last copy of it is better than a blank screen.
    const stale = await caches.match(request, { cacheName, ignoreSearch: true })
    if (stale) return stale
    throw err
  }
}

// For trip state. The server is always right when it can be reached; the cache
// is the last thing it said, kept only so there is something to show when it
// can't. Responses vary by the member and signed-in user headers, which the
// Cache API honours, so a signed-out request cannot receive private state kept
// for the previous session on a shared phone.
async function fromNetworkFirst(request) {
  const cache = await caches.open(DATA)
  try {
    const res = await fetch(request)
    if (res.ok) {
      await cache.delete(request)
      await cache.put(request, res.clone())
      await trim(cache)
    }
    return res
  } catch (err) {
    const hit = await cache.match(request)
    if (hit) return hit
    throw err
  }
}

async function trim(cache) {
  const keys = await cache.keys()
  for (const key of keys.slice(0, keys.length - DATA_LIMIT)) await cache.delete(key)
}
