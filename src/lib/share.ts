/**
 * Поділитися налаштованим розкладом.
 *
 * НАВІЩО. Найдовша частина знайомства із застосунком — не встановити
 * його, а налаштувати: обрати клас, згадати свою підгрупу англійської,
 * завести всі гуртки з часом і дорогою. Один раз це робить хтось із
 * батьків, а потім те саме вручну повторюють на телефоні дитини, у
 * бабусі й у двох однокласників. Тут це стає одним дотиком.
 *
 * ДВА ШЛЯХИ, ОДИН ВАНТАЖ:
 *
 *   · **Файл** `.dzvinka` — через «Поділитися», тобто AirDrop, повідомлення,
 *     «Файли». Відкривається одразу в застосунку.
 *   · **Посилання** — те саме, тільки складене в адресу сайта. Його можна
 *     кинути в чат, і воно відкриється навіть у того, хто застосунку ще
 *     не має.
 *
 * ЧОГО ТУТ НЕМАЄ. Сервера. Вантаж їде цілком усередині посилання, у
 * тій його частині (`#...`), яка за визначенням нікуди не надсилається:
 * браузер не передає її на сервер навіть тоді, коли відкриває сторінку.
 * Тобто поділитися можна, а підглянути — нема кому.
 *
 * ПРО ЧУЖІ ДАНІ. У гуртках лежать імена тренерів, телефони й нотатки.
 * Поділитись ними випадково легко, тож за замовчуванням телефони й
 * нотатки не їдуть — і на екрані перед відправкою видно, що саме піде.
 */

import { SCHOOL } from '../data/seed/config'
import type { Club, Groups, Profile } from './prefs'
import { knownClass, nextClubId, readClub, readGroups } from './prefs'

/** Версія вантажу. Піднімається, коли старий застосунок його вже не прочитає. */
const VERSION = 1

/**
 * Скільки знаків вантажу ще розумно класти в посилання.
 *
 * Обмеження не браузера, а месенджерів: довге посилання вони ріжуть або
 * ламають переносом. Не влізло — лишається файл, і про це треба сказати
 * прямо, а не віддати обірваний рядок.
 */
export const LINK_LIMIT = 6000

export type SharePack = {
  v: number
  /** Ключ школи. Чужу школу імпортувати нема сенсу — розкладу від неї немає. */
  school: string
  /** Як підписати профіль: «Марійка». */
  name: string
  /** Клас і поділи. Немає — це вантаж лише з гуртками. */
  cls?: Groups & { id: string }
  clubs?: Club[]
}

export type ShareOptions = {
  /** Клас і поділи. */
  schedule: boolean
  clubs: boolean
  /** Прибрати телефони й нотатки — там бувають чужі дані. */
  clean: boolean
}

/** Гурток без того, чим ділитися не варто. */
function tidy(club: Club, clean: boolean): Club {
  if (!clean) return club
  const { phone, note, ...rest } = club
  void phone
  void note
  return rest
}

export function buildPack(profile: Profile, options: ShareOptions): SharePack {
  const pack: SharePack = {
    v: VERSION,
    school: SCHOOL.id,
    name: profile.name,
  }

  if (options.schedule) {
    pack.cls = {
      id: profile.classId,
      classGroup: profile.classGroup,
      language: profile.language,
      english: profile.english,
      gender: profile.gender,
    }
  }
  if (options.clubs && profile.clubs.length > 0) {
    pack.clubs = profile.clubs.map((club) => tidy(club, options.clean))
  }

  return pack
}

/* ── Кодування ───────────────────────────────────────────────────────── */

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(code: string): string | null {
  try {
    const padded = code.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

export function encodePack(pack: SharePack): string {
  return toBase64Url(JSON.stringify(pack))
}

/**
 * Читає вантаж, перевіряючи все підряд.
 *
 * Прийти він може звідки завгодно — з чату, з файла, з підміненого
 * посилання. Тому жодному полю тут не вірять на слово: гуртки проходять
 * ту саму перевірку, що й дані зі сховища, а клас і поділи перевіряє
 * той, хто імпортує (`lib/prefs.ts`).
 */
export function decodePack(code: string): SharePack | null {
  const text = fromBase64Url(code.trim())
  if (!text) return null

  try {
    const raw: unknown = JSON.parse(text)
    if (typeof raw !== 'object' || raw === null) return null
    const it = raw as Partial<SharePack>
    if (it.v !== VERSION || typeof it.school !== 'string') return null

    const clubs = Array.isArray(it.clubs)
      ? it.clubs.map(readClub).filter((c): c is Club => c !== null)
      : undefined

    return {
      v: VERSION,
      school: it.school,
      name: typeof it.name === 'string' ? it.name.slice(0, 40) : '',
      cls: typeof it.cls === 'object' && it.cls !== null ? it.cls : undefined,
      clubs: clubs && clubs.length > 0 ? clubs : undefined,
    }
  } catch {
    return null
  }
}

/* ── Посилання й файл ────────────────────────────────────────────────── */

/** Мітка в адресі, за якою застосунок упізнає вантаж. */
export const SHARE_HASH = '#s='

export function packLink(pack: SharePack): string {
  const base = new URL(import.meta.env.BASE_URL, window.location.href)
  return `${base.href}${SHARE_HASH}${encodePack(pack)}`
}

/** Вантаж із адреси, якщо він там є. Заразом прибирає його з адреси. */
export function takePackFromUrl(): SharePack | null {
  const hash = window.location.hash
  if (!hash.startsWith(SHARE_HASH)) return null

  const pack = decodePack(hash.slice(SHARE_HASH.length))
  // Прибираємо мітку одразу: інакше вона переживе перезавантаження і
  // запропонує імпорт удруге, уже після того, як його зробили.
  history.replaceState(null, '', window.location.pathname + window.location.search)
  return pack
}

export function packFile(pack: SharePack): File {
  const name = pack.name.trim() || 'Розклад'
  return new File([JSON.stringify(pack)], `${name}.dzvinka`, {
    type: 'application/json',
  })
}

/** Чи вміє цей браузер віддати файл у «Поділитися» (звідти й AirDrop). */
export function canShareFile(pack: SharePack): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [packFile(pack)] })
  } catch {
    return false
  }
}

/* ── Що з цим робити ─────────────────────────────────────────────────── */

/**
 * Профіль із вантажу.
 *
 * Жодному полю не віримо: клас має існувати в розкладі, поділи —
 * бути з відомого набору. Прийшло щось інше — беремо своє за
 * замовчуванням, а не ламаємось.
 */
export function profileFromPack(pack: SharePack, id: string, fallbackClass: string): Profile {
  const cls = pack.cls ? knownClass(pack.cls.id) : null
  return {
    ...readGroups((pack.cls ?? {}) as Record<string, unknown>),
    id,
    name: pack.name,
    classId: cls ?? fallbackClass,
    teacherId: null,
    clubs: pack.clubs ?? [],
  }
}

/**
 * Додає гуртки до наявних, не стираючи нічого.
 *
 * Ключі гуртків унікальні лише в межах профілю, тож у вантажі цілком
 * може приїхати свій «г1» — і без перейменування він мовчки затер би
 * чужий футбол.
 */
export function mergeClubs(existing: Club[], incoming: Club[]): Club[] {
  const out = [...existing]
  for (const club of incoming) {
    // Той самий гурток удруге додавати нема сенсу.
    const same = out.some(
      (c) => c.name === club.name && c.start === club.start && String(c.days) === String(club.days),
    )
    if (same) continue
    out.push({ ...club, id: nextClubId(out) })
  }
  return out
}
