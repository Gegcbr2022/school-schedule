import { describe, expect, it } from 'vitest'
import { parseDateKey } from './clock'
import { buildNotifications } from './notifications'
import type { Club, Prefs, Profile } from './prefs'
import { DEFAULT_ALERTS, DEFAULT_GROUPS, DEFAULT_NOTIFICATIONS } from './prefs'
import { clubRunsOn, clubsOn, withClubs } from './profiles'

const football: Club = {
  id: 'г1',
  name: 'Футбол',
  days: [2],
  start: 17 * 60,
  end: 18 * 60 + 30,
  travel: 30,
  place: 'ДЮСШ',
}

const profile: Profile = {
  ...DEFAULT_GROUPS,
  id: '10б',
  name: '',
  classId: '10б',
  teacherId: null,
  clubs: [football],
}

function prefsWith(clubs: Club[]): Prefs {
  return {
    role: 'student',
    activeId: '10б',
    profiles: [{ ...profile, clubs }],
    notifications: { ...DEFAULT_NOTIFICATIONS, enabled: true },
    alerts: DEFAULT_ALERTS,
    live: true,
  }
}

/** Вівторок. */
const TUE = parseDateKey('2026-10-06')

describe('коли гурток буває', () => {
  it('поза сезоном його немає', () => {
    const autumn = { ...football, from: '2026-10-01', to: '2027-05-25' }
    expect(clubRunsOn(autumn, TUE)).toBe(true)
    expect(clubRunsOn(autumn, parseDateKey('2026-09-29'))).toBe(false)
    expect(clubRunsOn(autumn, parseDateKey('2027-06-01'))).toBe(false)
  })

  it('межі сезону входять у нього', () => {
    const club = { ...football, from: '2026-10-06', to: '2026-10-06' }
    expect(clubRunsOn(club, TUE)).toBe(true)
  })

  it('скасоване заняття не показується', () => {
    const club = { ...football, skip: ['2026-10-06'] }
    expect(clubRunsOn(club, TUE)).toBe(false)
    expect(clubRunsOn(club, parseDateKey('2026-10-13'))).toBe(true)
  })

  it('без дати показуємо все, що взагалі буває', () => {
    const club = { ...football, skip: ['2026-10-06'] }
    const list = clubsOn({ ...profile, clubs: [club] }, 2, 1)
    expect(list).toHaveLength(1)
  })

  it('з датою скасоване зникає', () => {
    const club = { ...football, skip: ['2026-10-06'] }
    expect(clubsOn({ ...profile, clubs: [club] }, 2, 1, TUE)).toEqual([])
  })
})

describe('гурток у стрічці дня', () => {
  it('несе свій відтінок', () => {
    const rows = withClubs([], [{ ...football, tone: 3 }])
    expect(rows[0].tone).toBe(3)
  })
})

describe('нагадування про гуртки', () => {
  const at = (items: ReturnType<typeof buildNotifications>, id: string) =>
    items.find((item) => item.id.startsWith(id))

  it('нагадує вийти з дому, а не тоді, коли заняття вже почалось', () => {
    // Вийти о 16:30: початок 17:00 мінус 30 хвилин дороги.
    const items = buildNotifications(prefsWith([football]), TUE, 8 * 60)
    const leave = at(items, 'leave:')
    expect(leave).toBeDefined()
    expect(leave!.hour).toBe(16)
    expect(leave!.minute).toBe(30)
  })

  it('без дороги виходити нікуди — і нагадування немає', () => {
    const items = buildNotifications(prefsWith([{ ...football, travel: undefined }]), TUE, 8 * 60)
    expect(at(items, 'leave:')).toBeUndefined()
  })

  it('нагадування про вихід можна вимкнути в самому гуртку', () => {
    const items = buildNotifications(prefsWith([{ ...football, leaveAlert: false }]), TUE, 8 * 60)
    expect(at(items, 'leave:')).toBeUndefined()
  })

  it('своє випередження головніше за загальне', () => {
    const items = buildNotifications(prefsWith([{ ...football, lead: 45 }]), TUE, 8 * 60)
    const start = items.find((item) => item.id.startsWith('start:') && item.id.includes('club:'))
    expect(start).toBeDefined()
    // 17:00 мінус 45 хвилин.
    expect(start!.hour).toBe(16)
    expect(start!.minute).toBe(15)
  })

  it('про оплату нагадує за три дні й у сам день', () => {
    const items = buildNotifications(prefsWith([{ ...football, paidUntil: '2026-10-09' }]), TUE, 8 * 60)
    const pays = items.filter((item) => item.id.startsWith('pay:'))
    expect(pays.map((p) => `${p.month}-${p.day} ${p.hour}:${p.minute}`)).toEqual([
      '10-6 9:0',
      '10-9 9:0',
    ])
  })

  it('скасованого заняття в нагадуваннях немає', () => {
    const items = buildNotifications(prefsWith([{ ...football, skip: ['2026-10-06'] }]), TUE, 8 * 60)
    expect(items.filter((item) => item.id.includes('2026-10-06') && item.id.includes('г1'))).toEqual(
      [],
    )
  })
})

describe('кілька дітей на одному телефоні', () => {
  /** У кожної дитини свій гурток — і в обох він під ключем «г1». */
  const family: Prefs = {
    role: 'parent',
    activeId: 'п1',
    profiles: [
      { ...profile, id: 'п1', name: 'Марійка', clubs: [football] },
      {
        ...profile,
        id: 'п2',
        name: 'Петрик',
        clubs: [{ ...football, name: 'Плавання', start: 18 * 60, end: 19 * 60, travel: 15 }],
      },
    ],
    notifications: { ...DEFAULT_NOTIFICATIONS, enabled: true },
    alerts: DEFAULT_ALERTS,
    live: true,
  }

  const items = buildNotifications(family, TUE, 8 * 60)

  it('нагадування дітей не з\'їдають одне одного', () => {
    // Ключі гуртків у профілів однакові («г1»), тож без імені профілю
    // в ідентифікаторі одне нагадування мовчки замінило б інше.
    const ids = items.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('у кожної дитини свій час виходу', () => {
    const leaves = items.filter((item) => item.id.startsWith('leave:'))
    expect(leaves).toHaveLength(2)
    expect(leaves.map((l) => `${l.hour}:${String(l.minute).padStart(2, '0')}`).sort()).toEqual([
      '16:30', // Марійка: 17:00 мінус 30 хв дороги
      '17:45', // Петрик: 18:00 мінус 15 хв
    ])
  })

  it('з тексту видно, про кого мова', () => {
    const leaves = items.filter((item) => item.id.startsWith('leave:'))
    expect(leaves.some((l) => l.body.includes('Марійка'))).toBe(true)
    expect(leaves.some((l) => l.body.includes('Петрик'))).toBe(true)
  })

  it('оплата теж рахується окремо для кожної дитини', () => {
    const paid = buildNotifications(
      {
        ...family,
        profiles: family.profiles.map((p) => ({
          ...p,
          clubs: p.clubs.map((c) => ({ ...c, paidUntil: '2026-10-09' })),
        })),
      },
      TUE,
      8 * 60,
    ).filter((item) => item.id.startsWith('pay:'))
    // Двоє дітей × (за три дні + у сам день).
    expect(paid).toHaveLength(4)
    expect(new Set(paid.map((p) => p.id)).size).toBe(4)
  })

  it('більше ніж 64 нагадування iOS не візьме — і ми не шлемо', () => {
    // Троє дітей за чотири тижні дають кількасот записів; система
    // тримає лише 64 найближчі, тож зайве відрізаємо самі, а не
    // покладаємось на те, що вона відкине «якісь».
    const three: Prefs = {
      ...family,
      profiles: [...family.profiles, { ...profile, id: 'п3', name: 'Оля', clubs: [] }],
    }
    const all = buildNotifications(three, TUE, 8 * 60)
    expect(all.length).toBeLessThanOrEqual(64)
    // І це найближчі за часом, а не випадкові.
    const at = (i: (typeof all)[number]) =>
      ((i.year * 100 + i.month) * 100 + i.day) * 10000 + i.hour * 100 + i.minute
    const times = all.map(at)
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })
})
