/**
 * Хто стоїть за кодами вчителів у розкладі.
 *
 * Сам список тепер у паку (`pack.ts`) — тут лишаються типи. Насінна
 * копія й нерозкодовані коди — в `seed/teachers.ts`.
 */

import { pack } from './pack'

/** Умова, за якою урок належить саме цій людині (для спільних кодів). */
export type Claim = {
  /** Предмети (ключі `SUBJECTS`). Немає — будь-який. */
  s?: string[]
  /** Класи (`id` як у `TIMETABLE`). Немає — будь-який. */
  in?: string[]
}

export type Teacher = {
  /** Ідентифікатор у шкільному журналі — стабільний ключ. */
  id: number
  /** Код, яким ця людина позначена в розкладі. */
  code: string
  last: string
  first: string
  patronymic?: string
  /**
   * Один код — двоє тезок. Урок належить цій людині, якщо спрацювала
   * хоч одна умова. Немає `when` — усі уроки коду її.
   */
  when?: Claim[]
}

export const TEACHERS = pack.teachers

/**
 * Код із розкладу, за яким у журналі ліцею людини немає.
 */
export type Undecoded = {
  /** Предмет, який під цим кодом стоїть у розкладі. */
  subject: string
  /** Прізвище й ім'я, якщо їх видно деінде — скажімо, в розкладі вчителів. */
  last?: string
  first?: string
}

export { UNDECODED_CODES } from './seed/teachers'
