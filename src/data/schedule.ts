/**
 * Довідники розкладу: дзвінки, предмети, вчителі, групи.
 *
 * Самі уроки лежать у `timetable.ts` — він згенерований з офіційного PDF.
 * Тут — усе, що правиться руками.
 */

/**
 * Дзвінки, предмети й назва школи тепер живуть у паку (`pack.ts`) — так
 * розклад можна оновити без нової збірки застосунку. Тут лишаються типи
 * й похідні функції; сама насінна копія — в `seed/config.ts`.
 */
import { pack } from './pack'

/* ── Дзвінки ─────────────────────────────────────────────────────────── */

export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
export type Period = (typeof PERIODS)[number]

/** Початок і кінець уроку у хвилинах від київської півночі. */
export type Bell = { start: number; end: number }

export const BELLS = pack.bells

/* ── Предмети ────────────────────────────────────────────────────────── */

export const SUBJECTS = pack.subjects

/** Повна назва предмета або саме скорочення, якщо розшифровки ще немає. */
export function subjectName(code: string): string {
  return SUBJECTS[code] ?? code
}

/* ── Вчителі ─────────────────────────────────────────────────────────── */

/*
 * У розкладі стоять дволітерні коди. Хто за ними стоїть — у
 * `teachers.ts` (згенеровано зі шкільного журналу); розшифровка й
 * розведення тезок живуть у `scripts/import-teachers.mjs`.
 * Див. `lib/teachers.ts`: `teacherOf`, `teacherLabel`.
 */

/* ── Групи ───────────────────────────────────────────────────────────── */

/**
 * Ознака, за якою ділиться клас.
 * `week` — не поділ, а чергування предмета по тижнях.
 */
export type Dim = 'classGroup' | 'english' | 'language' | 'gender' | 'week'

export type ClassGroup = '1' | '2'
export type EnglishGroup = 'а' | 'б' | 'в'
export type LanguageGroup = 'н' | 'ф'
export type GenderGroup = 'х' | 'д'

export const CLASS_GROUPS: ClassGroup[] = ['1', '2']
export const ENGLISH_GROUPS: EnglishGroup[] = ['а', 'б', 'в']
export const LANGUAGE_GROUPS: LanguageGroup[] = ['н', 'ф']
export const GENDER_GROUPS: GenderGroup[] = ['х', 'д']

/** Ключ групи у даних → до якого поділу він належить. */
export const GROUP_DIM: Record<string, Dim> = {
  '1': 'classGroup',
  '2': 'classGroup',
  а: 'english',
  б: 'english',
  в: 'english',
  н: 'language',
  ф: 'language',
  х: 'gender',
  д: 'gender',
  т1: 'week',
  т2: 'week',
}

/** Як підписати групу в повному розкладі. */
export const GROUP_LABEL: Record<string, string> = {
  '1': '1 група',
  '2': '2 група',
  а: 'група а',
  б: 'група б',
  в: 'група в',
  н: 'німецька',
  ф: 'французька',
  х: 'Хлопці',
  д: 'Дівчата',
  т1: '1 тиждень',
  т2: '2 тиждень',
}

export const LANGUAGE_LABEL: Record<LanguageGroup, string> = {
  н: 'Німецька',
  ф: 'Французька',
}

export const GENDER_LABEL: Record<GenderGroup, string> = {
  х: 'Хлопці',
  д: 'Дівчата',
}

/* ── Форма даних ─────────────────────────────────────────────────────── */

/** Парність навчального тижня; перший — той, у якому починається рік. */
export type WeekParity = 1 | 2

export type Cell = {
  /** Предмет (ключ у SUBJECTS). */
  s: string
  /** Кабінет, як у розкладі. Немає — значить, у розкладі його немає. */
  r?: string
  /** Код учителя. */
  t?: string
  /** Кому саме цей варіант (ключ у GROUP_DIM). */
  g?: string
  /** Урок буває лише на тижнях цієї парності. */
  w?: WeekParity
}

export type Lesson = {
  /** Номер періоду за розкладом дзвінків. */
  p: Period
  c: Cell[]
}

export type ClassTimetable = {
  /** Як у PDF: «10б». */
  id: string
  /** Як показуємо: «10-Б». */
  name: string
  homeroom?: string
  /** П'ять днів, Пн…Пт. */
  days: Lesson[][]
}

export const SCHOOL_NAME = pack.school.name
