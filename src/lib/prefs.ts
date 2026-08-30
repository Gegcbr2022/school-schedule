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

/** Налаштування учня. Живуть тільки в localStorage цього пристрою. */
export type Prefs = {
  classGroup: ClassGroup
  language: LanguageGroup
  english: EnglishGroup
  /** Не впливає на назву предмета — лише на підпис у повному розкладі. */
  gender: GenderGroup | null
}

export type Theme = 'light' | 'dark' | 'system'

const PREFS_KEY = 'rozklad-10b:prefs:v1'
const THEME_KEY = 'rozklad-10b:theme:v1'

export const DEFAULT_PREFS: Prefs = {
  classGroup: '1',
  language: 'de',
  english: 'А',
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

function oneOf<T extends string>(allowed: readonly T[], value: unknown): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null
}

/**
 * Читає збережені налаштування. Повертає `null`, якщо їх ще немає —
 * саме за цим ми розуміємо, що треба показати перше знайомство.
 */
export function loadPrefs(): Prefs | null {
  const raw = readRaw(PREFS_KEY)
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null

  const o = parsed as Record<string, unknown>
  const classGroup = oneOf(CLASS_GROUPS, o.classGroup)
  const language = oneOf(LANGUAGE_GROUPS, o.language)
  const english = oneOf(ENGLISH_GROUPS, o.english)
  // Усі три обов'язкові: якщо формат зіпсовано — питаємо заново.
  if (!classGroup || !language || !english) return null

  return {
    classGroup,
    language,
    english,
    gender: oneOf(GENDER_GROUPS, o.gender),
  }
}

export function savePrefs(prefs: Prefs): void {
  writeRaw(PREFS_KEY, JSON.stringify(prefs))
}

export function clearPrefs(): void {
  try {
    localStorage.removeItem(PREFS_KEY)
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

/* ── Підписи для інтерфейсу ──────────────────────────────────────────── */

export const CLASS_GROUP_LABEL: Record<ClassGroup, string> = {
  '1': '1 група',
  '2': '2 група',
}

export const LANGUAGE_LABEL: Record<LanguageGroup, string> = {
  de: 'Німецька',
  fr: 'Французька',
}

/** Позначка мовної групи так, як вона стоїть у паперовому розкладі. */
export const LANGUAGE_TAG: Record<LanguageGroup, string> = {
  de: 'група Н',
  fr: 'група Ф',
}

export const GENDER_LABEL: Record<GenderGroup, string> = {
  boys: 'Хлопці',
  girls: 'Дівчата',
}
