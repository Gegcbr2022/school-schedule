/**
 * Розклад уроків 10-Б · Ліцей №11 Івано-Франківської міської ради
 *
 * ЄДИНЕ МІСЦЕ, ДЕ ТРЕБА РЕДАГУВАТИ РОЗКЛАД.
 *
 * - Час уроків живе тільки в `BELLS` (не дублюється в кожному уроці).
 * - Назви предметів — тільки в `SUBJECTS` (ключ = скорочення з паперового розкладу).
 * - Тиждень — у `WEEK`: для кожного дня масив уроків.
 *
 * Урок буває двох видів:
 *   { n: 1, subject: 'м' }         — цілий клас разом
 *   { n: 4, variants: [...] }      — клас поділений на групи
 *
 * Якщо для якоїсь групи уроку немає — просто не додавайте для неї варіант
 * (напр. хімія в середу 8-м уроком стоїть лише у 2 групи).
 *
 * Урок «через тиждень» позначається `onlyWeek: 1 | 2` — номер тижня
 * рахується від того, у якому починається навчальний рік (див. `weekParity`).
 */

/* ── Дзвінки ─────────────────────────────────────────────────────────── */

export const LESSON_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8] as const
export type LessonNumber = (typeof LESSON_NUMBERS)[number]

/** Початок і кінець уроку у хвилинах від півночі (за київським часом). */
export type Bell = { start: number; end: number }

const at = (h: number, m: number): number => h * 60 + m

/**
 * Розклад дзвінків для 2–11 класів (з офіційного розкладу ліцею).
 * Уроки 1–6 — перша колонка, уроки 7–8 продовжуються з другої колонки.
 * Усі уроки по 40 хвилин.
 */
export const BELLS: Record<LessonNumber, Bell> = {
  1: { start: at(8, 0), end: at(8, 40) },
  2: { start: at(8, 55), end: at(9, 35) },
  3: { start: at(9, 55), end: at(10, 35) },
  4: { start: at(10, 55), end: at(11, 35) },
  5: { start: at(11, 55), end: at(12, 35) },
  6: { start: at(12, 45), end: at(13, 25) },
  7: { start: at(13, 40), end: at(14, 20) },
  8: { start: at(14, 40), end: at(15, 20) },
}

/* ── Предмети ────────────────────────────────────────────────────────── */

/** Скорочення з паперового розкладу → повна назва, яку бачить користувач. */
export const SUBJECTS = {
  м: 'Математика',
  ф: 'Фізика',
  і: 'Інформатика',
  ум: 'Українська мова',
  ул: 'Українська література',
  зл: 'Зарубіжна література',
  г: 'Географія',
  ам: 'Англійська мова',
  нм: 'Німецька мова',
  фм: 'Французька мова',
  б: 'Біологія',
  х: 'Хімія',
  фк: 'Фізична культура',
  го: 'Громадянська освіта',
  т: 'Технології',
  к: 'Країнознавство',
} as const

export type SubjectCode = keyof typeof SUBJECTS

/* ── Групи ───────────────────────────────────────────────────────────── */

/** Поділ класу навпіл — визначає, який саме предмет у вас на спареному уроці. */
export const CLASS_GROUPS = ['1', '2'] as const
export type ClassGroup = (typeof CLASS_GROUPS)[number]

/** Друга іноземна мова. */
export const LANGUAGE_GROUPS = ['de', 'fr'] as const
export type LanguageGroup = (typeof LANGUAGE_GROUPS)[number]

/** Підгрупа англійської. Предмет однаковий, змінюється лише склад групи. */
export const ENGLISH_GROUPS = ['А', 'Б', 'В'] as const
export type EnglishGroup = (typeof ENGLISH_GROUPS)[number]

/** Поділ на фізкультурі. На назву предмета не впливає. */
export const GENDER_GROUPS = ['boys', 'girls'] as const
export type GenderGroup = (typeof GENDER_GROUPS)[number]

/** Варіант уроку для конкретної групи. */
export type Variant =
  | { by: 'classGroup'; group: ClassGroup; subject: SubjectCode }
  | { by: 'language'; group: LanguageGroup; subject: SubjectCode }

/**
 * Урок, який слухає весь клас, але фізично сидить у різних кабінетах.
 * Предмет один для всіх — це лише позначка, кого з ким ділять.
 */
export type WholeClassSplit = 'english' | 'gender'

/**
 * Тиждень «чисельника» (1) чи «знаменника» (2).
 * Відлік — від тижня, у якому починається навчальний рік (1 вересня):
 * той тиждень завжди перший.
 */
export type WeekParity = 1 | 2

/** Спільні поля будь-якого уроку. */
type LessonBase = {
  n: LessonNumber
  /** Урок буває лише на тижнях цієї парності (через тиждень). */
  onlyWeek?: WeekParity
}

export type Lesson =
  | (LessonBase & { subject: SubjectCode; split?: WholeClassSplit })
  | (LessonBase & { variants: Variant[] })

export type DayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri'

export type Day = {
  id: DayId
  /** Номер дня за ISO: 1 = понеділок … 7 = неділя. */
  iso: 1 | 2 | 3 | 4 | 5
  short: string
  full: string
  lessons: Lesson[]
}

/* ── Тиждень ─────────────────────────────────────────────────────────── */

export const WEEK: Day[] = [
  {
    id: 'mon',
    iso: 1,
    short: 'Пн',
    full: 'Понеділок',
    lessons: [
      { n: 1, subject: 'м' },
      { n: 2, subject: 'м' },
      { n: 3, subject: 'і' },
      {
        n: 4,
        variants: [
          { by: 'classGroup', group: '1', subject: 'ум' },
          { by: 'classGroup', group: '2', subject: 'к' },
        ],
      },
      { n: 5, subject: 'ам', split: 'english' },
      { n: 6, subject: 'б' },
      { n: 7, subject: 'фк', split: 'gender' },
    ],
  },
  {
    id: 'tue',
    iso: 2,
    short: 'Вт',
    full: 'Вівторок',
    lessons: [
      { n: 1, subject: 'ф' },
      { n: 2, subject: 'ул' },
      {
        n: 3,
        variants: [
          { by: 'classGroup', group: '1', subject: 'ум' },
          { by: 'classGroup', group: '2', subject: 'і' },
        ],
      },
      { n: 4, subject: 'ам', split: 'english' },
      {
        n: 5,
        variants: [
          { by: 'classGroup', group: '1', subject: 'т' },
          { by: 'classGroup', group: '2', subject: 'ум' },
        ],
      },
      { n: 6, subject: 'м' },
      { n: 7, subject: 'го' },
      { n: 8, subject: 'фк', split: 'gender' },
    ],
  },
  {
    id: 'wed',
    iso: 3,
    short: 'Ср',
    full: 'Середа',
    lessons: [
      {
        n: 1,
        variants: [
          { by: 'classGroup', group: '1', subject: 'і' },
          { by: 'classGroup', group: '2', subject: 'ум' },
        ],
      },
      {
        n: 2,
        variants: [
          { by: 'classGroup', group: '1', subject: 'г' },
          { by: 'classGroup', group: '2', subject: 'і' },
        ],
      },
      {
        n: 3,
        variants: [
          { by: 'language', group: 'de', subject: 'нм' },
          { by: 'language', group: 'fr', subject: 'фм' },
        ],
      },
      { n: 4, subject: 'м' },
      { n: 5, subject: 'фк', split: 'gender' },
      { n: 6, subject: 'б' },
      {
        n: 7,
        variants: [
          { by: 'language', group: 'de', subject: 'нм' },
          { by: 'language', group: 'fr', subject: 'фм' },
        ],
      },
      // Хімія стоїть тільки у 2 групи — і лише через тиждень.
      // Тиждень, у якому починається навчальний рік, — перший, хімії в ньому немає.
      { n: 8, onlyWeek: 2, variants: [{ by: 'classGroup', group: '2', subject: 'х' }] },
    ],
  },
  {
    id: 'thu',
    iso: 4,
    short: 'Чт',
    full: 'Четвер',
    lessons: [
      { n: 1, subject: 'г' },
      { n: 2, subject: 'зл' },
      { n: 3, subject: 'ф' },
      { n: 4, subject: 'х' },
      { n: 5, subject: 'ам', split: 'english' },
      { n: 6, subject: 'ул' },
    ],
  },
  {
    id: 'fri',
    iso: 5,
    short: 'Пт',
    full: 'Пʼятниця',
    lessons: [
      { n: 1, subject: 'і' },
      { n: 2, subject: 'ам', split: 'english' },
      {
        n: 3,
        variants: [
          { by: 'language', group: 'de', subject: 'нм' },
          { by: 'language', group: 'fr', subject: 'фм' },
        ],
      },
      { n: 4, subject: 'ф' },
      { n: 5, subject: 'ам', split: 'english' },
      { n: 6, subject: 'го' },
      {
        n: 7,
        variants: [
          { by: 'classGroup', group: '1', subject: 'к' },
          { by: 'classGroup', group: '2', subject: 'т' },
        ],
      },
    ],
  },
]

export const CLASS_NAME = '10-Б'
export const SCHOOL_NAME = 'Ліцей №11 Івано-Франківської міської ради'
