/**
 * Особливі дні: свята, лінійки, дні без уроків.
 *
 * Прив'язані до конкретної дати (за київським календарем), а не до дня
 * тижня, — тож перекривають звичайний розклад саме на цей день.
 *
 * ЩОБ ДОДАТИ ДЕНЬ — впишіть запис із датою `рррр-мм-дд`. Мінусова дата
 * автоматично «застаріває»: коли вона мине, застосунок просто повертається
 * до звичайного розкладу, нічого прибирати не треба.
 */

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

export const SPECIAL_DAYS: SpecialDay[] = [
  {
    date: '2026-09-01',
    title: 'День знань',
    emoji: '🎒',
    noLessons: true,
    note: 'Перший дзвоник. Уроків сьогодні немає.',
    events: [{ time: '10:00', title: 'Урочиста лінійка', where: 'шкільне подвір’я' }],
  },
]

/** Особливий день на цю дату, або `null`. */
export function specialDayOn(date: {
  year: number
  month: number
  day: number
}): SpecialDay | null {
  const key = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
  return SPECIAL_DAYS.find((d) => d.date === key) ?? null
}
