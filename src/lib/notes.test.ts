import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { allNotes, datesWithNotes, getNote, setNote } from './notes'

const KEY = 'rozklad:notes:v1'
const note = { classId: 'п2', date: '2026-09-28', period: 1 }
let data: Map<string, string>
let storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> }

beforeEach(() => {
  data = new Map()
  storage = {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value) }),
  }
  vi.stubGlobal('localStorage', storage)
})
afterEach(() => vi.unstubAllGlobals())

describe('особисті нотатки', () => {
  it('зберігає текст, прибирає зовнішні пробіли й переживає повторне читання', () => {
    expect(setNote(note, '  Вивчити вірш\nНа завтра  ')).toBe(true)
    expect(getNote(note)).toBe('Вивчити вірш\nНа завтра')
  })
  it('видаляє лише вибраний запис, зберігає нотатку іншого профілю', () => {
    setNote(note, 'ДЗ')
    setNote({ ...note, classId: 'п3' }, 'Інше ДЗ')
    expect(setNote(note, '   ')).toBe(true)
    expect(getNote(note)).toBe('')
    expect(getNote({ ...note, classId: 'п3' })).toBe('Інше ДЗ')
  })
  it('упорядковує за датою й уроком, нотатка на день перша', () => {
    setNote({ ...note, date: '2026-09-29' }, 'Завтра')
    setNote(note, 'Урок')
    setNote({ ...note, period: 0 }, 'Взяти форму')
    expect(allNotes('п2').map(({ text }) => text)).toEqual(['Взяти форму', 'Урок', 'Завтра'])
    expect([...datesWithNotes('п2')]).toEqual(['2026-09-28', '2026-09-29'])
  })
  it('не повідомляє про успіх, якщо місце скінчилося, і зберігає старий текст', () => {
    setNote(note, 'Старий текст')
    storage.setItem.mockImplementation(() => { throw new Error('QuotaExceededError') })
    expect(setNote(note, 'Новий текст')).toBe(false)
    expect(getNote(note)).toBe('Старий текст')
  })
  it('після помилки читання не перетирає решту нотаток', () => {
    storage.getItem.mockImplementation(() => { throw new Error('SecurityError') })
    expect(getNote(note)).toBe('')
    expect(allNotes('п2')).toEqual([])
    expect(setNote(note, 'Не загубити')).toBe(false)
    expect(storage.setItem).not.toHaveBeenCalled()
  })
  it.each(['{', 'null', '[]', '42', '"text"'])('не перетирає пошкоджений контейнер %s', (raw) => {
    data.set(KEY, raw)
    expect(allNotes('п2')).toEqual([])
    expect(setNote(note, 'Зберегти')).toBe(false)
    expect(data.get(KEY)).toBe(raw)
  })
  it('відкидає пошкоджені записи, але лишає справжні', () => {
    data.set(KEY, JSON.stringify({
      'п2|2026-09-28|1': 'Цілий запис',
      'п2|2026-09-28|2': { text: 'Не рядок' },
      'п2|2026-02-30|3': 'Не дата',
      'п2|2026-09-28|-1': 'Не урок',
      'п2|2026-09-28|1.5': 'Не урок',
      'п2|2026-09-28|4|extra': 'Не ключ',
    }))
    expect(allNotes('п2')).toEqual([{ date: note.date, period: 1, text: 'Цілий запис' }])
    expect(getNote({ ...note, period: 2 })).toBe('')
  })
  it('відхиляє неправильний ключ при записі', () => {
    expect(setNote({ ...note, date: '2026-02-30' }, 'Не дата')).toBe(false)
    expect(setNote({ ...note, classId: 'п|2' }, 'Не ключ')).toBe(false)
  })
})
