/**
 * Особливі дні: свята, лінійки, дні без уроків.
 *
 * Самі дні тепер у паку (`pack.ts`) — тут лишається тип і пошук за
 * датою. Насінна копія — в `seed/special.ts`.
 */

import { pack } from './pack'

export type SpecialEvent = {
  /** Час у форматі «10:00». Без часу — просто пункт дня. */
  time?: string
  title: string
  /** Місце: «шкільне подвір'я», «актова зала». */
  where?: string
}

export type SpecialDay = {
  /** Дата за київським календарем, `рррр-мм-дд`. */
  date: string
  /** Назва дня: «День знань». */
  title: string
  emoji?: string
  /** Уроків цього дня немає — показуємо тільки події. */
  noLessons?: boolean
  /** Короткий підпис під назвою. */
  note?: string
  events?: SpecialEvent[]
}

export const SPECIAL_DAYS = pack.special

/** Особливий день на цю дату, або `null`. */
export function specialDayOn(date: {
  year: number
  month: number
  day: number
}): SpecialDay | null {
  const key = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
  return SPECIAL_DAYS.find((d) => d.date === key) ?? null
}
