/*
 * Service worker: щоб розклад відкривався навіть без інтернету.
 *
 * Стратегія навмисно проста:
 *   · сторінка (навігація) — спершу мережа, офлайн беремо збережену копію;
 *   · решта файлів — спершу кеш (у зібраних файлів хеш в імені, вони незмінні).
 *
 * Піднімайте VERSION, коли треба примусово скинути старий кеш.
 *
 * BUILD проставляє збірка (див. `stampServiceWorker` у vite.config.ts):
 * саме завдяки йому цей файл змінюється з кожним випуском. Інакше він
 * лишався б байт у байт тим самим, браузер не бачив би нової версії —
 * і встановлений застосунок оновлювався б хіба що після перевстановлення.
 */

const VERSION = 'v4'
/** Замінюється на відбиток збірки; у dev так і лишається 'dev'. */
const BUILD = 'dev'

/**
 * Префікс кешів, які належать саме оболонці. Усе, що його не має, —
 * чуже: під `rozklad-books-v1` лежать скачані підручники (`lib/library.ts`),
 * і прибирання застарілих версій не сміє їх чіпати.
 */
const SHELL_PREFIX = 'rozklad-shell-'
const CACHE = `${SHELL_PREFIX}${VERSION}-${BUILD}`

/** Кеші оболонки: нинішні з префіксом і старі, до того як префікс з'явився. */
function ownedByShell(name) {
  return name.startsWith(SHELL_PREFIX) || /^rozklad-v\d/.test(name)
}

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
      await Promise.all(
        names.filter((name) => ownedByShell(name) && name !== CACHE).map((name) => caches.delete(name)),
      )
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

  // Підручники важать десятки мегабайт — у кеш застосунку їм не місце.
  // Хай браузер качає їх сам, як звичайний файл.
  if (url.pathname.endsWith('.pdf')) return

  // Розклад повинен приходити з мережі й тільки звідти. Поклади ми його
  // в кеш — і `cacheFirst` віддавав би ту саму копію вічно, а оновлення
  // розкладу перестало б працювати взагалі. Офлайн тут нічого не ламає:
  // застосунок працює на паку, який уже лежить у localStorage.
  if (url.pathname.endsWith('/data/school.json')) return

  // Будь-яка навігація всередині застосунку веде до однієї й тієї ж оболонки.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  event.respondWith(cacheFirst(request))
})
