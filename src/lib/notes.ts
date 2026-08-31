/**
 * Нотатки до уроків: домашнє завдання, нагадування — усе, що учень
 * хоче записати собі. Живуть лише в localStorage цього пристрою,
 * як і решта — жодного сервера.
 *
 * Ключ прив'язаний до конкретної дати й уроку, а не до дня тижня:
 * домашнє завдання здають у певний день, а не «щовівторка».
 */

const KEY = 'rozklad:notes:v1'

/** `клас|рррр-мм-дд|період` → текст нотатки. */
type Store = Record<string, string>

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Store) : {}
  } catch {
    return {}
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* немає куди зберегти — переживемо до перезавантаження */
  }
}

export type NoteKey = {
  classId: string
  /** `рррр-мм-дд` за київським календарем. */
  date: string
  period: number
}

function keyOf({ classId, date, period }: NoteKey): string {
  return `${classId}|${date}|${period}`
}

export function getNote(key: NoteKey): string {
  return read()[keyOf(key)] ?? ''
}

/** Порожній текст стирає нотатку, щоб сховище не сміттям не обростало. */
export function setNote(key: NoteKey, text: string): void {
  const store = read()
  const trimmed = text.trim()
  if (trimmed) store[keyOf(key)] = trimmed
  else delete store[keyOf(key)]
  write(store)
}

/** Дати (`рррр-мм-дд`), у яких для цього класу є хоч одна нотатка. */
export function datesWithNotes(classId: string): Set<string> {
  const out = new Set<string>()
  for (const k of Object.keys(read())) {
    const [cls, date] = k.split('|')
    if (cls === classId) out.add(date)
  }
  return out
}

/** Скільки нотаток збережено для дня — щоб підписати вкладку чи картку. */
export function noteCountOn(classId: string, date: string): number {
  const prefix = `${classId}|${date}|`
  return Object.keys(read()).filter((k) => k.startsWith(prefix)).length
}
