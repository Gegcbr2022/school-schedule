import type {
  ClassGroup,
  EnglishGroup,
  GenderGroup,
  LanguageGroup,
} from '../data/schedule'
import {
  CLASS_GROUPS,
  ENGLISH_GROUPS,
  GENDER_GROUPS,
  LANGUAGE_GROUPS,
} from '../data/schedule'
import { TIMETABLE } from '../data/timetable'

/** Налаштування учня. Живуть тільки в localStorage цього пристрою. */
export type Prefs = {
  /** Ідентифікатор класу, як у `TIMETABLE`. */
  classId: string
  classGroup: ClassGroup
  language: LanguageGroup
  english: EnglishGroup
  /** Впливає лише на те, який зал показати на фізкультурі. */
  gender: GenderGroup | null
}

export type Theme = 'light' | 'dark' | 'system'

const PREFS_KEY = 'rozklad:prefs:v2'
/** Ключ з часів, коли розклад був лише для 10-Б. Читаємо, щоб не перепитувати. */
const LEGACY_PREFS_KEY = 'rozklad-10b:prefs:v1'
/** Тему навмисно лишили під старим ключем — щоб вона пережила оновлення. */
const THEME_KEY = 'rozklad-10b:theme:v1'

export const DEFAULT_CLASS_ID = '10б'

export const DEFAULT_PREFS: Prefs = {
  classId: DEFAULT_CLASS_ID,
  classGroup: '1',
  language: 'н',
  english: 'а',
  gender: null,
}

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

  return {
    classId: DEFAULT_CLASS_ID,
    classGroup,
    english: english ?? DEFAULT_PREFS.english,
    language: language ?? DEFAULT_PREFS.language,
    gender: gender ?? null,
  }
}

/**
 * Читає збережені налаштування. Повертає `null`, якщо їх ще немає —
 * саме за цим ми розуміємо, що треба показати перше знайомство.
 */
export function loadPrefs(): Prefs | null {
  const stored = parseJson(readRaw(PREFS_KEY))

  if (!stored) {
    const migrated = migrateLegacy()
    if (migrated) savePrefs(migrated)
    return migrated
  }

  const classId = knownClass(stored.classId)
  const classGroup = oneOf(CLASS_GROUPS, stored.classGroup)
  const language = oneOf(LANGUAGE_GROUPS, stored.language)
  const english = oneOf(ENGLISH_GROUPS, stored.english)
  // Клас обов'язковий: без нього показувати нічого. Решта має запасний варіант.
  if (!classId) return null

  return {
    classId,
    classGroup: classGroup ?? DEFAULT_PREFS.classGroup,
    language: language ?? DEFAULT_PREFS.language,
    english: english ?? DEFAULT_PREFS.english,
    gender: oneOf(GENDER_GROUPS, stored.gender),
  }
}

export function savePrefs(prefs: Prefs): void {
  writeRaw(PREFS_KEY, JSON.stringify(prefs))
}

export function clearPrefs(): void {
  try {
    localStorage.removeItem(PREFS_KEY)
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
