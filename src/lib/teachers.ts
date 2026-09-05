/**
 * Хто стоїть за кодом учителя в розкладі.
 *
 * Дані — у `data/teachers.ts` (згенеровано зі шкільного журналу).
 * Один код інколи ділять двоє тезок; розводимо їх за предметом і класом
 * через `when`-умови з даних.
 */

import type { Claim, Teacher, Undecoded } from '../data/teachers'
import { TEACHERS, UNDECODED_CODES } from '../data/teachers'

export type { Teacher, Undecoded } from '../data/teachers'

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

/**
 * Прізвище, скорочене рівно настільки, щоб відрізнити тезок за іменем
 * і по батькові. Здебільшого це одна літера («Ж.»), але Світлана
 * Степанівна в школі не одна, і обидві на «М» — тоді «Ма.» і «Ми.».
 */
const shortLast = new Map<number, string>()
{
  const namesakes = new Map<string, Teacher[]>()
  for (const t of TEACHERS) {
    const key = politeName(t)
    const list = namesakes.get(key)
    if (list) list.push(t)
    else namesakes.set(key, [t])
  }
  for (const group of namesakes.values()) {
    for (const t of group) {
      let n = 1
      while (
        n < t.last.length &&
        group.some((other) => other !== t && other.last.startsWith(t.last.slice(0, n)))
      ) {
        n += 1
      }
      shortLast.set(t.id, n < t.last.length ? `${t.last.slice(0, n)}.` : t.last)
    }
  }
}

/**
 * Як підписати вчителя в розкладі: «Галина Богданівна Ж.».
 *
 * До вчителя звертаються на ім'я та по батькові — воно й головне;
 * прізвище лишається настільки, щоб не сплутати тезок.
 */
export function scheduleName(t: Teacher): string {
  const polite = politeName(t)
  return polite ? `${polite} ${shortLast.get(t.id) ?? t.last}` : t.last
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

/** Коди, за якими в журналі ліцею запису немає. */
export function undecodedCodes(): (Undecoded & { code: string })[] {
  return Object.entries(UNDECODED_CODES).map(([code, u]) => ({ code, ...u }))
}

/**
 * Ім'я під нерозшифрованим кодом. У журналі такої людини немає, зате її
 * називає учительський розклад — цього досить, щоб підписати урок.
 */
function undecodedName(code: string): string | undefined {
  const u = UNDECODED_CODES[code]
  return u?.last ? [u.first, u.last].filter(Boolean).join(' ') : undefined
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
 * Підпис учителя для картки уроку: «Галина Богданівна Ж.»; обидва прізвища
 * через «/», якщо код спільний і розвести не вдалось; сам код, якщо він
 * невідомий.
 */
export function teacherLabel(
  code: string | undefined,
  subject?: string,
  classId?: string,
): string | undefined {
  if (!code) return undefined
  const holders = codeHolders(code)
  if (holders.length === 0) return undecodedName(code) ?? code
  const one = teacherOf(code, subject, classId)
  return one ? scheduleName(one) : holders.map((t) => t.last).join(' / ')
}
