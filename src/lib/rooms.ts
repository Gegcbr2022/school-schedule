/**
 * Карта кабінетів: хто де сидить у конкретну годину.
 *
 * Рахуємо просто за розкладом — про заміни, перенесення й те, що клас пішов
 * на захід, ми не знаємо. Тому «вільний» тут означає лише «за розкладом на
 * цей урок ніхто не стоїть», а не «туди можна зайти». Це бета.
 */

import type { Period, WeekParity } from '../data/schedule'
import { BELLS, GROUP_LABEL, PERIODS, subjectName } from '../data/schedule'
import { TIMETABLE } from '../data/timetable'
import { roomLabel } from './lessons'
import { teacherLabel } from './teachers'

/** Один урок, який іде в кабінеті. */
export type RoomUse = {
  /** «10-Б». */
  cls: string
  subject: string
  who?: string
  /** «1 група», «Хлопці» — якщо в кабінеті лише частина класу. */
  group?: string
}

export type RoomState = {
  /** Як у розкладі: «12», «сз», «акт.зал». */
  room: string
  /** Як показуємо: «каб. 12», «сз». */
  label: string
  /** Порожньо — за розкладом кабінет вільний. */
  busy: RoomUse[]
}

/**
 * Усі кабінети з розкладу: спершу номери за зростанням, далі назви
 * («акт.зал», «бібл», «сз», «тз») за абеткою.
 */
export const ROOM_LIST: string[] = (() => {
  const seen = new Set<string>()
  for (const cls of TIMETABLE)
    for (const day of cls.days)
      for (const lesson of day) for (const cell of lesson.c) if (cell.r) seen.add(cell.r)

  return [...seen].sort((a, b) => {
    const na = Number(a)
    const nb = Number(b)
    const aNum = !Number.isNaN(na)
    const bNum = !Number.isNaN(nb)
    if (aNum !== bNum) return aNum ? -1 : 1
    return aNum ? na - nb : a.localeCompare(b, 'uk')
  })
})()

/** Урок, який іде просто зараз; `null` — перерва, ранок або вечір. */
export function periodAt(minutes: number): Period | null {
  return PERIODS.find((p) => minutes >= BELLS[p].start && minutes < BELLS[p].end) ?? null
}

/** Найближчий урок, який ще не почався. */
export function periodAfter(minutes: number): Period | null {
  return PERIODS.find((p) => BELLS[p].start > minutes) ?? null
}

/** Чи буває цей варіант уроку на тижні такої парності. */
function onWeek(cell: { w?: WeekParity; g?: string }, week: WeekParity): boolean {
  if (cell.w && cell.w !== week) return false
  if (cell.g === 'т1' && week !== 1) return false
  if (cell.g === 'т2' && week !== 2) return false
  return true
}

/** Хто сидить у кожному кабінеті на цьому уроці. Порядок — як у `ROOM_LIST`. */
export function roomsAt(dayIndex: number, period: Period, week: WeekParity): RoomState[] {
  const busy = new Map<string, RoomUse[]>()

  for (const cls of TIMETABLE) {
    for (const lesson of cls.days[dayIndex] ?? []) {
      if (lesson.p !== period) continue
      for (const cell of lesson.c) {
        if (!cell.r || !onWeek(cell, week)) continue
        const list = busy.get(cell.r)
        const use: RoomUse = {
          cls: cls.name,
          subject: subjectName(cell.s),
          who: teacherLabel(cell.t, cell.s, cls.id),
          // Парність тижня вже врахована — підписувати її вдруге ні до чого.
          group: cell.g && cell.g[0] !== 'т' ? GROUP_LABEL[cell.g] : undefined,
        }
        if (list) list.push(use)
        else busy.set(cell.r, [use])
      }
    }
  }

  return ROOM_LIST.map((room) => ({
    room,
    label: roomLabel(room) ?? room,
    busy: busy.get(room) ?? [],
  }))
}
