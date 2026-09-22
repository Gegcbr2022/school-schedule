/**
 * Жива активність: поточний урок на екрані блокування й у динамічному
 * острові.
 *
 * НАВІЩО. Віджет треба покласти на екран самому, а тут застосунок сам
 * з'являється там, де на телефон дивляться найчастіше, — і зникає, коли
 * уроки скінчились. Це те саме «що зараз», лише без відкривання
 * застосунку.
 *
 * ЯК ЦЕ НЕ Ї СТЬ БАТАРЕЮ. У стан їде не «12 хв», а момент кінця уроку;
 * відлік малює система (`Text(timerInterval:)`). Тому оновлювати
 * активність щохвилини не треба — досить чіпати її на межі уроку.
 *
 * ЧОГО НЕМАЄ. Вона не з'явиться сама, поки застосунок не відкривали:
 * запуск активності з фону потребує push-to-start токенів, тобто
 * сервера. Його тут немає й не планується.
 */

import type { KyivTime } from './clock'
import { formatTime } from './clock'
import type { DayStatus, DisplayLesson } from './lessons'
import { roomLabel } from './lessons'

type Bridge = { postMessage: (value: unknown) => void }

export type LiveMessage = {
  type: 'live'
  active: boolean
  profileName: string
  headline: string
  subject: string
  room: string
  /** Мілісекунди від епохи; 0 — відліку немає. */
  deadline: number
  since: number
  /** «Далі: Математика · каб. 18». Порожньо — далі нічого немає. */
  next: string
  /** Після цього моменту написане перестає бути правдою. */
  staleAfter: number
}

let lastKey = ''

function bridge(): Bridge | null {
  return (window.webkit?.messageHandlers?.live as Bridge | undefined) ?? null
}

/** Чи є кому показати живу активність. */
export function liveWorks(): boolean {
  return bridge() !== null
}

function subjectOf(lesson: DisplayLesson): string {
  return lesson.items.map((i) => i.subject).join(' / ')
}

function roomsOf(lesson: DisplayLesson): string {
  const rooms = lesson.items.map((i) => roomLabel(i.room)).filter((r): r is string => r !== null)
  return [...new Set(rooms)].join(' · ')
}

/**
 * Київська хвилина доби → момент часу.
 *
 * Свідомо через різницю з «зараз», а не через побудову дати в поясі:
 * київську хвилину ми вже маємо (`now.minutes`), тож зсув рахується
 * відніманням і не залежить ані від пояса пристрою, ані від переходу на
 * літній час.
 */
function atMinute(now: KyivTime, minutes: number): number {
  return Date.now() + (minutes - now.minutes) * 60_000
}

/**
 * За скільки до першого уроку активність має сенс.
 *
 * Без цієї межі вона висить на екрані блокування цілу ніч: о першій
 * ночі формально «до першого уроку сім годин», і це чиста правда, від
 * якої нікому не легше. Півтори години — це рівно та мить, коли до
 * школи вже збираються.
 */
const AHEAD_MIN = 90

type LiveState = {
  headline: string
  subject: string
  room: string
  /**
   * Що буде після того, що на картці.
   *
   * Найчастіше на живу активність дивляться, щоб зрозуміти не «що
   * зараз» — це й так відомо, — а «куди йти після дзвінка». Один
   * дрібний сірий рядок відповідає на це, не змушуючи відкривати
   * застосунок.
   */
  next: string
  /** Київські хвилини доби. */
  until: number | null
  from: number | null
}

/**
 * Рядок «що буде після цього». Порожній, коли після нього вже нічого.
 */
function follow(lessons: DisplayLesson[], shown: DisplayLesson): string {
  const after = lessons.find((row) => row.start > shown.start)
  if (!after) return 'Далі нічого — це останній'

  const where = roomsOf(after)
  const what = after.club ? `гурток ${subjectOf(after)}` : subjectOf(after)
  return `Далі: ${what} · ${where || `о ${formatTime(after.start)}`}`
}

/** Що саме показати — або `null`, якщо показувати нічого. */
export function liveState(
  status: DayStatus | null,
  lessons: DisplayLesson[] = [],
): LiveState | null {
  if (status === null) return null

  switch (status.kind) {
    case 'lesson':
      return {
        headline: status.current.club ? 'Зараз гурток' : `Зараз ${status.current.n} урок`,
        subject: subjectOf(status.current),
        room: roomsOf(status.current),
        next: follow(lessons, status.current),
        until: status.current.end,
        from: status.current.start,
      }
    case 'break':
      return {
        headline: status.next.club
          ? 'Далі — гурток'
          : status.free > 0
            ? 'Вікно'
            : 'Перерва',
        subject: subjectOf(status.next),
        room: roomsOf(status.next) || `о ${formatTime(status.next.start)}`,
        next: follow(lessons, status.next),
        until: status.next.start,
        from: null,
      }
    case 'before':
      if (status.inMin > AHEAD_MIN) return null
      return {
        headline: status.next.club ? 'Гурток' : 'Перший урок',
        subject: subjectOf(status.next),
        room: roomsOf(status.next) || `о ${formatTime(status.next.start)}`,
        next: follow(lessons, status.next),
        until: status.next.start,
        from: null,
      }
    // Уроки скінчились або їх не було — активності теж бути не має.
    default:
      return null
  }
}

/**
 * Показати чи прибрати активність.
 *
 * `enabled` — і налаштування, і те, що на екрані саме сьогодні: показувати
 * на екрані блокування урок із четверга, поки гортають наступний тиждень,
 * було б неправдою.
 */
export function syncLive(
  enabled: boolean,
  profileName: string,
  status: DayStatus | null,
  now: KyivTime,
  lessons: DisplayLesson[] = [],
): void {
  const target = bridge()
  if (!target) return

  const state = enabled ? liveState(status, lessons) : null

  // Ключ — у київських хвилинах, а не в мілісекундах: інакше він мінявся
  // б на кожному такті годинника й активність смикалась би щопівхвилини.
  const key = state
    ? `${profileName}|${state.headline}|${state.subject}|${state.room}|${state.next}|${state.until}|${state.from}`
    : ''
  if (key === lastKey) return
  lastKey = key

  const message: LiveMessage = state
    ? {
        type: 'live',
        active: true,
        profileName,
        headline: state.headline,
        subject: state.subject,
        room: state.room,
        next: state.next,
        deadline: state.until === null ? 0 : atMinute(now, state.until),
        since: state.from === null ? 0 : atMinute(now, state.from),
        // Дві хвилини після дзвінка — і написане вже не правда. Система
        // пригасить активність сама, навіть якщо застосунок не відкривали.
        staleAfter: state.until === null ? 0 : atMinute(now, state.until + 2),
      }
    : {
        type: 'live',
        active: false,
        profileName,
        headline: '',
        subject: '',
        room: '',
        next: '',
        deadline: 0,
        since: 0,
        staleAfter: 0,
      }

  try {
    target.postMessage(message)
  } catch {
    /* Активність — прикраса, а не робота розкладу. */
  }
}
