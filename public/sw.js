/*
 * Service worker: щоб розклад відкривався навіть без інтернету.
 *
 * Стратегія навмисно проста:
 *   · сторінка (навігація) — спершу мережа, офлайн беремо збережену копію;
 *   · решта файлів — спершу кеш (у зібраних файлів хеш в імені, вони незмінні).
 *
 * Піднімайте VERSION, коли треба примусово скинути старий кеш.
 */

const VERSION = 'v2'
const CACHE = `rozklad-10b-${VERSION}`

/** Адреса оболонки застосунку: та сама папка, де лежить цей файл. */
const SHELL = new URL('./', self.location).href

/** Те, без чого перше офлайн-відкриття не спрацює. */
const PRECACHE = [
  SHELL,
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // Кожен файл окремо: одна невдача не повинна зривати всю установку.
      await Promise.all(
        PRECACHE.map((path) => cache.add(new Request(path, { cache: 'reload' })).catch(() => {})),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)))
      await self.clients.claim()
    })(),
  )
})

async function networkFirst(request) {
  const cache = await caches.open(CACHE)
  try {
    const fresh = await fetch(request)
    if (fresh.ok) cache.put(SHELL, fresh.clone())
    return fresh
  } catch {
    const cached = await cache.match(SHELL)
    if (cached) return cached
    return new Response('Немає з’єднання, а збереженої копії ще немає.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  if (cached) return cached

  const fresh = await fetch(request)
  // Кладемо тільки повні власні відповіді — без часткових і чужих.
  if (fresh.ok && fresh.status === 200 && fresh.type === 'basic') {
    cache.put(request, fresh.clone())
  }
  return fresh
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Будь-яка навігація всередині застосунку веде до однієї й тієї ж оболонки.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  event.respondWith(cacheFirst(request))
})
