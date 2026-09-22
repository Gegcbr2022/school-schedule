import { specialDayOn } from '../data/special'
import type { CalendarDate } from './clock'
import {
  addDays,
  dateKey,
  formatDateUk,
  formatTime,
  isoOf,
  parseDateKey,
  weekParity,
} from './clock'
import type { DisplayLesson } from './lessons'
import { roomLabel } from './lessons'
import { allNotes, DAY_PERIOD } from './notes'
import type { Club, Prefs, Profile } from './prefs'
import { clubsOn, leaveAt, profileDay, profileName, withClubs } from './profiles'

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

let lastSync = ''

function bridge(): Bridge | null {
  return (window.webkit?.messageHandlers?.notifications as Bridge | undefined) ?? null
}

/**
 * Чи є кому доставити нагадування.
 *
 * Ставить їх операційна система телефона через місток iOS — свого способу
 * розбудити людину о 7:45 у застосунку немає. У браузері й у PWA містка
 * немає, тож і вмикати нічого: перемикач, який нічого не вмикає, гірший
 * за його відсутність.
 */
export function notificationsWork(): boolean {
  return bridge() !== null
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
  const week = weekParity(addDays(date, 1 - iso))
  const clubs = clubsOn(profile, iso, week, date)
  if (iso > 5 || specialDayOn(date)?.noLessons) return withClubs([], clubs)
  return withClubs(profileDay(profile, iso - 1, week, 'my'), clubs)
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
    const club = lesson.club ? profile.clubs.find((c) => c.id === lesson.club) : undefined
    // Урок за стінкою й музична школа через місто не можуть мати
    // однакове «за 10 хв»: у гуртка своє випередження, якщо його вказали.
    const lead = club?.lead ?? settings.lessonStartLead

    if (settings.lessonStart) {
      out.push(
        asItem(
          `start:${prefix}`,
          lead === 0 ? `${subject} починається` : `${subject} за ${lead} хв`,
          lessonBody(profile, lesson),
          date,
          lesson.start - lead,
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

/**
 * «Час виходити» — нагадування, заради якого гуртки й тримають поруч
 * із розкладом.
 *
 * Дорогу людина вказала сама (`club.travel`), і застосунок давно вміє
 * порахувати, о котрій треба вийти. Досі це число лише малювалось на
 * картці — а нагадування приходило на початок заняття, тобто тоді, коли
 * дитина вже спізнилась на всю дорогу.
 */
function addLeaveNotifications(
  out: NativeNotificationItem[],
  profile: Profile,
  date: CalendarDate,
  clubs: Club[],
  prefs: Prefs,
): void {
  if (!prefs.notifications.clubLeave) return

  for (const club of clubs) {
    if (!club.travel || club.leaveAlert === false) continue
    const where = club.place ? ` · ${club.place}` : ''
    out.push(
      asItem(
        `leave:${profile.id}:${dateKey(date)}:${club.id}`,
        `Час виходити: ${club.name}`,
        `${profileName(profile)} · початок о ${formatTime(club.start)}${where}`,
        date,
        leaveAt(club),
      ),
    )
  }
}

/**
 * Оплата гуртка: за три дні й у сам день, о дев'ятій ранку.
 *
 * Дрібниця, яку в застосунку не чекають, — і саме тому її й помічають:
 * «оплачено до 30 вересня» лежить у голові в одного з батьків і зникає
 * звідти рівно 27-го.
 */
function addPaymentNotifications(
  out: NativeNotificationItem[],
  profile: Profile,
  today: CalendarDate,
  prefs: Prefs,
): void {
  if (!prefs.notifications.clubPayment) return

  for (const club of profile.clubs) {
    if (!club.paidUntil) continue
    const due = parseDateKey(club.paidUntil)

    for (const before of [3, 0]) {
      const when = addDays(due, -before)
      if (dateKey(when) < dateKey(today)) continue
      out.push(
        asItem(
          `pay:${profile.id}:${club.paidUntil}:${club.id}:${before}`,
          before === 0 ? `Оплата: ${club.name}` : `Оплата за ${club.name} — за 3 дні`,
          `${profileName(profile)} · оплачено до ${formatDateUk(due)}`,
          when,
          9 * 60,
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
      const iso = isoOf(date)
      addLessonNotifications(out, profile, date, lessonsFor(profile, date), prefs)
      addLeaveNotifications(
        out,
        profile,
        date,
        clubsOn(profile, iso, weekParity(addDays(date, 1 - iso)), date),
        prefs,
      )
    }
    addHomeworkNotifications(out, profile, today, nowMin, prefs)
    addPaymentNotifications(out, profile, today, prefs)
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
  const serialized = JSON.stringify(message)
  if (serialized === lastSync) return

  try {
    target.postMessage(message)
    lastSync = serialized
  } catch {
    /* Сповіщення не мають ламати сам розклад. */
  }
}
