import { describe, expect, it } from 'vitest'
import { ALERT_NONE, ALERT_RED, ALERT_YELLOW, alertStale, stateFor } from './alerts'
import { formatElapsed } from './clock'
import type { DisplayLesson } from './lessons'
import { resumeAfter } from './lessons'
import { liveState } from './live'
import { computeStatus } from './lessons'

const feed = {
  v: 1,
  at: '2026-09-22T10:31:00.000Z',
  regions: {
    '13': { level: 2, since: '2026-09-22T10:05:00.000Z' },
    '27': { level: 1 },
    '14': {},
  },
}

describe('стан тривоги з документа', () => {
  it('читає рівень і початок', () => {
    const state = stateFor(feed, '13', 1000)
    expect(state.level).toBe(ALERT_RED)
    expect(state.since).toBe(Date.parse('2026-09-22T10:05:00.000Z'))
  })

  it('регіону в документі немає — значить, тихо', () => {
    expect(stateFor(feed, '3', 1000)).toEqual({
      level: ALERT_NONE,
      since: null,
      where: null,
      checked: 1000,
    })
  })

  it('тривога в районах називає райони', () => {
    const part = {
      v: 1,
      at: feed.at,
      regions: {
        '13': { level: 1, scope: 'part', where: 'Калуський район' },
        '27': { level: 1 },
      },
    }
    expect(stateFor(part, '13', 1000).where).toBe('Калуський район')
    // Тривога по всій області уточнення не потребує — і не вигадує його.
    expect(stateFor(part, '27', 1000).where).toBeNull()
  })

  it('тривога без рівня — це все одно тривога', () => {
    // Поле нове, тривога стара: мовчати про неї не можна.
    expect(stateFor(feed, '14', 1000).level).toBe(ALERT_YELLOW)
  })

  it('чужий формат не видає себе за спокій', () => {
    expect(stateFor({ v: 99 }, '13', 1000)).toEqual({
      level: ALERT_NONE,
      since: null,
      where: null,
      checked: null,
    })
  })

  it('«не знаємо» — це не «немає»', () => {
    const fresh = stateFor(feed, '13', 1_000_000)
    expect(alertStale(fresh, 1_000_000)).toBe(false)
    expect(alertStale(fresh, 1_000_000 + 6 * 60 * 1000)).toBe(true)
    expect(alertStale({ level: 0, since: null, where: null, checked: null })).toBe(true)
  })
})

/** Три уроки поспіль: 3-й 10:00–10:45, 4-й 11:00–11:45, 5-й 12:00–12:45. */
const day: DisplayLesson[] = [
  { n: 3, period: 3, start: 600, end: 645, items: [{ subject: 'Хімія', room: '12' }] },
  { n: 4, period: 4, start: 660, end: 705, items: [{ subject: 'Математика' }] },
  { n: 5, period: 5, start: 720, end: 765, items: [{ subject: 'Історія' }] },
]

describe('на який урок повертатись після відбою', () => {
  it('відбій посеред уроку — іти на наступний', () => {
    expect(resumeAfter(day, 620)?.n).toBe(4)
  })

  it('відбій на початку уроку — теж на наступний', () => {
    expect(resumeAfter(day, 601)?.n).toBe(4)
  })

  it('відбій на перерві — на той, що зараз почнеться', () => {
    expect(resumeAfter(day, 650)?.n).toBe(4)
  })

  it('відбій до першого уроку — на перший', () => {
    expect(resumeAfter(day, 500)?.n).toBe(3)
  })

  it('після останнього уроку повертатись нема на що', () => {
    expect(resumeAfter(day, 800)).toBeNull()
  })

  it('гурток не урок — на нього не повертають', () => {
    const withClub: DisplayLesson[] = [
      ...day,
      { n: 0, period: -1, start: 1020, end: 1110, items: [{ subject: 'Футбол' }], club: 'г1' },
    ]
    expect(resumeAfter(withClub, 800)).toBeNull()
  })
})

describe('що показує екран блокування', () => {
  it('під час уроку — сам урок і кінець як межу відліку', () => {
    const state = liveState(computeStatus(day, 620), day)
    expect(state).toMatchObject({ headline: 'Зараз 3 урок', subject: 'Хімія', until: 645 })
  })

  it('на перерві — те, що буде далі', () => {
    const state = liveState(computeStatus(day, 650), day)
    expect(state).toMatchObject({ headline: 'Перерва', subject: 'Математика', until: 660 })
  })

  it('дрібним рядком — куди йти після дзвінка', () => {
    // Заради цього на активність і дивляться: «що зараз» людина й так
    // знає, а «куди після дзвінка» — ні.
    expect(liveState(computeStatus(day, 620), day)!.next).toBe('Далі: Математика · о 11:00')
    expect(liveState(computeStatus(day, 650), day)!.next).toBe('Далі: Історія · о 12:00')
    expect(liveState(computeStatus(day, 730), day)!.next).toBe('Далі нічого — це останній')
  })

  it('після уроків активності немає', () => {
    expect(liveState(computeStatus(day, 800))).toBeNull()
    expect(liveState(null)).toBeNull()
  })

  it('уночі теж немає — до першого уроку ще півдня', () => {
    // 03:00: формально «до першого уроку сім годин», і це правда, від
    // якої нікому не легше.
    expect(liveState(computeStatus(day, 180))).toBeNull()
    // 09:30 — за півгодини до першого; ось тепер уже варто.
    expect(liveState(computeStatus(day, 570))).toMatchObject({ headline: 'Перший урок' })
  })
})

describe('скільки вже триває', () => {
  it('до години — хвилини', () => {
    expect(formatElapsed(1)).toBe('1 хвилину')
    expect(formatElapsed(23)).toBe('23 хвилини')
    expect(formatElapsed(59)).toBe('59 хвилин')
  })

  it('до доби — години, без хвилин', () => {
    expect(formatElapsed(60)).toBe('1 годину')
    expect(formatElapsed(185)).toBe('3 години')
    expect(formatElapsed(23 * 60 + 59)).toBe('23 години')
  })

  it('далі — дні: «109 год 28 хв» ніхто не читає', () => {
    expect(formatElapsed(24 * 60)).toBe('1 день')
    expect(formatElapsed(109 * 60 + 28)).toBe('4 дні')
    expect(formatElapsed(30 * 24 * 60)).toBe('30 днів')
  })
})
