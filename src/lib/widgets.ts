import type { CalendarDate } from './clock'
import { DAY_NAME, addDays, dateKey, formatTime, isoOf, weekParity } from './clock'
import { computeStatus } from './lessons'
import type { DisplayLesson } from './lessons'
import type { Prefs, Profile } from './prefs'
import { activeProfile } from './prefs'
import {
  clubsOn,
  lessonsOnly,
  profileDay,
  profileName,
  profileSub,
  withClubs,
} from './profiles'
import { specialDayOn } from '../data/special'

type Bridge = { postMessage: (value: unknown) => void }

type WidgetLesson = {
  n: number
  period: number
  start: number
  end: number
  title: string
  subtitle: string
  room: string
  time: string
  isClub: boolean
}

type WidgetStatus = {
  kind: 'empty' | 'before' | 'lesson' | 'break' | 'done'
  title: string
  subtitle: string
  minutes: number
  progress: number
}

export type WidgetDay = {
  date: string
  dayName: string
  schoolCount: number
  lessons: WidgetLesson[]
}

export type WidgetSnapshot = WidgetDay & {
  type: 'snapshot'
  version: 1
  updatedAt: string
  profileName: string
  profileSub: string
  status: WidgetStatus
  days: WidgetDay[]
}

let lastSnapshot = ''

function bridge(): Bridge | null {
  return (window.webkit?.messageHandlers?.widgets as Bridge | undefined) ?? null
}

function lessonTitle(lesson: DisplayLesson): string {
  return lesson.items.map((item) => item.subject).join(' / ')
}

function lessonSubtitle(lesson: DisplayLesson): string {
  const parts = lesson.items
    .map((item) => [item.who, item.teacher].filter(Boolean).join(' · '))
    .filter(Boolean)
  return [...new Set(parts)].join(' / ')
}

function lessonRoom(lesson: DisplayLesson): string {
  const rooms = lesson.items.map((item) => item.room).filter(Boolean)
  return [...new Set(rooms)].join(', ')
}

function widgetLesson(lesson: DisplayLesson): WidgetLesson {
  return {
    n: lesson.n,
    period: lesson.period,
    start: lesson.start,
    end: lesson.end,
    title: lessonTitle(lesson),
    subtitle: lessonSubtitle(lesson) || lesson.note || '',
    room: lessonRoom(lesson),
    time: `${formatTime(lesson.start)}–${formatTime(lesson.end)}`,
    isClub: Boolean(lesson.club),
  }
}

function statusSnapshot(lessons: DisplayLesson[], nowMin: number): WidgetStatus {
  const status = computeStatus(lessons, nowMin)

  switch (status.kind) {
    case 'empty':
      return {
        kind: 'empty',
        title: 'Уроків немає',
        subtitle: 'На сьогодні розклад порожній',
        minutes: 0,
        progress: 0,
      }
    case 'before':
      return {
        kind: 'before',
        title: `До ${status.next.club ? 'гуртка' : `${status.next.n} уроку`}`,
        subtitle: lessonTitle(status.next),
        minutes: status.inMin,
        progress: 0,
      }
    case 'lesson':
      return {
        kind: 'lesson',
        title: status.current.club ? 'Зараз гурток' : `Зараз ${status.current.n} урок`,
        subtitle: lessonTitle(status.current),
        minutes: status.leftMin,
        progress: status.progress,
      }
    case 'break':
      return {
        kind: 'break',
        title: status.free > 0 ? 'Вікно' : 'Перерва',
        subtitle: `Далі ${status.next.club ? 'гурток' : `${status.next.n} урок`}: ${lessonTitle(status.next)}`,
        minutes: status.inMin,
        progress: 0,
      }
    case 'done':
      return {
        kind: 'done',
        title: 'Уроки закінчились',
        subtitle: `Сьогодні було ${status.total}`,
        minutes: 0,
        progress: 1,
      }
  }
}

function profileLessons(profile: Profile, today: CalendarDate): DisplayLesson[] {
  const iso = isoOf(today)
  if (iso > 5 || specialDayOn(today)?.noLessons) return []

  const week = weekParity(addDays(today, 1 - iso))
  return withClubs(profileDay(profile, iso - 1, week, 'my'), clubsOn(profile, iso, week))
}

function snapshotDay(profile: Profile, date: CalendarDate): WidgetDay {
  const lessons = profileLessons(profile, date)
  return {
    date: dateKey(date),
    dayName: DAY_NAME[isoOf(date)],
    schoolCount: lessonsOnly(lessons).length,
    lessons: lessons.map(widgetLesson),
  }
}

export function buildWidgetSnapshot(
  prefs: Prefs,
  today: CalendarDate,
  nowMin: number,
): WidgetSnapshot {
  const profile = activeProfile(prefs)
  const lessons = profileLessons(profile, today)

  return {
    ...snapshotDay(profile, today),
    type: 'snapshot',
    version: 1,
    updatedAt: new Date().toISOString(),
    profileName: profileName(profile),
    profileSub: profileSub(profile),
    status: statusSnapshot(lessons, nowMin),
    days: Array.from({ length: 7 }, (_, offset) => snapshotDay(profile, addDays(today, offset))),
  }
}

export function syncWidgets(prefs: Prefs, today: CalendarDate, nowMin: number): void {
  const target = bridge()
  if (!target) return

  const snapshot = buildWidgetSnapshot(prefs, today, nowMin)
  const serialized = JSON.stringify({ ...snapshot, updatedAt: undefined, status: undefined })
  if (serialized === lastSnapshot) return

  target.postMessage(snapshot)
  lastSnapshot = serialized
}
