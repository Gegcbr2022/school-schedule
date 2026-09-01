/**
 * Перетворює «сирий» розклад класу на те, що бачить конкретний учень,
 * і рахує, що відбувається просто зараз.
 */

import type {
  Cell,
  ClassTimetable,
  Dim,
  Lesson,
  WeekParity,
} from '../data/schedule'
import {
  BELLS,
  GROUP_DIM,
  GROUP_LABEL,
  subjectName,
} from '../data/schedule'
import { TIMETABLE } from '../data/timetable'
import { teacherLabel } from './teachers'
import type { Prefs } from './prefs'

/**
 * Один предмет у картці уроку.
 * `who` — чия саме це група, `room` — кабінет, `teacher` — вчитель
 * (усе це є лише там, де воно є в розкладі).
 */
export type DisplayItem = {
  subject: string
  who?: string
  room?: string
  teacher?: string
  /** Клас — лише у вчительському розкладі, де уроки з різних класів. */
  cls?: string
}

export type DisplayLesson = {
  /** Порядковий номер уроку в цьому дні — саме так їх рахують учні. */
  n: number
  /** Номер періоду за загальношкільним розкладом дзвінків. */
  period: number
  /** Хвилини від київської півночі. */
  start: number
  end: number
  items: DisplayItem[]
  /** Дрібний підпис під предметом. */
  note?: string
}

export type ViewMode = 'my' | 'full'

/** «каб. 12» для номерів і просто «сз» для залів, позначених літерами. */
export function roomLabel(room: string | undefined): string | null {
  if (!room) return null
  return /^\d+$/.test(room) ? `каб. ${room}` : room
}

/* ── Класи ───────────────────────────────────────────────────────────── */

export function classById(id: string): ClassTimetable | undefined {
  return TIMETABLE.find((c) => c.id === id)
}

/** За якими ознаками ділиться саме цей клас — щоб не питати зайвого. */
export function dimensionsOf(cls: ClassTimetable): Set<Dim> {
  const dims = new Set<Dim>()
  for (const day of cls.days) {
    for (const lesson of day) {
      for (const cell of lesson.c) {
        const dim = cell.g ? GROUP_DIM[cell.g] : undefined
        if (dim) dims.add(dim)
      }
    }
  }
  return dims
}

/** Класи, згруповані за паралеллю: 4 → [4-А, 4-Б, 4-В]. */
export function classesByGrade(): { grade: number; classes: ClassTimetable[] }[] {
  const grades = new Map<number, ClassTimetable[]>()
  for (const cls of TIMETABLE) {
    const grade = parseInt(cls.id, 10)
    const list = grades.get(grade)
    if (list) list.push(cls)
    else grades.set(grade, [cls])
  }
  return [...grades.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([grade, classes]) => ({ grade, classes }))
}

/* ── Розклад дня ─────────────────────────────────────────────────────── */

/** Чи належить ця комірка саме мені. */
function isMine(cell: Cell, prefs: Prefs, week: WeekParity): boolean {
  if (!cell.g) return true
  switch (GROUP_DIM[cell.g]) {
    case 'classGroup':
      return cell.g === prefs.classGroup
    case 'english':
      return cell.g === prefs.english
    case 'language':
      return cell.g === prefs.language
    case 'week':
      return cell.g === `т${week}`
    case 'gender':
      // Поділ не вказаний — беремо перший варіант, але без кабінету:
      // предмет однаковий, а зал вгадувати не можна.
      return prefs.gender ? cell.g === prefs.gender : cell.g === 'х'
    default:
      return true
  }
}

function itemOf(cell: Cell, prefs: Prefs, mode: ViewMode, classId: string): DisplayItem {
  const dim = cell.g ? GROUP_DIM[cell.g] : undefined
  const unknownGender = dim === 'gender' && !prefs.gender

  return {
    subject: subjectName(cell.s),
    // У «моєму» розкладі підписуємо лише навчальну групу — решта очевидна.
    who:
      mode === 'full'
        ? cell.g && GROUP_LABEL[cell.g]
        : dim === 'classGroup' && cell.g
          ? GROUP_LABEL[cell.g]
          : undefined,
    room: unknownGender && mode === 'my' ? undefined : cell.r,
    // Предмет+клас розводять тезок під спільним кодом (напр. ГП, СМ, НГ).
    teacher: teacherLabel(cell.t, cell.s, classId),
  }
}

/** Підпис під уроком: чому він такий, а не інший. */
function noteOf(cells: Cell[], prefs: Prefs, mode: ViewMode, week: WeekParity): string | undefined {
  const first = cells[0]
  if (!first) return undefined
  const dim = first.g ? GROUP_DIM[first.g] : undefined

  if (dim === 'english') {
    return mode === 'my' ? `Підгрупа ${prefs.english}` : undefined
  }
  if (dim === 'week' && mode === 'my') {
    return `Чергується по тижнях · ${week} тиждень`
  }
  // Урок «через тиждень» — підписуємо завжди, навіть коли він на весь клас
  // без жодного поділу: інакше в повному розкладі хімія 2-го тижня мовчки
  // стоїть у першому.
  if (first.w) {
    return `${first.w === week ? 'Цього' : 'Наступного'} тижня · ${first.w} тиждень`
  }
  return undefined
}

/**
 * Розклад дня очима учня.
 *
 * `my`   — тільки його предмети; уроку, якого в його групи цього тижня немає,
 *          не видно зовсім.
 * `full` — розклад класу з усіма варіантами.
 */
export function buildDay(
  cls: ClassTimetable,
  dayIndex: number,
  prefs: Prefs,
  mode: ViewMode,
  week: WeekParity,
): DisplayLesson[] {
  const day: Lesson[] = cls.days[dayIndex] ?? []
  const out: DisplayLesson[] = []

  for (const lesson of day) {
    const bell = BELLS[lesson.p]
    if (!bell) continue

    const cells =
      mode === 'full'
        ? lesson.c
        : lesson.c.filter((c) => (!c.w || c.w === week) && isMine(c, prefs, week))

    if (cells.length === 0) continue

    out.push({
      n: out.length + 1,
      period: lesson.p,
      ...bell,
      items: cells.map((c) => itemOf(c, prefs, mode, cls.id)),
      note: noteOf(cells, prefs, mode, week),
    })
  }

  return out
}

/**
 * Пояснення, чому урок «через тиждень» зник із мого розкладу.
 * Повертає `null`, якщо пояснювати нічого.
 */
export function offWeekNote(
  cls: ClassTimetable,
  dayIndex: number,
  prefs: Prefs,
  week: WeekParity,
): string | null {
  for (const lesson of cls.days[dayIndex] ?? []) {
    for (const cell of lesson.c) {
      if (!cell.w || cell.w === week) continue
      if (!isMine(cell, prefs, week)) continue
      return `${subjectName(cell.s)} буває через тиждень — цього тижня немає.`
    }
  }
  return null
}

/* ── Що зараз ────────────────────────────────────────────────────────── */

export type DayStatus =
  /** Навчальний день, але в цього учня сьогодні уроків немає. */
  | { kind: 'empty' }
  /** Ще до першого дзвінка. */
  | { kind: 'before'; next: DisplayLesson; inMin: number }
  | {
      kind: 'lesson'
      current: DisplayLesson
      next: DisplayLesson | null
      leftMin: number
      /** 0…1 — скільки уроку вже минуло. */
      progress: number
    }
  | {
      kind: 'break'
      next: DisplayLesson
      inMin: number
      /**
       * Скільки цілих уроків пропущено. Більше нуля — це вікно, а не
       * перерва: у вчителя таке буває на пів дня, і називати це перервою
       * не можна.
       */
      free: number
    }
  | { kind: 'done'; total: number }

export function computeStatus(lessons: DisplayLesson[], nowMin: number): DayStatus {
  if (lessons.length === 0) return { kind: 'empty' }

  const first = lessons[0]
  const last = lessons[lessons.length - 1]

  if (nowMin < first.start) {
    return { kind: 'before', next: first, inMin: Math.ceil(first.start - nowMin) }
  }
  if (nowMin >= last.end) {
    return { kind: 'done', total: lessons.length }
  }

  for (let i = 0; i < lessons.length; i += 1) {
    const lesson = lessons[i]
    if (nowMin >= lesson.end) continue

    // Урок триває, поки start <= now < end. Рівно на дзвінку вже перерва.
    if (nowMin >= lesson.start) {
      return {
        kind: 'lesson',
        current: lesson,
        next: lessons[i + 1] ?? null,
        leftMin: Math.ceil(lesson.end - nowMin),
        progress: (nowMin - lesson.start) / (lesson.end - lesson.start),
      }
    }
    return {
      kind: 'break',
      next: lesson,
      inMin: Math.ceil(lesson.start - nowMin),
      free: lesson.period - lessons[i - 1].period - 1,
    }
  }

  // Недосяжно: випадок «після останнього уроку» вже оброблено вище.
  return { kind: 'done', total: lessons.length }
}

/** Скільки уроків уже позаду. */
export function finishedCount(lessons: DisplayLesson[], nowMin: number): number {
  return lessons.filter((l) => nowMin >= l.end).length
}

/* ── Дні ─────────────────────────────────────────────────────────────── */

export const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт']

/** Індекс дня (0–4) за ISO-номером, або `null` для вихідних. */
export function dayIndexOf(iso: number): number | null {
  return iso >= 1 && iso <= 5 ? iso - 1 : null
}

/** Найближчий навчальний день після `iso`: повертає ISO-номер. */
export function nextSchoolIso(iso: number): number {
  return iso >= 5 ? 1 : iso + 1
}

/** Скільки діб від `fromIso` до найближчого `toIso`, з переходом через тиждень. */
export function daysUntil(fromIso: number, toIso: number): number {
  return (toIso - fromIso + 7) % 7
}
