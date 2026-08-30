/**
 * Перетворює «сирий» розклад класу на те, що бачить конкретний учень,
 * і рахує, що відбувається просто зараз.
 */

import type { Day, DayId, Lesson, LessonNumber, Variant, WeekParity } from '../data/schedule'
import { BELLS, ENGLISH_GROUPS, GENDER_GROUPS, SUBJECTS, WEEK } from '../data/schedule'
import type { Prefs } from './prefs'
import { CLASS_GROUP_LABEL, GENDER_LABEL, LANGUAGE_TAG } from './prefs'

/**
 * Один предмет у картці уроку.
 * `who` — чия саме це група, `room` — кабінет (якщо він є в розкладі).
 */
export type DisplayItem = { subject: string; who?: string; room?: string }

/** «каб. 12». Порожній кабінет ніяк не підписуємо. */
export function roomLabel(room: string | undefined): string | null {
  return room ? `каб. ${room}` : null
}

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

/** Який саме варіант уроку дістається цьому учневі цього тижня. */
function myVariant(lesson: VariantLesson, prefs: Prefs, week: WeekParity) {
  return lesson.variants.find((v) => {
    if (v.by === 'classGroup') return v.group === prefs.classGroup
    if (v.by === 'language') return v.group === prefs.language
    return v.group === week
  })
}

/** Підпис варіанта в повному розкладі: чия це група або котрий тиждень. */
function variantTag(variant: Variant): string {
  if (variant.by === 'classGroup') return CLASS_GROUP_LABEL[variant.group]
  if (variant.by === 'language') return LANGUAGE_TAG[variant.group]
  return `${variant.group} тиждень`
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
      const subject = SUBJECTS[lesson.subject]
      let note = weekNote
      let items: DisplayItem[] = [{ subject, room: lesson.room }]

      if (lesson.split === 'english') {
        // Предмет один для всіх підгруп, кабінети в розкладі не вказані.
        note = mode === 'my' ? `Підгрупа ${prefs.english}` : ENGLISH_SUBGROUPS_NOTE
      } else if (lesson.split === 'gender') {
        // Стать не змінює предмет — але змінює зал, тож кабінет свій у кожного.
        const rooms = lesson.roomByGender
        if (mode === 'full' && rooms) {
          items = GENDER_GROUPS.map((g) => ({
            subject,
            who: GENDER_LABEL[g],
            room: rooms[g],
          }))
        } else if (mode === 'full') {
          note = GENDER_NOTE
        } else {
          // У «моєму» розкладі про поділ мовчимо: показуємо лише свій зал.
          items = [{ subject, room: prefs.gender ? rooms?.[prefs.gender] : undefined }]
        }
      }

      out.push({ n: lesson.n, ...bell, items, note })
      continue
    }

    if (mode === 'full') {
      out.push({
        n: lesson.n,
        ...bell,
        items: lesson.variants.map((v) => ({
          subject: SUBJECTS[v.subject],
          who: variantTag(v),
          room: v.room,
        })),
        note: weekNote,
      })
      continue
    }

    const mine = myVariant(lesson, prefs, week)
    // Немає варіанта для моєї групи — значить, цього уроку в мене просто немає.
    if (!mine) continue

    out.push({
      n: lesson.n,
      ...bell,
      items: [
        {
          subject: SUBJECTS[mine.subject],
          // Мовну групу й тиждень підписувати нема потреби — це й так видно.
          who: mine.by === 'classGroup' ? CLASS_GROUP_LABEL[mine.group] : undefined,
          room: mine.room,
        },
      ],
      note: mine.by === 'week' ? `Чергується по тижнях · ${week} тиждень` : undefined,
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
      ? myVariant(lesson, prefs, week)?.subject
      : lesson.subject
    if (!subject) continue

    return `${SUBJECTS[subject]} ${lesson.n}-м уроком буває через тиждень — цього тижня немає.`
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
