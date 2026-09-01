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

/** Один запис у списку завдань. */
export type SavedNote = {
  /** `рррр-мм-дд` за київським календарем. */
  date: string
  period: number
  text: string
}

/**
 * Усі нотатки цього класу (чи вчителя) — за датою, потім за уроком.
 * Це і є «щоденник»: те, що записали, але ще не зробили.
 */
export function allNotes(classId: string): SavedNote[] {
  const prefix = `${classId}|`
  const out: SavedNote[] = []

  for (const [key, text] of Object.entries(read())) {
    if (!key.startsWith(prefix)) continue
    const [, date, period] = key.split('|')
    const n = Number(period)
    if (!date || !Number.isFinite(n)) continue
    out.push({ date, period: n, text })
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period)
}

/** Дати (`рррр-мм-дд`), у яких для цього класу є хоч одна нотатка. */
export function datesWithNotes(classId: string): Set<string> {
  return new Set(allNotes(classId).map((note) => note.date))
}
