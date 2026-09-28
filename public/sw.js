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

const VERSION = 'v5'
/** Замінюється на відбиток збірки; у dev так і лишається 'dev'. */
const BUILD = 'dev'
/** JS/CSS та PDF-worker зі збірки, підставляє Vite. */
const BUILD_ASSETS = []

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

/** Додаткові файли оболонки: їхня невдача не блокує сам розклад. */
const PRECACHE = [
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
      // Перша сторінка завантажилась до появи worker: її JS і CSS ще
      // не проходили через fetch нижче. Без них перше офлайн-відкриття
      // дає порожній екран. Неповна оболонка не замінює робочий worker.
      await cache.addAll(
        [SHELL, ...BUILD_ASSETS].map((path) => new Request(new URL(path, SHELL), { cache: 'reload' })),
      )
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

async function networkFirst(request, key) {
  const cache = await caches.open(CACHE)
  try {
    const fresh = await fetch(request)
    if (fresh.ok) {
      await cache.put(key, fresh.clone()).catch(() => {})
    } else {
      const cached = await cache.match(key)
      if (cached) return cached
    }
    return fresh
  } catch {
    const cached = await cache.match(key)
    if (cached) return cached
    return new Response('Немає з’єднання, а збереженої копії ще немає.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  // <script crossorigin> надсилає Origin, а install-fetch може його
  // не мати. Vary: Origin тоді приховував уже збережені JS/CSS офлайн.
  // Тут лише власні статичні файли, їхній вміст від Origin не залежить.
  const cached = await cache.match(request, { ignoreVary: true })
  if (cached) return cached

  const fresh = await fetch(request)
  // Кладемо тільки повні власні відповіді — без часткових і чужих.
  if (fresh.ok && fresh.status === 200 && fresh.type === 'basic') {
    await cache.put(request, fresh.clone()).catch(() => {})
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

  // Політика приватності та інші документи мають власну офлайн-копію.
  // Їхня HTML-сторінка не повинна підмінити головну оболонку розкладу.
  if (request.mode === 'navigate') {
    const shellPath = new URL(SHELL).pathname
    const isShell = url.pathname === shellPath || url.pathname === `${shellPath}index.html`
    event.respondWith(networkFirst(request, isShell ? SHELL : request))
    return
  }

  event.respondWith(cacheFirst(request))
})
