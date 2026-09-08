/**
 * Профілі: як їх підписати, як зібрати їхній день і як у той самий день
 * стають гуртки.
 *
 * Профіль — це «чий розклад». В учня й учителя він один, у батьків їх
 * стільки, скільки дітей, у завуча — скільки вчителів і класів під оком.
 * Усе, що вміє розрізняти клас і вчителя, зібрано тут, щоб решта коду
 * питала просто «день цього профілю».
 */

import type { ClassTimetable, WeekParity } from '../data/schedule'
import { TIMETABLE } from '../data/timetable'
import { formatTime } from './clock'
import type { DisplayLesson, ViewMode } from './lessons'
import { CLUB_PERIOD, buildDay, classById } from './lessons'
import type { Club, Profile, Role } from './prefs'
import { DEFAULT_CLASS_ID } from './prefs'
import { buildTeacherDay } from './teacherSchedule'
import type { Teacher } from './teachers'
import { politeName, teacherById } from './teachers'

/* ── Хто це ──────────────────────────────────────────────────────────── */

/** Учитель цього профілю — або `undefined`, якщо профіль про клас. */
export function profileTeacher(profile: Profile): Teacher | undefined {
  return profile.teacherId === null ? undefined : teacherById(profile.teacherId)
}

/** Клас цього профілю. Клас міг зникнути з даних — тоді беремо будь-який. */
export function profileClass(profile: Profile): ClassTimetable {
  return classById(profile.classId) ?? classById(DEFAULT_CLASS_ID) ?? TIMETABLE[0]
}

/** Як профіль підписаний скрізь: у шапці, у перемикачі, у списку. */
export function profileName(profile: Profile): string {
  if (profile.name) return profile.name
  return profileTeacher(profile)?.last ?? profileClass(profile).name
}

/**
 * Дрібний другий рядок під назвою. У дитини з іменем це її клас, у
 * вчителя — ім'я та по батькові, а в самого учня — просто що це розклад.
 */
export function profileSub(profile: Profile): string {
  const teacher = profileTeacher(profile)
  if (teacher) return profile.name ? teacher.last : politeName(teacher)
  return profile.name ? profileClass(profile).name : 'Розклад уроків'
}

/**
 * Другий рядок у списках. Порожній там, де він лише повторив би назву:
 * профіль без імені й так підписаний класом, і дописувати під ним
 * «Розклад уроків» ні до чого.
 */
export function profileTag(profile: Profile): string {
  return profile.name || profile.teacherId !== null ? profileSub(profile) : ''
}

/**
 * Колір профілю. Не питаємо його при створенні — одне поле у формі це
 * вже одне поле, яке не хочеться заповнювати, — а рахуємо з ключа: тоді
 * колір не перескакує, коли з середини списку прибрали сусіда.
 *
 * Кольором нічого не тримається: поруч завжди стоїть ім'я.
 */
export const PROFILE_TONES = 6

export function profileTone(profile: Profile): number {
  let sum = 0
  for (let i = 0; i < profile.id.length; i += 1) sum += profile.id.charCodeAt(i) * (i + 1)
  return sum % PROFILE_TONES
}

/* ── Підписи ролі ────────────────────────────────────────────────────── */

/** Як називається набір профілів у цій ролі. */
export const ROLE_LIST_TITLE: Record<Role, string> = {
  student: 'Профіль',
  teacher: 'Профіль',
  parent: 'Діти',
  head: 'Під оком',
}

/** Кнопка «додати» в цій ролі. */
export const ROLE_ADD_LABEL: Record<Role, string> = {
  student: 'Додати профіль',
  teacher: 'Додати профіль',
  parent: 'Додати дитину',
  head: 'Додати вчителя або клас',
}

/** Як підписати вигляд «усі одразу». */
export const ROLE_ALL_LABEL: Record<Role, string> = {
  student: 'Усі',
  teacher: 'Усі',
  parent: 'Усі',
  head: 'Усі',
}

/** Заголовок цього вигляду. */
export const ROLE_ALL_TITLE: Record<Role, string> = {
  student: 'Усі профілі',
  teacher: 'Усі профілі',
  parent: 'День родини',
  head: 'Огляд дня',
}

/* ── День профілю ────────────────────────────────────────────────────── */

/**
 * День профілю в тому самому вигляді, що й день учня: учителю збираємо
 * уроки по всіх класах, класу — його власні за вибраними групами.
 */
export function profileDay(
  profile: Profile,
  dayIndex: number,
  week: WeekParity,
  mode: ViewMode,
): DisplayLesson[] {
  const teacher = profileTeacher(profile)
  return teacher
    ? buildTeacherDay(teacher, dayIndex, week)
    : buildDay(profileClass(profile), dayIndex, profile, mode, week)
}

/* ── Гуртки ──────────────────────────────────────────────────────────── */

/** О котрій треба виходити з дому чи зі школи: з дорогою, якщо її вказали. */
export function leaveAt(club: Club): number {
  return club.start - (club.travel ?? 0)
}

/** Гуртки цього профілю в такий день тижня (ISO 1…7), за часом. */
export function clubsOn(profile: Profile, iso: number, week: WeekParity): Club[] {
  return profile.clubs
    .filter((club) => club.days.includes(iso) && (!club.week || club.week === week))
    .sort((a, b) => a.start - b.start || a.name.localeCompare(b.name, 'uk'))
}

/**
 * Уроки й гуртки одним списком за часом.
 *
 * Гурток стає таким самим рядком стрічки, як урок, — тільки з `club`.
 * Завдяки цьому «що зараз», зворотний відлік і стрічка дня працюють із
 * ним без жодної окремої гілки: футбол о 17:00 — це просто наступне,
 * що сьогодні буде.
 *
 * Тут же й перевірка, заради якої гуртки взагалі варто тримати поруч із
 * розкладом: якщо виходити треба раніше, ніж закінчиться урок, про це
 * має бути видно ще звечора, а не тоді, коли по дитину вже їдуть.
 */
export function withClubs(lessons: DisplayLesson[], clubs: Club[]): DisplayLesson[] {
  if (clubs.length === 0) return lessons

  const rows = clubs.map((club) => {
    const leave = leaveAt(club)
    // Накладка рахується від виходу, а не від початку: якщо на дорогу
    // закладено пів години, то й піти треба на пів години раніше.
    const clash = lessons.find((l) => leave < l.end && club.end > l.start)
    const notes = [
      clash ? `Накладається на ${clash.n}-й урок — він до ${formatTime(clash.end)}` : null,
      club.travel ? `Вийти о ${formatTime(leave)}` : null,
    ].filter(Boolean)

    const row: DisplayLesson = {
      n: 0,
      period: CLUB_PERIOD,
      start: club.start,
      end: club.end,
      items: [{ subject: club.name, room: club.place, teacher: club.note }],
      note: notes.length > 0 ? notes.join(' · ') : undefined,
      club: club.id,
    }
    return row
  })

  return [...lessons, ...rows].sort((a, b) => a.start - b.start)
}

/** Тільки справжні уроки — без гуртків. */
export function lessonsOnly(rows: DisplayLesson[]): DisplayLesson[] {
  return rows.filter((row) => !row.club)
}
