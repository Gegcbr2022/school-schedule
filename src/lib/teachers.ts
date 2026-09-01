/**
 * Хто стоїть за кодом учителя в розкладі.
 *
 * Дані — у `data/teachers.ts` (згенеровано зі шкільного журналу).
 * Один код інколи ділять двоє тезок; розводимо їх за предметом і класом
 * через `when`-умови з даних.
 */

import type { Claim, Teacher } from '../data/teachers'
import { TEACHERS, UNDECODED_CODES } from '../data/teachers'

export type { Teacher } from '../data/teachers'

const holdersByCode = new Map<string, Teacher[]>()
for (const t of TEACHERS) {
  const list = holdersByCode.get(t.code)
  if (list) list.push(t)
  else holdersByCode.set(t.code, [t])
}

/* ── Імена ───────────────────────────────────────────────────────────── */

/** «Христина Братина». */
export function fullName(t: Teacher): string {
  return `${t.first} ${t.last}`
}

/** «Братина Христина Степанівна» — як у журналі. */
export function formalName(t: Teacher): string {
  return [t.last, t.first, t.patronymic].filter(Boolean).join(' ')
}

/** «Христина Степанівна» — як до вчителя звертаються. */
export function politeName(t: Teacher): string {
  return [t.first, t.patronymic].filter(Boolean).join(' ')
}

/** Дві літери для кружечка замість фото. */
export function initialsOf(t: Teacher): string {
  return `${t.last[0] ?? ''}${t.first[0] ?? ''}`
}

/* ── Пошук ───────────────────────────────────────────────────────────── */

export function teacherById(id: number): Teacher | undefined {
  return TEACHERS.find((t) => t.id === id)
}

/** Усі вчителі з розкладу, за абеткою прізвищ. */
export function scheduleTeachers(): Teacher[] {
  return [...TEACHERS].sort((a, b) => a.last.localeCompare(b.last, 'uk'))
}

/** Усі, хто ходить під цим кодом (зазвичай один, іноді двоє). */
export function codeHolders(code: string | undefined): Teacher[] {
  return code ? (holdersByCode.get(code) ?? []) : []
}

/** Код у розкладі спільний для двох різних учителів. */
export function isSharedCode(code: string): boolean {
  return codeHolders(code).length > 1
}

/** Коди, які так і не розшифрували: показуємо їх, як на папері. */
export function undecodedCodes(): { code: string; subject: string }[] {
  return Object.entries(UNDECODED_CODES).map(([code, subject]) => ({ code, subject }))
}

/* ── Хто веде цей урок ───────────────────────────────────────────────── */

function claimMatches(claim: Claim, subject?: string, classId?: string): boolean {
  if (claim.s && (!subject || !claim.s.includes(subject))) return false
  if (claim.in && (!classId || !claim.in.includes(classId))) return false
  return true
}

/** Чи веде саме ця людина урок із таким предметом у такому класі. */
export function teaches(t: Teacher, code: string, subject: string, classId: string): boolean {
  if (t.code !== code) return false
  return !t.when || t.when.some((claim) => claimMatches(claim, subject, classId))
}

/**
 * Хто саме веде цю клітинку. За предметом і класом розводимо тезок під
 * одним кодом; якщо однозначно не виходить — `undefined`.
 */
export function teacherOf(
  code: string | undefined,
  subject?: string,
  classId?: string,
): Teacher | undefined {
  const holders = codeHolders(code)
  if (holders.length <= 1) return holders[0]
  const matched = holders.filter((t) => claimsFit(t, subject, classId))
  return matched.length === 1 ? matched[0] : undefined
}

function claimsFit(t: Teacher, subject?: string, classId?: string): boolean {
  return !t.when || t.when.some((claim) => claimMatches(claim, subject, classId))
}

/**
 * Підпис учителя для картки уроку: прізвище; обидва прізвища через «/»,
 * якщо код спільний і розвести не вдалось; сам код, якщо він невідомий.
 */
export function teacherLabel(
  code: string | undefined,
  subject?: string,
  classId?: string,
): string | undefined {
  if (!code) return undefined
  const holders = codeHolders(code)
  if (holders.length === 0) return code
  const one = teacherOf(code, subject, classId)
  return one ? one.last : holders.map((t) => t.last).join(' / ')
}
