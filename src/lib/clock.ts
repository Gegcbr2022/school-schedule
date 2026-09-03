/**
 * Час. Усе рахуємо за Києвом, а не за годинником пристрою:
 * учень може відкрити розклад із будь-якого часового поясу,
 * а дзвінки все одно дзвонять у школі.
 */

const KYIV = 'Europe/Kyiv'

/** Скільки повних хвилин у добі — щоб не плутатись у порівняннях. */
export const DAY_MINUTES = 24 * 60

export type KyivTime = {
  /** Рік, місяць (1–12), день — за київським календарем. */
  year: number
  month: number
  day: number
  /** День тижня за ISO: 1 = понеділок … 7 = неділя. */
  iso: number
  /** Хвилини від київської півночі, з дробовою частиною секунд. */
  minutes: number
}

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: KYIV,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** Розбирає момент часу у київські календарні поля. Враховує перехід на літній час. */
export function kyivNow(now: Date = new Date()): KyivTime {
  const parts = partsFormatter.formatToParts(now)
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((p) => p.type === type)
    return found ? Number(found.value) : 0
  }

  const year = get('year')
  const month = get('month')
  const day = get('day')

  // getUTCDay() повертає 0 для неділі — переводимо в ISO (1..7).
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const iso = weekday === 0 ? 7 : weekday

  return {
    year,
    month,
    day,
    iso,
    minutes: get('hour') * 60 + get('minute') + get('second') / 60,
  }
}

/* ── Номер тижня (чисельник / знаменник) ─────────────────────────────── */

const DAY_MS = 86_400_000

export type CalendarDate = Pick<KyivTime, 'year' | 'month' | 'day'>

/** UTC-мітка понеділка того тижня, у який потрапляє задана дата. */
function mondayOf(date: CalendarDate): number {
  const utc = Date.UTC(date.year, date.month - 1, date.day)
  // getUTCDay(): 0 = неділя. Переводимо в ISO 1..7.
  const iso = new Date(utc).getUTCDay() || 7
  return utc - (iso - 1) * DAY_MS
}

/** Понеділок того тижня, у якому 1 вересня вказаного року. */
function schoolYearAnchor(year: number): number {
  return mondayOf({ year, month: 9, day: 1 })
}

/**
 * Парність навчального тижня.
 *
 * Тиждень, у якому починається навчальний рік (той, що містить 1 вересня),
 * вважається першим. Далі — 2, 1, 2, … Уроки «через тиждень» орієнтуються
 * саме на це число.
 */
export function weekParity(date: CalendarDate): 1 | 2 {
  const monday = mondayOf(date)
  // До вересня — це ще минулий навчальний рік.
  const anchor =
    monday >= schoolYearAnchor(date.year)
      ? schoolYearAnchor(date.year)
      : schoolYearAnchor(date.year - 1)

  const weeks = Math.round((monday - anchor) / (7 * DAY_MS))
  return weeks % 2 === 0 ? 1 : 2
}

/** День тижня за ISO (1 = понеділок … 7 = неділя) для календарної дати. */
export function isoOf(date: CalendarDate): number {
  const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()
  return weekday === 0 ? 7 : weekday
}

/** Скільки цілих діб між двома датами (b - a). */
export function daysBetween(a: CalendarDate, b: CalendarDate): number {
  const ua = Date.UTC(a.year, a.month - 1, a.day)
  const ub = Date.UTC(b.year, b.month - 1, b.day)
  return Math.round((ub - ua) / DAY_MS)
}

/** Дата через `days` діб. */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day) + days * DAY_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  }
}

/** 500 → «08:20». */
export function formatTime(minutes: number): string {
  const total = Math.floor(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** «10:00» → 600 хвилин від півночі, або `null` для кривого рядка. */
export function parseTime(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
})

/** → «31 серпня». */
export function formatDateUk(time: Pick<KyivTime, 'year' | 'month' | 'day'>): string {
  return dateFormatter.format(new Date(Date.UTC(time.year, time.month - 1, time.day)))
}

/** → «2026-08-31». Стабільний ключ дати для сховища. */
export function dateKey(time: Pick<KyivTime, 'year' | 'month' | 'day'>): string {
  const m = String(time.month).padStart(2, '0')
  const d = String(time.day).padStart(2, '0')
  return `${time.year}-${m}-${d}`
}

/** «2026-08-31» → календарна дата. Зворотне до `dateKey`. */
export function parseDateKey(key: string): CalendarDate {
  const [year, month, day] = key.split('-').map(Number)
  return { year, month, day }
}

/** 95 → «1 год 35 хв», 40 → «40 хв». */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.ceil(minutes))
  if (total < 60) return `${total} хв`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? `${h} год` : `${h} год ${m} хв`
}

/** Українська множина: plural(3, ['урок', 'уроки', 'уроків']) → «уроки». */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last === 1) return forms[0]
  if (last >= 2 && last <= 4) return forms[1]
  return forms[2]
}

/** Назви днів тижня за ISO-номером. */
export const DAY_NAME: Record<number, string> = {
  1: 'Понеділок',
  2: 'Вівторок',
  3: 'Середа',
  4: 'Четвер',
  5: 'Пʼятниця',
  6: 'Субота',
  7: 'Неділя',
}

/** Знахідний відмінок — для кнопки «Переглянути середу». */
export const DAY_NAME_ACCUSATIVE: Record<number, string> = {
  1: 'понеділок',
  2: 'вівторок',
  3: 'середу',
  4: 'четвер',
  5: 'пʼятницю',
  6: 'суботу',
  7: 'неділю',
}

/** Місцевий відмінок — для «у понеділок». */
export const DAY_NAME_LOWER: Record<number, string> = {
  1: 'понеділок',
  2: 'вівторок',
  3: 'середа',
  4: 'четвер',
  5: 'пʼятниця',
  6: 'субота',
  7: 'неділя',
}
