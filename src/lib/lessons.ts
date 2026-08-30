/**
 * Перетворює «сирий» розклад класу на те, що бачить конкретний учень,
 * і рахує, що відбувається просто зараз.
 */

import type { Day, DayId, Lesson, LessonNumber, WeekParity } from '../data/schedule'
import { BELLS, ENGLISH_GROUPS, SUBJECTS, WEEK } from '../data/schedule'
import type { Prefs } from './prefs'
import { CLASS_GROUP_LABEL, GENDER_LABEL, LANGUAGE_TAG } from './prefs'

/** Один предмет у картці уроку. `who` — чия саме це група. */
export type DisplayItem = { subject: string; who?: string }

export type DisplayLesson = {
  n: LessonNumber
  /** Хвилини від київської півночі. */
  start: number
  end: number
  items: DisplayItem[]
  /** Дрібний підпис під предметом: «Підгрупа Б», «Хлопці · Дівчата». */
  note?: string
}

export type ViewMode = 'my' | 'full'

const ENGLISH_SUBGROUPS_NOTE = `Підгрупи ${ENGLISH_GROUPS.join(' · ')}`
const GENDER_NOTE = `${GENDER_LABEL.boys} · ${GENDER_LABEL.girls}`

type VariantLesson = Extract<Lesson, { variants: unknown }>

function hasVariants(lesson: Lesson): lesson is VariantLesson {
  return 'variants' in lesson
}

/** Чи є цей урок у мене, з урахуванням групи. */
function myVariant(lesson: VariantLesson, prefs: Prefs) {
  return lesson.variants.find((v) =>
    v.by === 'classGroup' ? v.group === prefs.classGroup : v.group === prefs.language,
  )
}

/**
 * Розклад дня очима учня.
 *
 * `my`   — тільки його предмети; урок, якого в його групи цього тижня немає,
 *          зникає зовсім.
 * `full` — розклад класу з усіма груповими варіантами; уроки «через тиждень»
 *          лишаються видимими з підписом.
 */
export function buildDay(
  day: Day,
  prefs: Prefs,
  mode: ViewMode,
  week: WeekParity,
): DisplayLesson[] {
  const out: DisplayLesson[] = []

  for (const lesson of day.lessons) {
    const bell = BELLS[lesson.n]
    const everyOtherWeek = lesson.onlyWeek !== undefined
    const thisWeek = !everyOtherWeek || lesson.onlyWeek === week

    // У «моєму» розкладі уроку іншого тижня просто немає.
    if (mode === 'my' && !thisWeek) continue

    const weekNote = everyOtherWeek
      ? `${thisWeek ? 'Цього' : 'Наступного'} тижня · ${lesson.onlyWeek} тиждень`
      : undefined

    if (!hasVariants(lesson)) {
      let note = weekNote
      if (lesson.split === 'english') {
        note = mode === 'my' ? `Підгрупа ${prefs.english}` : ENGLISH_SUBGROUPS_NOTE
      } else if (lesson.split === 'gender') {
        // Стать не змінює предмет — у «моєму» розкладі про поділ мовчимо.
        note = mode === 'full' ? GENDER_NOTE : undefined
      }

      out.push({ n: lesson.n, ...bell, items: [{ subject: SUBJECTS[lesson.subject] }], note })
      continue
    }

    if (mode === 'full') {
      out.push({
        n: lesson.n,
        ...bell,
        items: lesson.variants.map((v) => ({
          subject: SUBJECTS[v.subject],
          who: v.by === 'classGroup' ? CLASS_GROUP_LABEL[v.group] : LANGUAGE_TAG[v.group],
        })),
        note: weekNote,
      })
      continue
    }

    const mine = myVariant(lesson, prefs)
    // Немає варіанта для моєї групи — значить, цього уроку в мене просто немає.
    if (!mine) continue

    out.push({
      n: lesson.n,
      ...bell,
      items: [
        {
          subject: SUBJECTS[mine.subject],
          who: mine.by === 'classGroup' ? CLASS_GROUP_LABEL[mine.group] : undefined,
        },
      ],
    })
  }

  return out
}

/**
 * Пояснення, чому урок «через тиждень» зник із мого розкладу.
 * Повертає `null`, якщо пояснювати нічого.
 */
export function offWeekNote(day: Day, prefs: Prefs, week: WeekParity): string | null {
  for (const lesson of day.lessons) {
    if (lesson.onlyWeek === undefined || lesson.onlyWeek === week) continue

    const subject = hasVariants(lesson)
      ? myVariant(lesson, prefs)?.subject
      : lesson.subject
    if (!subject) continue

    return `${SUBJECTS[subject]} ${lesson.n}-м уроком буває через тиждень — цього тижня її немає.`
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
  | { kind: 'break'; next: DisplayLesson; inMin: number }
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
    return { kind: 'break', next: lesson, inMin: Math.ceil(lesson.start - nowMin) }
  }

  // Недосяжно: випадок «після останнього уроку» вже оброблено вище.
  return { kind: 'done', total: lessons.length }
}

/** Скільки уроків уже позаду. */
export function finishedCount(lessons: DisplayLesson[], nowMin: number): number {
  return lessons.filter((l) => nowMin >= l.end).length
}

/* ── Дні ─────────────────────────────────────────────────────────────── */

export function dayByIso(iso: number): Day | undefined {
  return WEEK.find((d) => d.iso === iso)
}

export function dayById(id: DayId): Day {
  const found = WEEK.find((d) => d.id === id)
  if (!found) throw new Error(`Невідомий день: ${id}`)
  return found
}

/** Найближчий навчальний день після `iso` (з переходом на наступний тиждень). */
export function nextSchoolDay(iso: number): Day {
  return WEEK.find((d) => d.iso > iso) ?? WEEK[0]
}

/** Скільки діб від `fromIso` до найближчого `toIso`, з переходом через тиждень. */
export function daysUntil(fromIso: number, toIso: number): number {
  return (toIso - fromIso + 7) % 7
}
