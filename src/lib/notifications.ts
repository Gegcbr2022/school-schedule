import { specialDayOn } from '../data/special'
import type { CalendarDate } from './clock'
import { addDays, dateKey, formatTime, isoOf, weekParity } from './clock'
import type { DisplayLesson } from './lessons'
import { roomLabel } from './lessons'
import { allNotes, DAY_PERIOD } from './notes'
import type { Prefs, Profile } from './prefs'
import { clubsOn, profileDay, profileName, withClubs } from './profiles'

type Bridge = { postMessage: (value: unknown) => void }

export type NativeNotificationItem = {
  id: string
  title: string
  body: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

type SyncMessage = {
  type: 'sync'
  items: NativeNotificationItem[]
}

function bridge(): Bridge | null {
  return (window.webkit?.messageHandlers?.notifications as Bridge | undefined) ?? null
}

function lessonName(lesson: DisplayLesson): string {
  return lesson.items.map((item) => item.subject).join(' / ')
}

function lessonPlace(lesson: DisplayLesson): string | null {
  const rooms = lesson.items.map((item) => roomLabel(item.room)).filter((room): room is string => !!room)
  return rooms.length > 0 ? rooms.join(', ') : null
}

function dayAt(date: CalendarDate, minutes: number): { date: CalendarDate; minutes: number } {
  const offset = Math.floor(minutes / (24 * 60))
  const time = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60)
  return { date: addDays(date, offset), minutes: time }
}

function asItem(
  id: string,
  title: string,
  body: string,
  date: CalendarDate,
  minutes: number,
): NativeNotificationItem {
  const trigger = dayAt(date, minutes)
  return {
    id,
    title,
    body,
    year: trigger.date.year,
    month: trigger.date.month,
    day: trigger.date.day,
    hour: Math.floor(trigger.minutes / 60),
    minute: trigger.minutes % 60,
  }
}

function isFuture(item: NativeNotificationItem, today: CalendarDate, nowMin: number): boolean {
  const key = dateKey(item)
  const todayKey = dateKey(today)
  if (key !== todayKey) return key > todayKey
  return item.hour * 60 + item.minute > nowMin
}

function lessonBody(profile: Profile, lesson: DisplayLesson): string {
  const place = lessonPlace(lesson)
  const who = profileName(profile)
  return place ? `${who} · ${lessonName(lesson)} · ${place}` : `${who} · ${lessonName(lesson)}`
}

function lessonsFor(profile: Profile, date: CalendarDate): DisplayLesson[] {
  const iso = isoOf(date)
  if (iso > 5 || specialDayOn(date)?.noLessons) {
    return withClubs([], clubsOn(profile, iso, weekParity(addDays(date, 1 - iso))))
  }
  const week = weekParity(addDays(date, 1 - iso))
  return withClubs(profileDay(profile, iso - 1, week, 'my'), clubsOn(profile, iso, week))
}

function addLessonNotifications(
  out: NativeNotificationItem[],
  profile: Profile,
  date: CalendarDate,
  lessons: DisplayLesson[],
  prefs: Prefs,
): void {
  const settings = prefs.notifications

  for (const lesson of lessons) {
    const subject = lessonName(lesson)
    const prefix = `${profile.id}:${dateKey(date)}:${lesson.club ? `club:${lesson.club}` : lesson.period}`

    if (settings.lessonStart) {
      out.push(
        asItem(
          `start:${prefix}`,
          settings.lessonStartLead === 0 ? `${subject} починається` : `${subject} за ${settings.lessonStartLead} хв`,
          lessonBody(profile, lesson),
          date,
          lesson.start - settings.lessonStartLead,
        ),
      )
    }

    if (settings.lessonEnd && !lesson.club) {
      out.push(
        asItem(
          `end:${prefix}`,
          settings.lessonEndLead === 0
            ? `${subject} закінчується`
            : `${subject} закінчиться за ${settings.lessonEndLead} хв`,
          lessonBody(profile, lesson),
          date,
          lesson.end - settings.lessonEndLead,
        ),
      )
    }
  }
}

function addHomeworkNotifications(
  out: NativeNotificationItem[],
  profile: Profile,
  today: CalendarDate,
  nowMin: number,
  prefs: Prefs,
): void {
  if (!prefs.notifications.homework) return

  for (const note of allNotes(profile.id)) {
    if (note.date < dateKey(today)) continue
    const date = {
      year: Number(note.date.slice(0, 4)),
      month: Number(note.date.slice(5, 7)),
      day: Number(note.date.slice(8, 10)),
    }

    if (note.period === DAY_PERIOD) {
      out.push(
        asItem(
          `homework:${profile.id}:${note.date}:day`,
          `Нагадування на ${formatTime(7 * 60 + 30)}`,
          `${profileName(profile)} · ${note.text}`,
          date,
          7 * 60 + 30,
        ),
      )
      continue
    }

    const lesson = lessonsFor(profile, date).find((row) => row.period === note.period)
    if (!lesson) continue

    out.push(
      asItem(
        `homework:${profile.id}:${note.date}:${note.period}`,
        `${lessonName(lesson)}: ДЗ`,
        note.text,
        date,
        lesson.start - prefs.notifications.homeworkLead,
      ),
    )
  }

  for (let i = out.length - 1; i >= 0; i -= 1) {
    if (out[i].id.startsWith(`homework:${profile.id}:`) && !isFuture(out[i], today, nowMin)) {
      out.splice(i, 1)
    }
  }
}

export function buildNotifications(
  prefs: Prefs,
  today: CalendarDate,
  nowMin: number,
  horizonDays = 28,
): NativeNotificationItem[] {
  if (!prefs.notifications.enabled) return []

  const out: NativeNotificationItem[] = []

  for (const profile of prefs.profiles) {
    for (let offset = 0; offset < horizonDays; offset += 1) {
      const date = addDays(today, offset)
      addLessonNotifications(out, profile, date, lessonsFor(profile, date), prefs)
    }
    addHomeworkNotifications(out, profile, today, nowMin, prefs)
  }

  return out
    .filter((item) => isFuture(item, today, nowMin))
    .sort(
      (a, b) =>
        dateKey(a).localeCompare(dateKey(b)) ||
        a.hour - b.hour ||
        a.minute - b.minute ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 64)
}

export function syncNotifications(
  prefs: Prefs,
  today: CalendarDate,
  nowMin: number,
): void {
  const target = bridge()
  if (!target) return

  const message: SyncMessage = {
    type: 'sync',
    items: buildNotifications(prefs, today, nowMin),
  }

  try {
    target.postMessage(message)
  } catch {
    /* Сповіщення не мають ламати сам розклад. */
  }
}
