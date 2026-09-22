/**
 * Стан повітряної тривоги — маленьким статичним файлом.
 *
 * НАВІЩО ВЗАГАЛІ ПОСЕРЕДНИК. Офіційне джерело (alerts.in.ua) працює по
 * токену, а токен у застосунку — це токен, викладений у застосунку:
 * його дістануть із бінарника за годину, і забанять не того, хто дістав,
 * а нас. Плюс ліміт там ~10 запитів на хвилину на токен — на всіх
 * користувачів разом цього не вистачить нізащо.
 *
 * ТОМУ: один Worker питає джерело раз на хвилину й кладе результат у R2
 * звичайним файлом. Скільки б не було телефонів, запит до alerts.in.ua
 * один — а телефони читають файл із R2, повз Worker, тобто задарма.
 * Точно так само в цьому проєкті влаштований і сам розклад
 * (`src/data/pack.ts`): дані — це файл, а не сервіс.
 *
 * ЩО ВІДДАЄМО. Тільки те, без чого не обійтись:
 *
 *   { "v": 1, "at": "2026-09-22T10:31:00.000Z",
 *     "regions": { "13": { "level": 2, "since": "2026-09-22T10:05:00Z" } } }
 *
 * Регіони без тривоги в документ не потрапляють зовсім: порожньо —
 * значить, тихо. Нічого про користувачів тут немає й бути не може —
 * ми їх навіть не бачимо.
 */

/** Рівні, як їх оголошують з 5 вересня 2026 (постанова КМУ №1092). */
const LEVEL = { yellow: 1, red: 2 }

/**
 * Рахуємо лише повітряну тривогу. Артилерія, вуличні бої, хімічна й
 * радіаційна загроза — інші події з іншими діями; змішати їх в одну
 * «тривогу» означало б збрехати.
 */
const AIR_RAID = 'air_raid'

const SOURCE = 'https://api.alerts.in.ua/v1/alerts/active.json'

import { OBLASTS, RAIONS, ancestors, raionsOf } from './places.js'

/** Ім'я файла в бакеті. Те саме, що читає застосунок. */
const KEY = 'alerts.json'

/**
 * Рівень із того, що прийшло.
 *
 * Поле нове, і його може не бути: тривога існувала задовго до рівнів.
 * Немає рівня — це звичайна повітряна тривога, і мовчати про неї не
 * можна; тому запасний варіант — жовтий, а не «нічого».
 */
function levelOf(alert) {
  const raw = alert.alert_level ?? alert.level
  if (typeof raw === 'number') return raw >= 2 ? LEVEL.red : LEVEL.yellow
  if (typeof raw === 'string') {
    const name = raw.toLowerCase()
    if (name === 'red' || name === 'червоний') return LEVEL.red
    if (name === 'yellow' || name === 'жовтий') return LEVEL.yellow
  }
  return LEVEL.yellow
}

/**
 * Назва області → її uid.
 *
 * ЧОМУ ПО НАЗВІ, А НЕ ПО `location_oblast_uid`. Бо це поле бреше: у
 * записів дрібніших за область воно просто дублює `location_uid`
 * (громада 1313 → «область» 1313). Перевірено на живій відповіді.
 * Єдине, що справді вказує на область, — текстове `location_oblast`.
 */
const OBLAST_BY_NAME = {
  'Вінницька область': 4,
  'Волинська область': 8,
  'Дніпропетровська область': 9,
  'Донецька область': 28,
  'Житомирська область': 10,
  'Закарпатська область': 11,
  'Запорізька область': 12,
  'Івано-Франківська область': 13,
  'Київська область': 14,
  'м. Київ': 31,
  'Кіровоградська область': 15,
  'Луганська область': 16,
  'Львівська область': 27,
  'Миколаївська область': 17,
  'Одеська область': 18,
  'Полтавська область': 19,
  'Рівненська область': 5,
  'Сумська область': 20,
  'Тернопільська область': 21,
  'Харківська область': 22,
  'Херсонська область': 23,
  'Хмельницька область': 3,
  'Черкаська область': 24,
  'Чернівецька область': 26,
  'Чернігівська область': 25,
  'Автономна Республіка Крим': 29,
  'м. Севастополь': 30,
}

/** Що взагалі можна обрати в застосунку: області та райони. */
const PICKABLE = new Set([...OBLASTS, ...RAIONS])

/** Скільки назв показувати, перш ніж написати «та інші». */
const MAX_PLACES = 2

/**
 * Куди тягнеться тривога, оголошена в цьому місці.
 *
 * Угору — частково: тривога в одній громаді не означає, що гуде вся
 * область, і писати про неї так — це привчити не вірити застосунку.
 * Униз — цілком: тривога по області стосується кожного її району.
 *
 * Спускаємось рівно на один рівень, бо глибше нікого не питають:
 * громад у виборі немає.
 */
function reach(alert) {
  const uid = Number(alert.location_uid)
  const out = []

  if (PICKABLE.has(uid)) out.push({ uid, whole: true })

  for (const up of ancestors(uid)) {
    if (PICKABLE.has(up)) out.push({ uid: up, whole: false })
  }

  // Область у відповіді інколи приходить без власного `location_uid`
  // з нашого переліку — тоді впізнаємо її за назвою.
  const named = OBLAST_BY_NAME[alert.location_title]
  if (alert.location_type === 'oblast' && named) {
    if (!out.some((it) => it.uid === named)) out.push({ uid: named, whole: true })
    for (const raion of raionsOf(named)) out.push({ uid: raion, whole: true })
  }

  // Громада чи місто, яких немає в переліку: доводимо хоча б до області.
  if (out.length === 0 && OBLAST_BY_NAME[alert.location_oblast]) {
    out.push({ uid: OBLAST_BY_NAME[alert.location_oblast], whole: false })
  }

  return out
}

export function buildFeed(payload, now) {
  const found = new Map()

  for (const alert of payload?.alerts ?? []) {
    if (alert.alert_type !== AIR_RAID) continue
    if (alert.finished_at) continue

    const level = levelOf(alert)
    const since = alert.started_at ?? null
    const title = alert.location_title ?? null

    for (const { uid, whole } of reach(alert)) {
      const key = String(uid)
      const known = found.get(key)
      if (!known) {
        found.set(key, { level, since, whole, places: whole ? [] : [title] })
        continue
      }
      if (level > known.level) known.level = level
      if (since && (!known.since || since < known.since)) known.since = since
      if (whole) known.whole = true
      else if (title) known.places.push(title)
    }
  }

  const regions = {}
  for (const [uid, it] of found) {
    const entry = { level: it.level, since: it.since }
    // Тривога в одному районі області — це не тривога в усій області, і
    // писати про неї так означало б лякати пів краю. Кажемо, де саме.
    if (!it.whole) {
      const names = [...new Set(it.places.filter(Boolean))]
      if (names.length > 0) {
        entry.scope = 'part'
        entry.where =
          names.length > MAX_PLACES
            ? `${names.slice(0, MAX_PLACES).join(', ')} та інші`
            : names.join(', ')
      }
    }
    regions[uid] = entry
  }

  return { v: 1, at: now, regions }
}

async function refresh(env) {
  const response = await fetch(SOURCE, {
    headers: { Authorization: `Bearer ${env.ALERTS_TOKEN}` },
  })
  if (!response.ok) throw new Error(`alerts.in.ua: ${response.status}`)

  const feed = buildFeed(await response.json(), new Date().toISOString())
  const body = JSON.stringify(feed)

  await env.ALERTS.put(KEY, body, {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      // Півхвилини: частіше телефон і так не питає, а застарілий стан
      // тривоги гірший за відсутній.
      cacheControl: 'public, max-age=30',
    },
  })

  return body
}

export default {
  /** Раз на хвилину за розкладом cron. */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(refresh(env))
  },

  /**
   * Через сам Worker ходити не треба — застосунок читає файл із R2.
   * Ця ручка потрібна для двох речей: перевірити, що токен живий, і
   * оновити файл руками, не чекаючи наступної хвилини.
   */
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname !== '/refresh') {
      return new Response('Читайте alerts.json із бакета, а не звідси.\n', { status: 404 })
    }
    if (env.REFRESH_KEY && url.searchParams.get('key') !== env.REFRESH_KEY) {
      return new Response('Ні.\n', { status: 403 })
    }

    try {
      return new Response(await refresh(env), {
        headers: { 'content-type': 'application/json; charset=utf-8' },
      })
    } catch (error) {
      return new Response(`${error}\n`, { status: 502 })
    }
  },
}
