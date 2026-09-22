/**
 * Прохання оцінити застосунок.
 *
 * НАВІЩО. Оцінки — єдине, що App Store бачить про застосунок, у якого
 * ще немає ані завантажень, ані історії. Людина, якій застосунок
 * подобається, сама в магазин не піде: вона просто користується. Тому
 * питаємо ми — але так, щоб не заважати.
 *
 * КОЛИ. Не на першому запуску й не посеред уроку, а тоді, коли день уже
 * закінчився і застосунок устиг довести, що він корисний: після п'яти
 * різних днів користування. Якщо до «уроки закінчилися» людина так і не
 * дійшла (відкриває лише зранку), питаємо після дванадцятого дня.
 *
 * СКІЛЬКИ. Саме вікно показує iOS і не частіше трьох разів на рік на
 * пристрій — незалежно від того, скільки разів ми попросили. Тому тут
 * своя лічилка: попросили — мовчимо чотири місяці. Інакше ми витрачали б
 * ліміт системи даремно й не дізнавались би про це.
 *
 * ДЕ НЕ ПРАЦЮЄ. У браузері й у PWA містка немає — і питати нічого:
 * сторінку в App Store не оцінюють.
 */

import type { CalendarDate } from './clock'
import { dateKey, daysBetween, parseDateKey } from './clock'

type Bridge = { postMessage: (value: unknown) => void }

const KEY = 'rozklad:review:v1'

/** Скільки різних днів користування, перш ніж просити. */
const DAYS_BEFORE_ASK = 5
/** Стільки днів — і питаємо навіть тоді, коли до кінця уроків не дійшло. */
const DAYS_BEFORE_ASK_ANYWAY = 12
/** Попросили — і мовчимо стільки днів. */
const ASK_AGAIN_AFTER_DAYS = 120

type State = {
  /** Останній зарахований день, щоб не рахувати той самий двічі. */
  lastDay?: string
  /** Скільки різних днів застосунок відкривали. */
  days: number
  /** Коли востаннє просили оцінити. */
  asked?: string
}

function bridge(): Bridge | null {
  return (window.webkit?.messageHandlers?.review as Bridge | undefined) ?? null
}

/** Чи є кому показати вікно оцінки. */
export function reviewWorks(): boolean {
  return bridge() !== null
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { days: 0 }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { days: 0 }
    const state = parsed as Partial<State>
    return {
      lastDay: typeof state.lastDay === 'string' ? state.lastDay : undefined,
      days: typeof state.days === 'number' && state.days >= 0 ? state.days : 0,
      asked: typeof state.asked === 'string' ? state.asked : undefined,
    }
  } catch {
    return { days: 0 }
  }
}

function save(state: State): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* Приватний режим або немає місця — просто не питаємо. */
  }
}

/**
 * Зарахувати сьогоднішній день. Викликається на кожному запуску;
 * той самий день двічі не рахується.
 */
export function noteUsage(today: CalendarDate): void {
  if (!reviewWorks()) return
  const state = load()
  const key = dateKey(today)
  if (state.lastDay === key) return
  save({ ...state, lastDay: key, days: state.days + 1 })
}

/**
 * Попросити оцінити, якщо момент підходящий.
 *
 * `dayOver` — уроки на сьогодні закінчилися. Саме цей момент і є
 * «добрим»: людина щойно закрила день, нічого не чекає й нікуди не
 * поспішає.
 *
 * Повертає `true`, якщо прохання пішло в iOS. Саме вікно система може й
 * не показати — це її рішення, і дізнатись про нього не можна.
 */
export function maybeAskReview(today: CalendarDate, dayOver: boolean): boolean {
  const target = bridge()
  if (!target) return false

  const state = load()
  if (state.days < (dayOver ? DAYS_BEFORE_ASK : DAYS_BEFORE_ASK_ANYWAY)) return false
  if (state.asked && daysBetween(parseDateKey(state.asked), today) < ASK_AGAIN_AFTER_DAYS) {
    return false
  }

  try {
    target.postMessage('ask')
  } catch {
    return false
  }

  save({ ...state, asked: dateKey(today) })
  return true
}
