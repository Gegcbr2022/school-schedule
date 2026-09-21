import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { specialDayOn } from '../data/special'
import { addDays, dateKey, isoOf, parseDateKey, weekParity } from './clock'
import { lessonsOnly } from './profiles'
import { clubsOn, profileDay, profileName, profileSub, withClubs } from './profiles'
import { activeProfile, DEFAULT_PREFS, DEFAULT_PROFILE } from './prefs'
import type { Club, Prefs, Profile } from './prefs'

const date = (key: string) => parseDateKey(key)

async function widgets() {
  vi.resetModules()
  return import('./widgets')
}

function prefsWithProfile(profile: Profile, extras: Profile[] = []): Prefs {
  return {
    ...DEFAULT_PREFS,
    profiles: [profile, ...extras],
    activeId: profile.id,
  }
}

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('віджетний знімок', () => {
  it('будує сім календарних днів із переходом через місяць, вихідними й особливими днями', async () => {
    const { buildWidgetSnapshot } = await widgets()
    const today = date('2026-08-31')
    const snapshot = buildWidgetSnapshot(DEFAULT_PREFS, today, 600)

    expect(snapshot.days.map((day) => day.date)).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ])
    expect(snapshot.days).toHaveLength(7)
    expect(specialDayOn(today)?.noLessons).toBe(true)
    expect(snapshot.days[0].lessons).toEqual([])
    expect(snapshot.days[1].lessons).toEqual([])
    expect(snapshot.days[5].lessons).toEqual([])
    expect(snapshot.days[6].lessons).toEqual([])
    expect(snapshot.days[0].schoolCount).toBe(0)
    expect(snapshot.days[1].schoolCount).toBe(0)
  })

  it('отримує парність тижня для кожного дня з фактичної дати й профілю', async () => {
    const { buildWidgetSnapshot } = await widgets()
    const today = date('2026-09-07')
    const snapshot = buildWidgetSnapshot(DEFAULT_PREFS, today, 600)
    const profile = activeProfile(DEFAULT_PREFS)

    expect(snapshot.date).toBe(snapshot.days[0].date)
    expect({ date: snapshot.date, dayName: snapshot.dayName, schoolCount: snapshot.schoolCount, lessons: snapshot.lessons })
      .toEqual(snapshot.days[0])

    for (const [offset, widgetDay] of snapshot.days.entries()) {
      const current = addDays(today, offset)
      const iso = isoOf(current)
      const expected = iso > 5 || specialDayOn(current)?.noLessons
        ? []
        : withClubs(
            profileDay(profile, iso - 1, weekParity(addDays(current, 1 - iso)), 'my'),
            clubsOn(profile, iso, weekParity(addDays(current, 1 - iso))),
          )

      expect(widgetDay.date).toBe(dateKey(current))
      expect(widgetDay.schoolCount).toBe(lessonsOnly(expected).length)
      expect(widgetDay.lessons.map(({ n, period, start, end }) => ({ n, period, start, end }))).toEqual(
        expected.map(({ n, period, start, end }) => ({ n, period, start, end })),
      )
    }

    const nextWeek = buildWidgetSnapshot(DEFAULT_PREFS, date('2026-09-14'), 600)
    expect(nextWeek.days[0].lessons.map((lesson) => lesson.period)).toEqual(
      profileDay(profile, 0, weekParity(date('2026-09-14')), 'my').map((lesson) => lesson.period),
    )
  })

  it('вибирає активний профіль і його метадані', async () => {
    const { buildWidgetSnapshot } = await widgets()
    const inactive = { ...DEFAULT_PROFILE, id: 'inactive', name: 'Неактивний' }
    const active = { ...DEFAULT_PROFILE, id: 'active', name: 'Моя дитина', classId: '5а' }
    const prefs = prefsWithProfile(inactive, [active])
    prefs.activeId = active.id

    const snapshot = buildWidgetSnapshot(prefs, date('2026-09-07'), 600)
    expect(snapshot.profileName).toBe(profileName(active))
    expect(snapshot.profileSub).toBe(profileSub(active))
    expect(snapshot.profileName).not.toBe(profileName(inactive))
  })
})

describe('синхронізація віджета', () => {
  it('не надсилає повторно лише через зміну часу або статусу, але реагує на день, профіль і розклад', async () => {
    const { syncWidgets } = await widgets()
    const posted: unknown[] = []
    vi.stubGlobal('window', { webkit: { messageHandlers: { widgets: { postMessage: (value: unknown) => posted.push(value) } } } })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T05:00:00.000Z'))

    const today = date('2026-09-07')
    syncWidgets(DEFAULT_PREFS, today, 479)
    expect(posted).toHaveLength(1)

    vi.setSystemTime(new Date('2026-09-07T05:00:01.000Z'))
    syncWidgets(DEFAULT_PREFS, today, 480)
    expect(posted).toHaveLength(1)

    syncWidgets(DEFAULT_PREFS, addDays(today, 1), 480)
    expect(posted).toHaveLength(2)

    const renamed = { ...DEFAULT_PROFILE, name: 'Новий підпис' }
    syncWidgets(prefsWithProfile(renamed), addDays(today, 1), 480)
    expect(posted).toHaveLength(3)

    const club: Club = { id: 'club', name: 'Гурток', days: [2], start: 1000, end: 1010 }
    const scheduled = { ...renamed, clubs: [club] }
    syncWidgets(prefsWithProfile(scheduled), addDays(today, 1), 480)
    expect(posted).toHaveLength(4)
  })

  it('повторює надсилання після помилки bridge і не запам’ятовує невдалий знімок', async () => {
    const { syncWidgets } = await widgets()
    let attempts = 0
    vi.stubGlobal('window', {
      webkit: {
        messageHandlers: {
          widgets: {
            postMessage: () => {
              attempts += 1
              throw new Error('bridge unavailable')
            },
          },
        },
      },
    })

    expect(() => syncWidgets(DEFAULT_PREFS, date('2026-09-07'), 600)).toThrow('bridge unavailable')
    expect(() => syncWidgets(DEFAULT_PREFS, date('2026-09-07'), 600)).toThrow('bridge unavailable')
    expect(attempts).toBe(2)
  })
})
