/**
 * Підручники по класах.
 *
 * Самі книжки й посилання тепер у паку (`pack.ts`) — тут лишаються типи
 * й функції пошуку. Як оновити список, див. `seed/books.ts`.
 */

import { pack } from './pack'

export type Book = {
  title: string
  /** Уточнення: «Частина 1», «Зошит з друкованою основою», «Атлас». */
  note?: string
  authors?: string
  /** Пряме посилання на PDF. Немає — кнопки завантаження теж немає. */
  url?: string
  /**
   * Скільки сторінок у файлі — показуємо, щоб було видно обсяг.
   */
  pages?: number
  /**
   * Чи це повний підручник на рік. `false` (за замовчуванням) — матеріали
   * поточних тижнів: «Інтелект України» викладає підручник частинами, і
   * нові тижні доливаються протягом року.
   */
  full?: boolean
}

export type BookGroup = {
  /**
   * Код предмета з `SUBJECTS` — щоб група знайшлась за розкладом
   * (напр. у підручниках учителя). Якщо предмета в розкладі немає,
   * досить самого `title`.
   */
  subject?: string
  /**
   * Заголовок групи, коли він точніший за назву предмета: алгебра й
   * геометрія в розкладі стоять одним кодом «М», а підручники різні.
   */
  title?: string
  books: Book[]
}

export const BOOKS = pack.books

/** Паралель класу: «9б» → «9». */
export function gradeOf(classId: string): string {
  return String(parseInt(classId, 10))
}

export function booksForClass(classId: string): BookGroup[] {
  return BOOKS[gradeOf(classId)] ?? []
}

/**
 * Підручники паралелі — лише з цих предметів (коди як у `SUBJECTS`).
 * Так учитель бачить свій предмет у кожній паралелі, де він викладає,
 * а не весь перелік класу.
 */
export function booksForGrade(grade: string, subjects: string[]): BookGroup[] {
  return (BOOKS[grade] ?? []).filter((g) => g.subject && subjects.includes(g.subject))
}
