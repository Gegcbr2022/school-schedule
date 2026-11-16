/**
 * Власні правки розкладу.
 *
 * Розклад зі школи буває неточний: урок переїхав, кабінет інший, а новий
 * PDF ще не прийшов. Чекати на нього людина не мусить — урок можна
 * виправити самому. Правка живе в профілі, на цьому пристрої, і нікуди не
 * йде: ні на сервер, ні в чужі телефони.
 *
 * Правка стосується одного місця в тижні — дня й уроку за дзвінками — і
 * каже, що там тепер: інший урок або нічого. Діє вона в «моєму» розкладі,
 * а з ним — у віджетах, нагадуваннях і «Дні родини»; «повний» розклад
 * лишається таким, яким його дала школа.
 */

import type { ClassTimetable, Period, WeekParity } from '../data/schedule'
import { BELLS, PERIODS } from '../data/schedule'
import type { DisplayLesson } from './lessons'
import { buildDay } from './lessons'
import type { Groups } from './prefs'

/** Що стоїть на місці уроку — рядками, як їх ввели. */
export type EditItem = { subject: string; room?: string; teacher?: string }

export type LessonEdit = {
  /**
   * Клас, до якого правка. Профіль перевели в інший клас — правка не
   * поїде за ним, а повернуть назад — знову діятиме.
   */
  cls: string
  /** День, 0 (Пн) … 4 (Пт). */
  d: number
  /** Урок за загальношкільним розкладом дзвінків. */
  p: number
  /** Лише на тижнях цієї парності; немає — щотижня. */
  w?: WeekParity
  /** Що тепер на цьому місці; `null` — уроку немає. */
  item: EditItem | null
}

/** Місце в тижні: день і урок. */
export type Place = { d: number; p: number }

const inDay = (e: LessonEdit, cls: string, d: number, week: WeekParity) =>
  e.cls === cls && e.d === d && (!e.w || e.w === week)

/** Правка, що діє тут цього тижня. Правка на один тиждень переважає щотижневу. */
export function editAt(
  edits: LessonEdit[] | undefined,
  cls: string,
  { d, p }: Place,
  week: WeekParity,
): LessonEdit | undefined {
  let found: LessonEdit | undefined
  for (const e of edits ?? []) {
    if (e.p === p && inDay(e, cls, d, week) && (!found || e.w)) found = e
  }
  return found
}

/** День «мого» розкладу з правками: замінені, прибрані й додані уроки, нумерація заново. */
export function applyEdits(
  day: DisplayLesson[],
  edits: LessonEdit[] | undefined,
  cls: string,
  d: number,
  week: WeekParity,
): DisplayLesson[] {
  const here = (edits ?? []).filter((e) => inDay(e, cls, d, week))
  if (here.length === 0) return day

  const periods = new Set(here.map((e) => e.p))
  const added: DisplayLesson[] = []
  for (const p of periods) {
    const item = editAt(here, cls, { d, p }, week)?.item
    const bell = BELLS[p as Period]
    if (item && bell) {
      added.push({ n: 0, period: p, ...bell, items: [{ ...item }], note: 'Ваша правка', edited: true })
    }
  }

  return [...day.filter((l) => !periods.has(l.period)), ...added]
    .sort((a, b) => a.period - b.period)
    .map((l, i) => ({ ...l, n: i + 1 }))
}

/** Прибрати правку, що діє тут цього тижня, — урок знову як у розкладі. */
export function revertEdit(
  edits: LessonEdit[] | undefined,
  cls: string,
  place: Place,
  week: WeekParity,
): LessonEdit[] {
  const found = editAt(edits, cls, place, week)
  return (edits ?? []).filter((e) => e !== found)
}

/** Урок цього місця в шкільному розкладі — без жодних правок. */
function officialAt(cls: ClassTimetable, groups: Groups, { d, p }: Place, week: WeekParity) {
  return buildDay(cls, d, groups, 'my', week).find((l) => l.period === p)
}

/**
 * Урок на цьому місці різний на першому й другому тижні (хімія «через
 * тиждень», географія з історією по черзі) — тоді й правка лише на
 * тиждень, який відкрито. Інакше вона зачепила б і сусідній.
 */
export function weekOnly(cls: ClassTimetable, groups: Groups, place: Place): boolean {
  const items = (week: WeekParity) => JSON.stringify(officialAt(cls, groups, place, week)?.items ?? null)
  return items(1) !== items(2)
}

const same = (a: EditItem, b: EditItem) =>
  a.subject === b.subject && (a.room ?? '') === (b.room ?? '') && (a.teacher ?? '') === (b.teacher ?? '')

/**
 * Записати урок на місце `to` — а якщо він прийшов із `from`, звільнити
 * `from`. `item: null` прибирає урок.
 *
 * Правок, що нічого не міняють, не лишаємо: перенесли урок назад або
 * вписали те саме, що й у розкладі, — місце просто повертається до
 * шкільного.
 */
export function saveLesson(
  edits: LessonEdit[] | undefined,
  cls: ClassTimetable,
  groups: Groups,
  week: WeekParity,
  from: Place | null,
  to: Place,
  item: EditItem | null,
): LessonEdit[] {
  const put = (list: LessonEdit[], place: Place, what: EditItem | null): LessonEdit[] => {
    const official = officialAt(cls, groups, place, week)
    const unchanged = what
      ? official?.items.length === 1 && same(official.items[0], what)
      : !official
    const reverted = revertEdit(list, cls.id, place, week)
    if (unchanged) return reverted
    const w = weekOnly(cls, groups, place) ? week : undefined
    // Нова правка перекриває ті, що стоять на тому самому місці й тижні.
    const rest = reverted.filter(
      (e) => !(e.cls === cls.id && e.d === place.d && e.p === place.p && (!w || e.w === w)),
    )
    return [...rest, { cls: cls.id, d: place.d, p: place.p, ...(w ? { w } : {}), item: what }]
  }

  let next = edits ?? []
  if (from && (from.d !== to.d || from.p !== to.p)) next = put(next, from, null)
  return put(next, to, item)
}

/** Уроки, які людина сама прибрала з цього дня, — щоб їх було видно й можна повернути. */
export function removedOn(
  cls: ClassTimetable,
  groups: Groups,
  edits: LessonEdit[] | undefined,
  d: number,
  week: WeekParity,
): DisplayLesson[] {
  if (!edits?.length) return []
  return buildDay(cls, d, groups, 'my', week).filter(
    (l) => editAt(edits, cls.id, { d, p: l.period }, week)?.item === null,
  )
}

/* ── Сховище ─────────────────────────────────────────────────────────── */

/** Більше правок, ніж уроків у тижні, не буває; решта — сміття. */
const MAX_EDITS = 200

const clip = (value: unknown, limit: number) =>
  typeof value === 'string' ? value.trim().slice(0, limit) : ''

/** Правки з localStorage; биті записи відкидаємо поодинці, а не всі разом. */
export function readEdits(raw: unknown): LessonEdit[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: LessonEdit[] = []

  for (const value of raw.slice(0, MAX_EDITS)) {
    if (typeof value !== 'object' || value === null) continue
    const it = value as Record<string, unknown>
    const cls = clip(it.cls, 40)
    const { d, p, w } = it
    if (!cls || typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 4) continue
    if (!PERIODS.includes(p as Period)) continue

    let item: EditItem | null = null
    if (it.item !== null) {
      if (typeof it.item !== 'object') continue
      const src = it.item as Record<string, unknown>
      const subject = clip(src.subject, 60)
      if (!subject) continue
      const room = clip(src.room, 20)
      const teacher = clip(src.teacher, 60)
      item = { subject, ...(room ? { room } : {}), ...(teacher ? { teacher } : {}) }
    }

    out.push({ cls, d, p: p as number, ...(w === 1 || w === 2 ? { w } : {}), item })
  }

  return out.length > 0 ? out : undefined
}
