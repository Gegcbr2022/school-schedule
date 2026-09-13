/**
 * Шкільне меню: що дають на сніданок і на обід.
 *
 * Самі страви й дати дії тепер у паку (`pack.ts`) — тут лишаються типи й
 * функції, що з ними працюють. Насінна копія — в `seed/menu.ts`.
 */

import { pack } from './pack'

export type Dish = {
  /**
   * «Вихід» — маса порції, як у самому меню: «150», «150/4.5» (страва
   * плюс масло), «1 шт». Рядком, бо це не завжди число.
   */
  out: string
  name: string
}

export type DayMenu = {
  breakfast: Dish[]
  /** Обід групи подовженого дня. */
  lunch: Dish[]
}

export const MENU_FOR = pack.menuMeta.for
export const MENU_TITLE = pack.menuMeta.title
/** Період дії, `рррр-мм-дд`. */
export const MENU_FROM = pack.menuMeta.from
export const MENU_TO = pack.menuMeta.to

export const MENU = pack.menu

/** Меню на цей день тижня (ISO 1…5), або `null` на вихідних. */
export function menuFor(iso: number): DayMenu | null {
  return MENU[iso - 1] ?? null
}

/** Чи діє це меню на вказану дату (`рррр-мм-дд`). */
export function menuCovers(date: string): boolean {
  return date >= MENU_FROM && date <= MENU_TO
}

/**
 * «150/4.5» → «150/4.5 г»; «1 шт» лишається як є.
 * Крапка у виході — це десята частина грама масла, а не інша одиниця.
 */
export function portion(out: string): string {
  return /^[\d/.]+$/.test(out) ? `${out} г` : out
}
