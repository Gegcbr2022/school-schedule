/**
 * Тиждень одним екраном — з «вікнами», тобто порожніми уроками між
 * першим і останнім.
 *
 * Тут два різні погляди на ті самі дані (`TIMETABLE`):
 *   · учнівський день збирає `lessons.ts` — «що в цього класу»;
 *   · вчительський збираємо тут — «де цей учитель», по всіх класах.
 *
 * Саме вчитель, а не код: під одним кодом у розкладі інколи ходять
 * двоє тезок, і уроки історика не мають потрапити до музиканта.
 *
 * Складання тижня з п'яти днів спільне для обох — `weekFrom`.
 */

import type { Period, WeekParity } from '../data/schedule'
import { BELLS, GROUP_DIM, GROUP_LABEL, subjectName } from '../data/schedule'
import { TIMETABLE } from '../data/timetable'
import type { DisplayItem, DisplayLesson } from './lessons'
import type { Teacher } from './teachers'
import { teaches } from './teachers'

export type WeekRow =
  | { kind: 'lesson'; period: Period; start: number; end: number; items: DisplayItem[] }
  | { kind: 'window'; period: Period; start: number; end: number }

export type WeekDay = {
  /** ISO-номер дня, 1 (Пн) … 5 (Пт). */
  iso: number
  rows: WeekRow[]
  /** Скільки вікон цього дня. */
  windows: number
  /** Скільки уроків цього дня. */
  count: number
}

/**
 * П'ять зібраних днів → тиждень, у якому між першим і останнім уроком
 * кожного дня стоять вікна. До першого й після останнього їх немає:
 * у цей час у школі бути не обов'язково.
 */
export function weekFrom(days: DisplayLesson[][]): WeekDay[] {
  return days.map((lessons, index) => {
    const byPeriod = new Map<number, DisplayLesson>()
    for (const lesson of lessons) byPeriod.set(lesson.period, lesson)

    const rows: WeekRow[] = []
    let windows = 0
    const first = lessons[0]?.period
    const last = lessons[lessons.length - 1]?.period

    if (first !== undefined && last !== undefined) {
      for (let p = first; p <= last; p += 1) {
        const bell = BELLS[p as Period]
        if (!bell) continue
        const lesson = byPeriod.get(p)
        if (lesson) {
          rows.push({ kind: 'lesson', period: p as Period, ...bell, items: lesson.items })
        } else {
          rows.push({ kind: 'window', period: p as Period, ...bell })
          windows += 1
        }
      }
    }

    return { iso: index + 1, rows, windows, count: lessons.length }
  })
}

/** Урок цієї клітинки буває на цьому тижні? */
function onWeek(
  cellWeek: WeekParity | undefined,
  group: string | undefined,
  week: WeekParity,
): boolean {
  if (cellWeek && cellWeek !== week) return false
  if (group && GROUP_DIM[group] === 'week' && group !== `т${week}`) return false
  return true
}

/**
 * Уроки вчителя за один день: період → що саме він у цей період веде.
 * По всіх класах одразу, тому в одному періоді буває кілька записів
 * (наприклад, дві групи одного класу).
 */
function lessonsOf(
  teacher: Teacher,
  dayIndex: number,
  week: WeekParity,
): Map<Period, DisplayItem[]> {
  const byPeriod = new Map<Period, DisplayItem[]>()

  for (const cls of TIMETABLE) {
    for (const lesson of cls.days[dayIndex] ?? []) {
      for (const cell of lesson.c) {
        if (!cell.t || !teaches(teacher, cell.t, cell.s, cls.id)) continue
        if (!onWeek(cell.w, cell.g, week)) continue

        const entry: DisplayItem = {
          cls: cls.name,
          subject: subjectName(cell.s),
          room: cell.r,
          who: cell.g ? GROUP_LABEL[cell.g] : undefined,
        }
        const list = byPeriod.get(lesson.p)
        if (list) list.push(entry)
        else byPeriod.set(lesson.p, [entry])
      }
    }
  }

  return byPeriod
}

/** Періоди дня за зростанням. */
function periodsOf(byPeriod: Map<Period, DisplayItem[]>): Period[] {
  return [...byPeriod.keys()].sort((a, b) => a - b)
}

/** Тиждень учителя: п'ять днів із вікнами між уроками. */
export function buildTeacherWeek(teacher: Teacher, week: WeekParity): WeekDay[] {
  return weekFrom([0, 1, 2, 3, 4].map((day) => buildTeacherDay(teacher, day, week)))
}

/**
 * Один день учителя у тому ж вигляді, що й день учня, — щоб головний
 * екран (що зараз, скільки до дзвінка, нотатки) працював без змін.
 * Вікна тут не окремі рядки: їх видно з розривів у номерах періодів.
 */
export function buildTeacherDay(
  teacher: Teacher,
  dayIndex: number,
  week: WeekParity,
): DisplayLesson[] {
  const byPeriod = lessonsOf(teacher, dayIndex, week)

  return periodsOf(byPeriod).map((period, index) => ({
    n: index + 1,
    period,
    ...BELLS[period],
    items: byPeriod.get(period) ?? [],
  }))
}

/* ── Що і де веде вчитель ────────────────────────────────────────────── */

export type TeacherFacts = {
  subjects: string[]
  classes: string[]
  /** Класи, де він класний керівник. */
  homerooms: string[]
  /** Скільки уроків на тиждень; уроки «через тиждень» рахуються один раз. */
  perWeek: number
}

/**
 * Класний керівник підписаний у розкладі вільним текстом — де «Христина
 * Братина», а де «Теремко Марія» чи «Світлана В. Савчук». Тому шукаємо
 * прізвище й ім'я в рядку, а не звіряємо його цілком.
 */
function isHomeroom(homeroom: string | undefined, teacher: Teacher): boolean {
  return Boolean(homeroom?.includes(teacher.last) && homeroom.includes(teacher.first))
}

export function teacherFacts(teacher: Teacher): TeacherFacts {
  const subjects = new Set<string>()
  const classes = new Set<string>()
  let lessons = 0

  for (const cls of TIMETABLE) {
    for (const day of cls.days) {
      for (const lesson of day) {
        for (const cell of lesson.c) {
          if (!cell.t || !teaches(teacher, cell.t, cell.s, cls.id)) continue
          subjects.add(subjectName(cell.s))
          classes.add(cls.name)
          // Урок «через тиждень» стоїть у розкладі раз, але буває раз на два.
          lessons += cell.w ? 0.5 : 1
        }
      }
    }
  }

  return {
    subjects: [...subjects],
    classes: [...classes],
    homerooms: TIMETABLE.filter((c) => isHomeroom(c.homeroom, teacher)).map((c) => c.name),
    perWeek: Math.round(lessons),
  }
}

/** Скільки вікон у вчителя за тиждень — щоб підписати картку в довіднику. */
export function windowsPerWeek(teacher: Teacher, week: WeekParity): number {
  return buildTeacherWeek(teacher, week).reduce((n, day) => n + day.windows, 0)
}

/** Що вчитель веде в одній паралелі. */
export type GradeSubjects = {
  /** Паралель: «7». */
  grade: string
  /** Коди предметів (ключі `SUBJECTS`), за абеткою. */
  subjects: string[]
}

/**
 * Предмети вчителя, розкладені по паралелях: «7» → [«М»], «9» → [«ум», «ул»].
 *
 * Саме коди, а не назви: за ними підбираються підручники — вони
 * ключуються паралеллю, а не класом (9-А, 9-Б і 9-В читають одне й те саме).
 */
export function teacherGrades(teacher: Teacher): GradeSubjects[] {
  const byGrade = new Map<string, Set<string>>()

  for (const cls of TIMETABLE) {
    const grade = String(parseInt(cls.id, 10))
    for (const day of cls.days) {
      for (const lesson of day) {
        for (const cell of lesson.c) {
          if (!cell.t || !teaches(teacher, cell.t, cell.s, cls.id)) continue
          const subjects = byGrade.get(grade)
          if (subjects) subjects.add(cell.s)
          else byGrade.set(grade, new Set([cell.s]))
        }
      }
    }
  }

  return [...byGrade.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([grade, subjects]) => ({ grade, subjects: [...subjects].sort() }))
}
