import type {
  ClassGroup,
  EnglishGroup,
  GenderGroup,
  LanguageGroup,
  WeekParity,
} from '../data/schedule'
import {
  CLASS_GROUPS,
  ENGLISH_GROUPS,
  GENDER_GROUPS,
  LANGUAGE_GROUPS,
} from '../data/schedule'
import { TEACHERS } from '../data/teachers'
import { TIMETABLE } from '../data/timetable'

/**
 * Поділи, за якими з розкладу класу лишається саме свій.
 * Окремим типом, бо саме їх — і нічого більше — питає `buildDay`.
 */
export type Groups = {
  classGroup: ClassGroup
  language: LanguageGroup
  english: EnglishGroup
  /** Впливає лише на те, який зал показати на фізкультурі. */
  gender: GenderGroup | null
}

/**
 * Гурток, секція, музична школа, репетитор — усе, чого в шкільному
 * розкладі немає, але воно стоїть у тому самому дні дитини.
 *
 * Свідомо просте: день тижня й час, а не повноцінні правила повторення.
 * «Щовівторка о 17:00» — це майже все, що буває насправді.
 */
export type Club = {
  id: string
  /** «Футбол», «Музична школа». */
  name: string
  /** Дні тижня за ISO: 1 (Пн) … 7 (Нд). */
  days: number[]
  /** Хвилини від київської півночі. */
  start: number
  end: number
  /** Де це: «ДЮСШ», «вул. Стрільців, 15». */
  place?: string
  /**
   * Скільки хвилин закладено на дорогу. Саме через це поле застосунок і
   * знає, що з останнього уроку до гуртка встигнути неможливо, — а не
   * тоді, коли по дитину вже їдуть.
   */
  travel?: number
  /** Вільний рядок: тренер, телефон, оплата, що взяти. */
  note?: string
  /** Буває лише на тижнях цієї парності; немає — щотижня. */
  week?: WeekParity
}

/**
 * Чий розклад показує застосунок.
 *
 * В учня й учителя профіль один. У батьків їх стільки, скільки дітей;
 * у завуча — скільки вчителів і класів він тримає під оком. Механізм
 * той самий, різняться лише підписи.
 */
export type Profile = Groups & {
  /**
   * Стабільний ключ. Під ним живуть нотатки цього профілю, тож міняти
   * його не можна навіть тоді, коли профіль перейменували чи перевели
   * в інший клас: разом із ключем зникло б і все записане.
   */
  id: string
  /** Як підписати. Порожньо — беремо назву класу або прізвище вчителя. */
  name: string
  /** Ідентифікатор класу, як у `TIMETABLE`. */
  classId: string
  /** Стоїть — це розклад учителя, а не класу. Ідентифікатор із `data/teachers.ts`. */
  teacherId: number | null
  clubs: Club[]
}

/**
 * Хто дивиться. Впливає на підписи й на те, чи показувати перемикач, —
 * але не на самі дані: профілі в усіх ролей однакові.
 */
export type Role = 'student' | 'teacher' | 'parent' | 'head'

export const ROLES: Role[] = ['student', 'teacher', 'parent', 'head']

/** Ролі, у яких профілів буває більше одного. */
export function isMulti(role: Role): boolean {
  return role === 'parent' || role === 'head'
}

/** Налаштування пристрою. Живуть тільки в localStorage — жодного сервера. */
export type Prefs = {
  role: Role
  /** Хоча б один; перший — той, з якого починали. */
  profiles: Profile[]
  /** `id` профілю, який зараз відкрито. */
  activeId: string
}

export type Theme = 'light' | 'dark' | 'system'

const PREFS_KEY = 'rozklad:prefs:v3'
/** Ключ із часів, коли розклад був один на пристрій. Читаємо, щоб не перепитувати. */
const SOLO_PREFS_KEY = 'rozklad:prefs:v2'
/** Ключ ще раніший — коли розклад був лише для 10-Б. */
const LEGACY_PREFS_KEY = 'rozklad-10b:prefs:v1'
/** Тему навмисно лишили під старим ключем — щоб вона пережила оновлення. */
const THEME_KEY = 'rozklad-10b:theme:v1'

export const DEFAULT_CLASS_ID = '10б'

export const DEFAULT_GROUPS: Groups = {
  classGroup: '1',
  language: 'н',
  english: 'а',
  gender: null,
}

export const DEFAULT_PROFILE: Profile = {
  ...DEFAULT_GROUPS,
  id: DEFAULT_CLASS_ID,
  name: '',
  classId: DEFAULT_CLASS_ID,
  teacherId: null,
  clubs: [],
}

export const DEFAULT_PREFS: Prefs = {
  role: 'student',
  profiles: [DEFAULT_PROFILE],
  activeId: DEFAULT_PROFILE.id,
}

/** Профіль, який зараз відкрито. Перший — запасний варіант на будь-який випадок. */
export function activeProfile(prefs: Prefs): Profile {
  return prefs.profiles.find((p) => p.id === prefs.activeId) ?? prefs.profiles[0] ?? DEFAULT_PROFILE
}

/** Замінити один профіль у наборі, лишивши решту як є. */
export function withProfile(prefs: Prefs, profile: Profile): Prefs {
  return {
    ...prefs,
    profiles: prefs.profiles.map((p) => (p.id === profile.id ? profile : p)),
  }
}

/** Вільний ключ для нового профілю: «п2», «п3»… Старі ключі не чіпаємо. */
export function nextProfileId(prefs: Prefs): string {
  const taken = new Set(prefs.profiles.map((p) => p.id))
  let n = prefs.profiles.length + 1
  while (taken.has(`п${n}`)) n += 1
  return `п${n}`
}

/** Вільний ключ для нового гуртка в межах профілю. */
export function nextClubId(clubs: Club[]): string {
  const taken = new Set(clubs.map((c) => c.id))
  let n = clubs.length + 1
  while (taken.has(`г${n}`)) n += 1
  return `г${n}`
}

/**
 * «Показувати як мій розклад» із довідника вчителів.
 *
 * Там, де профіль один, він і стає вчительським — як було до профілів.
 * Там, де профілів кілька, підміняти відкритий профіль не можна: дитина
 * не має перетворитись на вчителя. Тоді вчитель або вже є в списку — і ми
 * просто відкриваємо його, — або стає в списку новим.
 */
export function pinTeacher(prefs: Prefs, teacherId: number | null): Prefs {
  const active = activeProfile(prefs)
  if (prefs.profiles.length < 2 && !isMulti(prefs.role)) {
    return withProfile(prefs, { ...active, teacherId })
  }
  // Зняти закріплення нема з чого: у списку профіль учителя стоїть сам по
  // собі, і прибирають його там само, де й додали, — у налаштуваннях.
  if (teacherId === null) return prefs

  const known = prefs.profiles.find((p) => p.teacherId === teacherId)
  if (known) return { ...prefs, activeId: known.id }

  const added: Profile = {
    ...DEFAULT_GROUPS,
    id: nextProfileId(prefs),
    name: '',
    classId: active.classId,
    teacherId,
    clubs: [],
  }
  return { ...prefs, profiles: [...prefs.profiles, added], activeId: added.id }
}

/* ── Сховище ─────────────────────────────────────────────────────────── */

/** localStorage може кинути виняток (приватний режим, вимкнені куки). */
function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* нема куди зберігати — працюємо в пам'яті до перезавантаження */
  }
}

function parseJson(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null
}

function knownClass(value: unknown): string | null {
  return typeof value === 'string' && TIMETABLE.some((c) => c.id === value) ? value : null
}

function knownTeacher(value: unknown): number | null {
  return typeof value === 'number' && TEACHERS.some((t) => t.id === value) ? value : null
}

function text(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

/** Хвилини від півночі; усе, що поза добою, — не час. */
function minutesOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 24 * 60
    ? Math.round(value)
    : null
}

/* ── Читання ─────────────────────────────────────────────────────────── */

function readGroups(raw: Record<string, unknown>): Groups {
  return {
    classGroup: oneOf(CLASS_GROUPS, raw.classGroup) ?? DEFAULT_GROUPS.classGroup,
    language: oneOf(LANGUAGE_GROUPS, raw.language) ?? DEFAULT_GROUPS.language,
    english: oneOf(ENGLISH_GROUPS, raw.english) ?? DEFAULT_GROUPS.english,
    gender: oneOf(GENDER_GROUPS, raw.gender),
  }
}

function readClub(raw: unknown): Club | null {
  if (typeof raw !== 'object' || raw === null) return null
  const it = raw as Record<string, unknown>

  const name = text(it.name, 60)
  const start = minutesOf(it.start)
  const end = minutesOf(it.end)
  const days = Array.isArray(it.days)
    ? [...new Set(it.days.filter((d): d is number => typeof d === 'number' && d >= 1 && d <= 7))]
    : []
  // Без назви, часу чи дня показувати нічого — такий запис і не зберігся б.
  if (!name || start === null || end === null || end <= start || days.length === 0) return null

  return {
    id: text(it.id, 20) || name,
    name,
    days: days.sort((a, b) => a - b),
    start,
    end,
    place: text(it.place, 80) || undefined,
    travel: minutesOf(it.travel) || undefined,
    note: text(it.note, 200) || undefined,
    week: it.week === 1 || it.week === 2 ? (it.week as WeekParity) : undefined,
  }
}

function readProfile(raw: unknown): Profile | null {
  if (typeof raw !== 'object' || raw === null) return null
  const it = raw as Record<string, unknown>

  // Клас потрібен навіть учителю: з нього беруться підручники й розклад,
  // якщо самого вчителя в даних раптом не стане.
  const classId = knownClass(it.classId)
  const id = text(it.id, 40)
  if (!classId || !id) return null

  return {
    ...readGroups(it),
    id,
    name: text(it.name, 40),
    classId,
    teacherId: knownTeacher(it.teacherId),
    clubs: Array.isArray(it.clubs)
      ? it.clubs.map(readClub).filter((c): c is Club => c !== null)
      : [],
  }
}

/**
 * Налаштування з часів «один розклад на пристрій»: класу з групами або
 * вчителя. Стають першим профілем — і, головне, зберігають свій ключ:
 * саме під ним лежать усі записані нотатки.
 */
function migrateSolo(raw: Record<string, unknown>): Prefs | null {
  const classId = knownClass(raw.classId)
  if (!classId) return null
  const teacherId = knownTeacher(raw.teacherId)

  const profile: Profile = {
    ...readGroups(raw),
    // Той самий ключ, яким нотатки підписувались досі (див. `lib/notes.ts`).
    id: teacherId === null ? classId : `вч${teacherId}`,
    name: '',
    classId,
    teacherId,
    clubs: [],
  }

  return {
    role: teacherId === null ? 'student' : 'teacher',
    profiles: [profile],
    activeId: profile.id,
  }
}

/**
 * Налаштування з часів «тільки 10-Б». Позначення груп тоді були інші,
 * тому переносимо їх, а не викидаємо: людина, яка вже поставила застосунок,
 * не повинна нічого налаштовувати заново.
 */
function migrateLegacy(): Prefs | null {
  const old = parseJson(readRaw(LEGACY_PREFS_KEY))
  if (!old) return null

  const classGroup = oneOf(CLASS_GROUPS, old.classGroup)
  if (!classGroup) return null

  const english = { А: 'а', Б: 'б', В: 'в' }[String(old.english)] as EnglishGroup | undefined
  const language = { de: 'н', fr: 'ф' }[String(old.language)] as LanguageGroup | undefined
  const gender = { boys: 'х', girls: 'д' }[String(old.gender)] as GenderGroup | undefined

  const profile: Profile = {
    id: DEFAULT_CLASS_ID,
    name: '',
    classId: DEFAULT_CLASS_ID,
    classGroup,
    english: english ?? DEFAULT_GROUPS.english,
    language: language ?? DEFAULT_GROUPS.language,
    gender: gender ?? null,
    teacherId: null,
    clubs: [],
  }

  return { role: 'student', profiles: [profile], activeId: profile.id }
}

/**
 * Читає збережені налаштування. Повертає `null`, якщо їх ще немає —
 * саме за цим ми розуміємо, що треба показати перше знайомство.
 */
export function loadPrefs(): Prefs | null {
  const stored = parseJson(readRaw(PREFS_KEY))

  if (!stored) {
    const solo = parseJson(readRaw(SOLO_PREFS_KEY))
    const migrated = (solo && migrateSolo(solo)) || migrateLegacy()
    if (migrated) savePrefs(migrated)
    return migrated
  }

  const profiles = Array.isArray(stored.profiles)
    ? stored.profiles.map(readProfile).filter((p): p is Profile => p !== null)
    : []
  // Без жодного цілого профілю показувати нічого — питаємо заново.
  if (profiles.length === 0) return null

  const activeId = typeof stored.activeId === 'string' ? stored.activeId : ''

  return {
    role: oneOf(ROLES, stored.role) ?? 'student',
    profiles,
    // Профіль могли видалити на іншій вкладці — тоді відкриваємо перший.
    activeId: profiles.some((p) => p.id === activeId) ? activeId : profiles[0].id,
  }
}

export function savePrefs(prefs: Prefs): void {
  writeRaw(PREFS_KEY, JSON.stringify(prefs))
}

export function clearPrefs(): void {
  try {
    localStorage.removeItem(PREFS_KEY)
    localStorage.removeItem(SOLO_PREFS_KEY)
    localStorage.removeItem(LEGACY_PREFS_KEY)
    localStorage.removeItem(THEME_KEY)
  } catch {
    /* нічого не вдієш */
  }
}

export function loadTheme(): Theme {
  return oneOf(['light', 'dark', 'system'] as const, readRaw(THEME_KEY)) ?? 'system'
}

export function saveTheme(theme: Theme): void {
  writeRaw(THEME_KEY, theme)
}

/**
 * Просимо браузер не витирати сховище під час чистки місця.
 * Кличемо в мить, коли людина справді щось вклала — завела другу дитину
 * чи перший гурток: до того втрачати нічого, а діалог питати ні до чого.
 * Відповідь нікого не цікавить: погодився браузер чи ні, робимо те саме.
 */
export function keepStorage(): void {
  void navigator.storage?.persist?.().catch(() => {})
}
