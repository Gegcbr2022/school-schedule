/**
 * Розклад очима вчителя: усі його уроки по всіх класах, з «вікнами» —
 * порожніми уроками між першим і останнім.
 *
 * Дані ті самі, що й у класів (`TIMETABLE`), просто дивимось на них
 * з іншого боку: не «що в цього класу», а «де цей учитель».
 *
 * Саме вчитель, а не код: під одним кодом у розкладі інколи ходять
 * двоє тезок, і уроки історика не мають потрапити до музиканта.
 */

import type { Period, WeekParity } from '../data/schedule'
import { BELLS, GROUP_DIM, GROUP_LABEL, subjectName } from '../data/schedule'
import { TIMETABLE } from '../data/timetable'
import type { DisplayLesson } from './lessons'
import type { Teacher } from './teachers'
import { teaches } from './teachers'

/** Один предмет у клітинці вчительського розкладу. */
export type TeacherEntry = {
  /** Як показуємо клас: «10-Б». */
  className: string
  subject: string
  room?: string
  /** Підгрупа чи чергування, якщо урок не на весь клас. */
  who?: string
}

export type TeacherRow =
  | { kind: 'lesson'; period: Period; start: number; end: number; entries: TeacherEntry[] }
  | { kind: 'window'; period: Period; start: number; end: number }

export type TeacherDay = {
  /** ISO-номер дня, 1 (Пн) … 5 (Пт). */
  iso: number
  rows: TeacherRow[]
  /** Скільки вікон цього дня. */
  windows: number
  /** Скільки уроків цього дня. */
  count: number
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
): Map<Period, TeacherEntry[]> {
  const byPeriod = new Map<Period, TeacherEntry[]>()

  for (const cls of TIMETABLE) {
    for (const lesson of cls.days[dayIndex] ?? []) {
      for (const cell of lesson.c) {
        if (!cell.t || !teaches(teacher, cell.t, cell.s, cls.id)) continue
        if (!onWeek(cell.w, cell.g, week)) continue

        const entry: TeacherEntry = {
          className: cls.name,
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
function periodsOf(byPeriod: Map<Period, TeacherEntry[]>): Period[] {
  return [...byPeriod.keys()].sort((a, b) => a - b)
}

/**
 * Тиждень учителя: п'ять днів. У кожному — уроки за номерами періодів,
 * а між першим і останнім уроком вставлені вікна.
 */
export function buildTeacherWeek(teacher: Teacher, week: WeekParity): TeacherDay[] {
  const days: TeacherDay[] = []

  for (let d = 0; d < 5; d += 1) {
    const byPeriod = lessonsOf(teacher, d, week)
    const periods = periodsOf(byPeriod)
    const rows: TeacherRow[] = []
    let windows = 0

    // Вікна рахуємо лише між першим і останнім уроком: до першого й після
    // останнього вчитель у школі бути не зобов'язаний.
    for (let p = periods[0] ?? 1; periods.length > 0 && p <= periods[periods.length - 1]; p += 1) {
      const period = p as Period
      const bell = BELLS[period]
      if (!bell) continue
      const entries = byPeriod.get(period)
      if (entries) {
        rows.push({ kind: 'lesson', period, ...bell, entries })
      } else {
        rows.push({ kind: 'window', period, ...bell })
        windows += 1
      }
    }

    days.push({ iso: d + 1, rows, windows, count: periods.length })
  }

  return days
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
    items: (byPeriod.get(period) ?? []).map((entry) => ({
      subject: entry.subject,
      cls: entry.className,
      room: entry.room,
      who: entry.who,
    })),
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
