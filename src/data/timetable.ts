/**
 * Розклад усієї школи, 4–11 класи.
 *
 * Дані тепер приходять із пака (`pack.ts`) — тут лишається лише експорт,
 * що читає їх звідти. Насінна копія й опис полів комірки — в
 * `seed/timetable.ts`.
 */

import { pack } from './pack'

export const TIMETABLE = pack.timetable
