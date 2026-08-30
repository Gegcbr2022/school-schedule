import { describe, expect, it } from 'vitest'
import { BELLS, LESSON_NUMBERS, SUBJECTS, WEEK } from '../data/schedule'
import { addDays, formatDuration, kyivNow, plural, weekParity } from './clock'
import {
  buildDay,
  computeStatus,
  dayById,
  daysUntil,
  finishedCount,
  nextSchoolDay,
  offWeekNote,
} from './lessons'
import type { Prefs } from './prefs'

const G1: Prefs = { classGroup: '1', language: 'de', english: 'А', gender: 'boys' }
const G2: Prefs = { classGroup: '2', language: 'fr', english: 'Б', gender: 'girls' }
const NO_GENDER: Prefs = { ...G1, gender: null }

const at = (h: number, m: number) => h * 60 + m
const subjects = (lessons: { items: { subject: string }[] }[]) =>
  lessons.map((l) => l.items.map((i) => i.subject).join(' / '))

describe('дзвінки', () => {
  it('усі уроки по 40 хвилин', () => {
    for (const n of LESSON_NUMBERS) {
      expect(BELLS[n].end - BELLS[n].start).toBe(40)
    }
  })

  it('ідуть по порядку і не накладаються', () => {
    for (let i = 1; i < LESSON_NUMBERS.length; i += 1) {
      const prev = BELLS[LESSON_NUMBERS[i - 1]]
      const next = BELLS[LESSON_NUMBERS[i]]
      expect(next.start).toBeGreaterThan(prev.end)
    }
  })

  it('перший дзвінок о 08:00, восьмий урок закінчується о 15:20', () => {
    expect(BELLS[1].start).toBe(at(8, 0))
    expect(BELLS[8].end).toBe(at(15, 20))
  })
})

describe('київський час', () => {
  it('не залежить від годинника пристрою (літній час, +3)', () => {
    const t = kyivNow(new Date('2026-09-01T05:30:00Z'))
    expect(t).toMatchObject({ year: 2026, month: 9, day: 1, iso: 2 })
    expect(t.minutes).toBeCloseTo(at(8, 30), 5)
  })

  it('враховує зимовий час (+2)', () => {
    const t = kyivNow(new Date('2026-01-15T06:00:00Z'))
    expect(t).toMatchObject({ year: 2026, month: 1, day: 15, iso: 4 })
    expect(t.minutes).toBeCloseTo(at(8, 0), 5)
  })

  it('опівночі за Києвом день уже новий, навіть якщо в UTC ще вчора', () => {
    const t = kyivNow(new Date('2026-09-01T21:30:00Z')) // 00:30 2 вересня в Києві
    expect(t).toMatchObject({ month: 9, day: 2 })
    expect(t.minutes).toBeCloseTo(30, 5)
  })
})

describe('парність тижня', () => {
  it('тиждень із 1 вересня — перший', () => {
    expect(weekParity({ year: 2026, month: 9, day: 1 })).toBe(1)
    // 31 серпня — понеділок того ж тижня.
    expect(weekParity({ year: 2026, month: 8, day: 31 })).toBe(1)
  })

  it('наступний тиждень — другий', () => {
    expect(weekParity({ year: 2026, month: 9, day: 7 })).toBe(2)
    expect(weekParity({ year: 2026, month: 9, day: 13 })).toBe(2)
  })

  it('далі чергується', () => {
    expect(weekParity({ year: 2026, month: 9, day: 14 })).toBe(1)
    expect(weekParity({ year: 2026, month: 9, day: 21 })).toBe(2)
  })

  it('1 вересня 2025 теж перший тиждень', () => {
    expect(weekParity({ year: 2025, month: 9, day: 1 })).toBe(1)
  })

  it('після Нового року відлік не збивається', () => {
    // 4 січня 2027 — понеділок; від 31.08.2026 це 18-й тиждень (індекс 18).
    expect(weekParity({ year: 2027, month: 1, day: 4 })).toBe(1)
  })
})

describe('групи', () => {
  it('понеділок, 4 урок: у групах різні предмети', () => {
    const mon = dayById('mon')
    const first = buildDay(mon, G1, 'my', 1).find((l) => l.n === 4)
    const second = buildDay(mon, G2, 'my', 1).find((l) => l.n === 4)
    expect(first?.items[0].subject).toBe(SUBJECTS.ум)
    expect(second?.items[0].subject).toBe(SUBJECTS.к)
  })

  it('середа, 3 урок: друга іноземна за вибором', () => {
    const wed = dayById('wed')
    expect(buildDay(wed, G1, 'my', 1).find((l) => l.n === 3)?.items[0].subject).toBe(SUBJECTS.нм)
    expect(buildDay(wed, G2, 'my', 1).find((l) => l.n === 3)?.items[0].subject).toBe(SUBJECTS.фм)
  })

  it('повний розклад показує всі варіанти одразу', () => {
    const wed = buildDay(dayById('wed'), G1, 'full', 1).find((l) => l.n === 1)
    expect(subjects([wed!])[0]).toBe(`${SUBJECTS.і} / ${SUBJECTS.ум}`)
    expect(wed?.items.map((i) => i.who)).toEqual(['1 група', '2 група'])
  })

  it('англійська однакова для всіх підгруп, змінюється лише підпис', () => {
    const mon = buildDay(dayById('mon'), G2, 'my', 1).find((l) => l.n === 5)
    expect(mon?.items[0].subject).toBe(SUBJECTS.ам)
    expect(mon?.note).toBe('Підгрупа Б')
  })
})

describe('хімія через тиждень', () => {
  const wed = dayById('wed')

  it('у 2 групи є лише на другому тижні', () => {
    expect(buildDay(wed, G2, 'my', 1).some((l) => l.n === 8)).toBe(false)
    expect(buildDay(wed, G2, 'my', 2).some((l) => l.n === 8)).toBe(true)
  })

  it('у 1 групи немає ніколи', () => {
    expect(buildDay(wed, G1, 'my', 1).some((l) => l.n === 8)).toBe(false)
    expect(buildDay(wed, G1, 'my', 2).some((l) => l.n === 8)).toBe(false)
  })

  it('у повному розкладі видно завжди, з підписом про тиждень', () => {
    const off = buildDay(wed, G1, 'full', 1).find((l) => l.n === 8)
    const on = buildDay(wed, G1, 'full', 2).find((l) => l.n === 8)
    expect(off?.note).toContain('Наступного')
    expect(on?.note).toContain('Цього')
  })

  it('пояснення показуємо лише тому, у кого урок зник', () => {
    expect(offWeekNote(wed, G2, 1)).toContain(SUBJECTS.х)
    expect(offWeekNote(wed, G2, 2)).toBeNull()
    expect(offWeekNote(wed, G1, 1)).toBeNull()
  })
})

describe('кабінети', () => {
  it('беруться з розкладу, а не вигадуються', () => {
    const mon = buildDay(dayById('mon'), G1, 'my', 1)
    expect(mon.find((l) => l.n === 1)?.items[0].room).toBeUndefined()
    expect(mon.find((l) => l.n === 2)?.items[0].room).toBe('12')
    expect(mon.find((l) => l.n === 4)?.items[0].room).toBe('16')
  })

  it('у другої групи свій кабінет, у першої свій', () => {
    const tue = (p: Prefs) => buildDay(dayById('tue'), p, 'my', 1).find((l) => l.n === 3)
    expect(tue(G1)?.items[0].room).toBe('17')
    expect(tue(G2)?.items[0].room).toBe('15')
  })

  it('на фізкультурі зал залежить від поділу', () => {
    const mon = (p: Prefs) => buildDay(dayById('mon'), p, 'my', 1).find((l) => l.n === 7)
    expect(mon(G1)?.items[0].room).toBe('8')
    expect(mon(G2)?.items[0].room).toBe('13')
    // Поділ не вказаний — кабінет не вигадуємо.
    expect(mon(NO_GENDER)?.items[0].room).toBeUndefined()
  })

  it('якщо номера немає в розкладі — немає і в даних', () => {
    // Середа, 5 урок: у дівчат замість номера буквене позначення.
    const wed = (p: Prefs) => buildDay(dayById('wed'), p, 'my', 1).find((l) => l.n === 5)
    expect(wed(G1)?.items[0].room).toBe('25')
    expect(wed(G2)?.items[0].room).toBeUndefined()
  })

  it('повний розклад показує обидва зали окремими рядками', () => {
    const mon = buildDay(dayById('mon'), G1, 'full', 1).find((l) => l.n === 7)
    expect(mon?.items).toEqual([
      { subject: SUBJECTS.фк, who: 'Хлопці', room: '8' },
      { subject: SUBJECTS.фк, who: 'Дівчата', room: '13' },
    ])
  })
})

describe('що зараз', () => {
  const lessons = buildDay(dayById('mon'), G1, 'my', 1)

  it('до першого дзвінка', () => {
    const s = computeStatus(lessons, at(7, 30))
    expect(s.kind).toBe('before')
    if (s.kind === 'before') {
      expect(s.inMin).toBe(30)
      expect(s.next.n).toBe(1)
    }
  })

  it('під час уроку рахує, скільки лишилось', () => {
    const s = computeStatus(lessons, at(8, 22))
    expect(s.kind).toBe('lesson')
    if (s.kind === 'lesson') {
      expect(s.current.n).toBe(1)
      expect(s.leftMin).toBe(18)
      expect(s.progress).toBeCloseTo(22 / 40, 5)
      expect(s.next?.n).toBe(2)
    }
  })

  it('рівно на дзвінку урок уже скінчився', () => {
    const s = computeStatus(lessons, at(8, 40))
    expect(s.kind).toBe('break')
    if (s.kind === 'break') {
      expect(s.next.n).toBe(2)
      expect(s.inMin).toBe(15)
    }
  })

  it('рівно на початку урок уже почався', () => {
    const s = computeStatus(lessons, at(8, 55))
    expect(s.kind).toBe('lesson')
    if (s.kind === 'lesson') {
      expect(s.current.n).toBe(2)
      expect(s.progress).toBe(0)
    }
  })

  it('після останнього уроку — на сьогодні все', () => {
    const s = computeStatus(lessons, at(14, 21))
    expect(s.kind).toBe('done')
    if (s.kind === 'done') expect(s.total).toBe(lessons.length)
  })

  it('порожній день не ламає логіку', () => {
    expect(computeStatus([], at(10, 0)).kind).toBe('empty')
  })

  it('лічильник пройдених уроків', () => {
    expect(finishedCount(lessons, at(7, 0))).toBe(0)
    expect(finishedCount(lessons, at(8, 41))).toBe(1)
    expect(finishedCount(lessons, at(23, 0))).toBe(lessons.length)
  })

  it('секунди не збивають відлік — округлюємо вгору', () => {
    const s = computeStatus(lessons, at(8, 39) + 0.5)
    if (s.kind === 'lesson') expect(s.leftMin).toBe(1)
  })
})

describe('перехід між днями', () => {
  it('після п’ятниці — понеділок', () => {
    expect(nextSchoolDay(5).id).toBe('mon')
  })

  it('на вихідних теж понеділок', () => {
    expect(nextSchoolDay(6).id).toBe('mon')
    expect(nextSchoolDay(7).id).toBe('mon')
  })

  it('серед тижня — наступний день', () => {
    expect(nextSchoolDay(3).id).toBe('thu')
  })

  it('скільки діб чекати', () => {
    expect(daysUntil(6, 1)).toBe(2) // субота → понеділок
    expect(daysUntil(7, 1)).toBe(1) // неділя → понеділок
    expect(daysUntil(5, 1)).toBe(3) // п’ятниця → понеділок
    expect(daysUntil(3, 4)).toBe(1)
  })

  it('додавання днів переходить через межу місяця', () => {
    expect(addDays({ year: 2026, month: 8, day: 30 }, 2)).toEqual({
      year: 2026,
      month: 9,
      day: 1,
    })
  })
})

describe('розклад загалом', () => {
  it('у кожному дні уроки йдуть за зростанням номера', () => {
    for (const day of WEEK) {
      const numbers = day.lessons.map((l) => l.n)
      expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
      expect(new Set(numbers).size).toBe(numbers.length)
    }
  })

  it('кожен учень має хоч один урок у кожен навчальний день', () => {
    for (const day of WEEK) {
      for (const prefs of [G1, G2]) {
        for (const week of [1, 2] as const) {
          expect(buildDay(day, prefs, 'my', week).length).toBeGreaterThan(0)
        }
      }
    }
  })
})

describe('тексти', () => {
  it('українська множина', () => {
    expect(plural(1, ['урок', 'уроки', 'уроків'])).toBe('урок')
    expect(plural(3, ['урок', 'уроки', 'уроків'])).toBe('уроки')
    expect(plural(5, ['урок', 'уроки', 'уроків'])).toBe('уроків')
    expect(plural(11, ['урок', 'уроки', 'уроків'])).toBe('уроків')
    expect(plural(21, ['урок', 'уроки', 'уроків'])).toBe('урок')
  })

  it('тривалість', () => {
    expect(formatDuration(18)).toBe('18 хв')
    expect(formatDuration(60)).toBe('1 год')
    expect(formatDuration(95)).toBe('1 год 35 хв')
    expect(formatDuration(0.2)).toBe('1 хв')
  })
})
