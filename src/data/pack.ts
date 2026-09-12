/**
 * Дані школи одним згортком — «пак».
 *
 * НАВІЩО. Досі розклад лежав у самих модулях і потрапляв у застосунок
 * під час збірки: змінився розклад — треба зібрати й викласти заново.
 * Для сайту це терпимо, для App Store — ні: там кожна збірка чекає
 * перевірки Apple по кілька днів, а розклад міняється серед тижня.
 * Тому дані живуть окремо від коду: у збірку йде «насінний» пак
 * (`seed/`), а поряд, на сервері, лежить свіжий. Застосунок підхоплює
 * свіжий сам — і на сайті, і в iOS, без переустановлення.
 *
 * ПОРЯДОК ВАЖЛИВИЙ. Пак вибирається синхронно, під час обчислення цього
 * модуля, — тобто до того, як виконається будь-який модуль, що його
 * імпортує. Саме тому в застосунку немає ані стану завантаження, ані
 * `await` на старті: `BELLS`, `TIMETABLE` і решта вже на місці, коли їх
 * уперше читають. Нічого асинхронного сюди додавати не можна.
 *
 * ЯКЩО ЩОСЬ ПІШЛО НЕ ТАК — беремо насінний пак. Він є завжди, тож
 * зіпсований чи застарий збережений пак означає лише старіший розклад,
 * а не порожній екран.
 */

import type { Bell, ClassTimetable, Period } from './schedule'
import type { Teacher } from './teachers'
import type { BookGroup } from './books'
import type { DayMenu } from './menu'
import type { SpecialDay } from './special'

import { BELLS as SEED_BELLS, SCHOOL, SUBJECTS as SEED_SUBJECTS } from './seed/config'
import { TIMETABLE as SEED_TIMETABLE } from './seed/timetable'
import { TEACHERS as SEED_TEACHERS } from './seed/teachers'
import { BOOKS as SEED_BOOKS } from './seed/books'
import { MENU as SEED_MENU, MENU_META as SEED_MENU_META } from './seed/menu'
import { SPECIAL_DAYS as SEED_SPECIAL } from './seed/special'

/** Хто ця школа і за яким календарем вона живе. */
export type SchoolInfo = {
  /** Стабільний ключ школи: латиницею, без пробілів. */
  id: string
  /** Повна назва, як її пишуть в офіційних документах. */
  name: string
  /**
   * Часовий пояс IANA.
   *
   * ПОКИ ЩО ДОВІДКОВЕ ПОЛЕ: `lib/clock.ts` тримає `Europe/Kyiv`
   * константою. Міняти його тут — нічого не змінити. Воно записане, щоб
   * школа, яка живе в іншому поясі, не з'явилась у паку без сліду, коли
   * до цього дійде черга.
   */
  timezone: string
  /**
   * Місяць і день, з яких починається навчальний рік: від понеділка
   * цього тижня рахується парність, він перший.
   *
   * Так само довідкове: `schoolYearAnchor` у `lib/clock.ts` рахує від
   * 1 вересня.
   */
  yearStart: { month: number; day: number }
}

export type MenuMeta = {
  for: string
  title: string
  /** Період дії, `рррр-мм-дд`. */
  from: string
  to: string
}

export type Pack = {
  /**
   * Версія формату. Піднімається, коли міняється форма даних так, що
   * старий застосунок їх уже не прочитає, — тоді він просто лишиться на
   * насінному паку замість того, щоб зламатись.
   */
  format: 1
  /**
   * Версія самих даних: будь-який рядок, що росте (дата збірки).
   * Порівнюється як рядок, тож формат має бути сортованим — `рррр-мм-ддТгг:хх`.
   */
  version: string
  school: SchoolInfo
  bells: Record<Period, Bell>
  subjects: Record<string, string>
  timetable: ClassTimetable[]
  teachers: Teacher[]
  books: Record<string, BookGroup[]>
  menuMeta: MenuMeta
  menu: DayMenu[]
  special: SpecialDay[]
}

export const FORMAT = 1

/** Ключ, під яким лежить завантажений пак. Не мінявся й міняти не треба. */
export const PACK_KEY = 'rozklad:pack:v1'

/**
 * Позначка «цей пак ще не довів, що з ним застосунок запускається».
 *
 * Ставиться перед тим, як віддати збережений пак, і знімається, коли
 * застосунок дійшов до малювання (`main.tsx`). Побачили її на старті —
 * значить, минулого разу з цим паком до кінця не дійшло, і він летить
 * геть. Без цього одна крива відповідь сервера означала б назавжди
 * мертвий застосунок: пак щоразу читався б наново й щоразу валив старт,
 * а прибрати його користувач може хіба що стерши дані сайту — а в
 * iOS-оболонці лише перевстановивши застосунок.
 */
const BOOT_KEY = 'rozklad:pack-boot:v1'

/**
 * Версія паку, з якою запуск уже провалився.
 *
 * Без неї підстраховка вище лікує лише один запуск: пак відкидається,
 * застосунок піднімається на насінному — і тут же тягне з сервера той
 * самий пак назад. Виходив би застосунок, який працює через раз.
 * Запам'ятавши версію, ми відмовляємось від неї остаточно — доки на
 * сервері не з'явиться інша.
 */
const BAD_KEY = 'rozklad:pack-bad:v1'

/**
 * Порядок дат, який можна порівнювати як рядки: `рррр-мм-ддТгг:хх`.
 * Саме на цьому тримається `isNewer`, тож формат — частина контракту,
 * а не побажання. Один загублений нуль («2026-9-15») зробив би версію
 * більшою за будь-яку жовтневу, і розклад застряг би на ній назавжди.
 */
const VERSION_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

/**
 * Пак, зашитий у збірку. Він же — запасний варіант на всі випадки й
 * джерело, з якого `scripts/build-pack.mjs` робить файл для сервера.
 */
export const SEED_PACK: Pack = {
  format: FORMAT,
  version: SCHOOL.seedVersion,
  school: {
    id: SCHOOL.id,
    name: SCHOOL.name,
    timezone: SCHOOL.timezone,
    yearStart: SCHOOL.yearStart,
  },
  bells: SEED_BELLS,
  subjects: SEED_SUBJECTS,
  timetable: SEED_TIMETABLE,
  teachers: SEED_TEACHERS,
  books: SEED_BOOKS,
  menuMeta: SEED_MENU_META,
  menu: SEED_MENU,
  special: SEED_SPECIAL,
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isText(value: unknown): boolean {
  return typeof value === 'string'
}

/**
 * Чи схоже це на пак, яким можна користуватись.
 *
 * Перевіряємо форму, а не зміст: чи правильний розклад — тут не
 * вирішується. Але саме форму треба перевіряти до дна, а не зверху:
 * цілі масиви читаються під час обчислення модулів (`lib/rooms.ts`,
 * `lib/teachers.ts` будують свої таблиці одразу при імпорті), тож урок
 * без днів або вчитель без прізвища валить застосунок ще до першого
 * малювання — там, де його не спіймає навіть `ErrorBoundary`.
 *
 * Усе, що не пройшло, мовчки відкидається на користь насінного паку.
 */
export function isPack(value: unknown): value is Pack {
  if (!isObject(value)) return false
  const p = value
  if (p.format !== FORMAT) return false
  if (typeof p.version !== 'string' || !VERSION_RE.test(p.version)) return false

  if (!isObject(p.school)) return false
  const school = p.school
  if (!isText(school.id) || !isText(school.name) || !isText(school.timezone)) return false
  if (!isObject(school.yearStart)) return false
  if (typeof school.yearStart.month !== 'number' || typeof school.yearStart.day !== 'number') {
    return false
  }

  // Дзвінки мусять бути на кожен період: `BELLS[p]` читають і `lib/lessons.ts`,
  // і `lib/rooms.ts`, і жоден з них не переживе `undefined`.
  //
  // Перелік потрібних періодів беремо з насінного паку, а не з `PERIODS`
  // у `schedule.ts`: той модуль сам читає звідси, і імпорт значення з
  // нього замкнув би коло — застосунок падав би ще на старті.
  if (!isObject(p.bells)) return false
  for (const period of Object.keys(SEED_BELLS)) {
    const bell = (p.bells as Record<string, unknown>)[period]
    if (!isObject(bell)) return false
    if (typeof bell.start !== 'number' || typeof bell.end !== 'number') return false
  }

  if (!isObject(p.subjects) || !Object.values(p.subjects).every(isText)) return false

  if (!Array.isArray(p.timetable) || p.timetable.length === 0) return false
  const classesOk = p.timetable.every(
    (cls) => isObject(cls) && isText(cls.id) && isText(cls.name) && Array.isArray(cls.days),
  )
  if (!classesOk) return false

  if (!Array.isArray(p.teachers)) return false
  const teachersOk = p.teachers.every(
    (t) => isObject(t) && typeof t.id === 'number' && isText(t.code) && isText(t.last) && isText(t.first),
  )
  if (!teachersOk) return false

  if (!Array.isArray(p.special) || !p.special.every((d) => isObject(d) && isText(d.date) && isText(d.title))) {
    return false
  }

  if (!Array.isArray(p.menu)) return false
  if (!isObject(p.menuMeta)) return false
  const meta = p.menuMeta
  if (!isText(meta.for) || !isText(meta.title) || !isText(meta.from) || !isText(meta.to)) return false

  return isObject(p.books)
}

/** Котрий із двох паків свіжіший. Однакові версії — лишаємо той, що вже є. */
export function isNewer(candidate: Pack, current: Pack): boolean {
  return candidate.version > current.version
}

function forget(): void {
  try {
    localStorage.removeItem(PACK_KEY)
    localStorage.removeItem(BOOT_KEY)
  } catch {
    /* Нема куди писати — значить, нема й що прибирати. */
  }
}

/**
 * Застосунок дійшов до кінця запуску. Викликає `main.tsx` після того, як
 * інтерфейс намальовано: з цієї миті пак вважається придатним.
 */
export function packBooted(): void {
  try {
    localStorage.removeItem(BOOT_KEY)
  } catch {
    /* дрібниця */
  }
}

/**
 * Чи це та сама версія, на якій застосунок уже не піднявся. Питає
 * `lib/packUpdate.ts`, перш ніж зберігати те, що прийшло з сервера.
 */
export function isRejected(version: string): boolean {
  try {
    return localStorage.getItem(BAD_KEY) === version
  } catch {
    return false
  }
}

function storedPack(): Pack | null {
  let raw: string | null = null
  let unproven = false
  try {
    raw = localStorage.getItem(PACK_KEY)
    unproven = localStorage.getItem(BOOT_KEY) !== null
  } catch {
    // Приватний режим або вимкнені дані сайту — працюємо на насінному паку.
    return null
  }
  if (!raw) return null

  // Минулого разу з цим паком запуск не завершився. Другої спроби він не
  // отримує: краще старіший розклад, ніж білий екран щоразу.
  if (unproven) {
    try {
      const failed = localStorage.getItem(BOOT_KEY)
      if (failed) localStorage.setItem(BAD_KEY, failed)
    } catch {
      /* не запам'ятали — гірше, але не смертельно */
    }
    forget()
    return null
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isPack(parsed)) {
      // Битий або чужого формату — тримати його немає сенсу.
      forget()
      return null
    }
    // Насінний пак у новій збірці може виявитись свіжішим за збережений.
    if (!isNewer(parsed, SEED_PACK)) return null

    try {
      localStorage.setItem(BOOT_KEY, parsed.version)
    } catch {
      /* Не змогли поставити позначку — просто працюємо без підстраховки. */
    }
    return parsed
  } catch {
    forget()
    return null
  }
}

/**
 * Пак, на якому працює цей запуск застосунку.
 *
 * Вибирається один раз. Свіжий пак, який прийде з мережі вже під час
 * роботи, застосується з наступного відкриття (див. `lib/packUpdate.ts`):
 * міняти розклад під руками в людини, яка саме на нього дивиться, гірше,
 * ніж показати його на хвилину довше.
 */
export const pack: Pack = storedPack() ?? SEED_PACK
