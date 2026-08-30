import { beforeEach, describe, expect, it } from 'vitest'
import type { Period } from '../data/schedule'
import { BELLS, GROUP_DIM, PERIODS, SUBJECTS, subjectName } from '../data/schedule'
import { TIMETABLE } from '../data/timetable'
import { addDays, formatDuration, kyivNow, plural, weekParity } from './clock'
import {
  buildDay,
  classById,
  classesByGrade,
  computeStatus,
  daysUntil,
  dimensionsOf,
  finishedCount,
  nextSchoolIso,
  offWeekNote,
  roomLabel,
} from './lessons'
import type { Prefs } from './prefs'
import { loadPrefs, savePrefs } from './prefs'

const at = (h: number, m: number) => h * 60 + m

const G1: Prefs = { classId: '10б', classGroup: '1', language: 'н', english: 'а', gender: 'х' }
const G2: Prefs = { classId: '10б', classGroup: '2', language: 'ф', english: 'б', gender: 'д' }
const NO_GENDER: Prefs = { ...G1, gender: null }

const TEN_B = classById('10б')!
const MON = 0
const TUE = 1
const WED = 2
const FRI = 4

const day = (prefs: Prefs, index: number, week: 1 | 2 = 1, mode: 'my' | 'full' = 'my') =>
  buildDay(TEN_B, index, prefs, mode, week)

const at10b = (prefs: Prefs, index: number, period: number, week: 1 | 2 = 1) =>
  day(prefs, index, week).find((l) => l.period === period)

describe('дзвінки', () => {
  it('усі дванадцять уроків по 40 хвилин', () => {
    for (const p of PERIODS) expect(BELLS[p].end - BELLS[p].start).toBe(40)
  })

  it('ідуть по порядку і не накладаються', () => {
    for (let i = 1; i < PERIODS.length; i += 1) {
      expect(BELLS[PERIODS[i]].start).toBeGreaterThan(BELLS[PERIODS[i - 1]].end)
    }
  })

  it('перша зміна починається о 08:00, друга — о 13:40', () => {
    expect(BELLS[1].start).toBe(at(8, 0))
    expect(BELLS[6].end).toBe(at(13, 25))
    expect(BELLS[7].start).toBe(at(13, 40))
    expect(BELLS[12].end).toBe(at(18, 45))
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
    const t = kyivNow(new Date('2026-09-01T21:30:00Z'))
    expect(t).toMatchObject({ month: 9, day: 2 })
    expect(t.minutes).toBeCloseTo(30, 5)
  })
})

describe('парність тижня', () => {
  it('тиждень із 1 вересня — перший', () => {
    expect(weekParity({ year: 2026, month: 9, day: 1 })).toBe(1)
    expect(weekParity({ year: 2026, month: 8, day: 31 })).toBe(1)
  })

  it('далі чергується', () => {
    expect(weekParity({ year: 2026, month: 9, day: 7 })).toBe(2)
    expect(weekParity({ year: 2026, month: 9, day: 14 })).toBe(1)
    expect(weekParity({ year: 2026, month: 9, day: 21 })).toBe(2)
  })

  it('після Нового року відлік не збивається', () => {
    expect(weekParity({ year: 2027, month: 1, day: 4 })).toBe(1)
  })
})

describe('розклад усієї школи', () => {
  it('усі класи з 4 по 11', () => {
    const grades = classesByGrade().map((g) => g.grade)
    expect(grades).toEqual([4, 5, 6, 7, 8, 9, 10, 11])
    expect(TIMETABLE).toHaveLength(24)
  })

  it('у кожного класу п’ять днів і хоч один урок', () => {
    for (const cls of TIMETABLE) {
      expect(cls.days).toHaveLength(5)
      expect(cls.days.flat().length).toBeGreaterThan(0)
    }
  })

  it('кожен період має дзвінок і не повторюється в межах дня', () => {
    for (const cls of TIMETABLE) {
      for (const lessons of cls.days) {
        const periods = lessons.map((l) => l.p)
        expect(periods).toEqual([...periods].sort((a, b) => a - b))
        expect(new Set(periods).size).toBe(periods.length)
        for (const p of periods) expect(BELLS[p as Period]).toBeDefined()
      }
    }
  })

  it('кожен ключ групи належить якомусь поділу', () => {
    for (const cls of TIMETABLE) {
      for (const cell of cls.days.flat().flatMap((l) => l.c)) {
        if (cell.g) expect(GROUP_DIM[cell.g]).toBeDefined()
      }
    }
  })

  it('кожен учень бачить хоч один урок у будь-який день і тиждень', () => {
    for (const cls of TIMETABLE) {
      const prefs: Prefs = { ...G1, classId: cls.id }
      for (let d = 0; d < 5; d += 1) {
        if (cls.days[d].length === 0) continue
        for (const week of [1, 2] as const) {
          expect(buildDay(cls, d, prefs, 'my', week).length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('друга зміна справді починається по обіді', () => {
    const fifth = classById('5а')!
    const first = buildDay(fifth, 1, { ...G1, classId: '5а' }, 'my', 1)[0]
    expect(first.start).toBeGreaterThanOrEqual(at(12, 45))
  })

  it('уроки нумеруються по порядку дня, а не за періодом', () => {
    const fifth = classById('5а')!
    const lessons = buildDay(fifth, 1, { ...G1, classId: '5а' }, 'my', 1)
    expect(lessons.map((l) => l.n)).toEqual(lessons.map((_, i) => i + 1))
    expect(lessons[0].period).toBeGreaterThan(1)
  })
})

describe('предмети', () => {
  it('відомі скорочення розшифровуються', () => {
    expect(subjectName('М')).toBe('Математика')
    expect(subjectName('фк')).toBe('Фізична культура')
  })

  it('невідоме скорочення показуємо як є, а не вигадуємо', () => {
    for (const code of ['нр', 'мпЗ', 'тфв', 'да', 'п']) {
      expect(SUBJECTS[code]).toBeUndefined()
      expect(subjectName(code)).toBe(code)
    }
  })

  it('велика М — математика, мала м — мистецтво', () => {
    expect(subjectName('М')).toBe('Математика')
    expect(subjectName('м')).toBe('Мистецтво')
  })

  it('усі розшифровані скорочення справді трапляються в розкладі', () => {
    const used = new Set(TIMETABLE.flatMap((c) => c.days.flat().flatMap((l) => l.c.map((x) => x.s))))
    for (const code of Object.keys(SUBJECTS)) expect(used.has(code)).toBe(true)
  })
})

describe('кабінети', () => {
  it('числові підписуємо, літерні лишаємо як у розкладі', () => {
    expect(roomLabel('12')).toBe('каб. 12')
    expect(roomLabel('сз')).toBe('сз')
    expect(roomLabel(undefined)).toBeNull()
  })

  it('10-Б: кабінети з офіційного розкладу', () => {
    expect(at10b(G1, MON, 1)?.items[0].room).toBeUndefined()
    expect(at10b(G1, MON, 2)?.items[0].room).toBe('12')
    expect(at10b(G1, MON, 3)?.items[0].room).toBe('19')
    expect(at10b(G1, MON, 6)?.items[0].room).toBe('6')
    expect(at10b(G1, TUE, 1)?.items[0].room).toBe('9')
  })

  it('10-Б: фізкультура — свій зал у кожного поділу', () => {
    expect(at10b(G1, MON, 7)?.items[0].room).toBe('8')
    expect(at10b(G2, MON, 7)?.items[0].room).toBe('тз')
    expect(at10b(G1, TUE, 8)?.items[0].room).toBe('2')
    expect(at10b(G2, TUE, 8)?.items[0].room).toBe('тз')
    expect(at10b(G1, WED, 5)?.items[0].room).toBe('25')
    expect(at10b(G2, WED, 5)?.items[0].room).toBe('сз')
  })

  it('поділ не вказаний — зал не вигадуємо', () => {
    expect(at10b(NO_GENDER, MON, 7)?.items[0].room).toBeUndefined()
    expect(at10b(NO_GENDER, MON, 7)?.items[0].subject).toBe('Фізична культура')
  })
})

describe('групи 10-Б', () => {
  it('понеділок, 4 урок: у групах різні предмети', () => {
    expect(at10b(G1, MON, 4)?.items[0].subject).toBe('Українська мова')
    expect(at10b(G2, MON, 4)?.items[0].subject).toBe('Країнознавство')
  })

  it('друга іноземна за вибором', () => {
    expect(at10b(G1, WED, 3)?.items[0].subject).toBe('Німецька мова')
    expect(at10b(G2, WED, 3)?.items[0].subject).toBe('Французька мова')
  })

  it('вчителі підказують, яка група твоя', () => {
    expect(at10b(G1, MON, 4)?.items[0].teacher).toBe('Желяк')
    expect(at10b(G2, TUE, 5)?.items[0].teacher).toBe('Драгомирецька')
    expect(at10b({ ...G1, english: 'а' }, MON, 5)?.items[0].teacher).toBe('Андрішак')
    expect(at10b({ ...G1, english: 'б' }, MON, 5)?.items[0].teacher).toBe('Пташник')
    expect(at10b({ ...G1, english: 'в' }, MON, 5)?.items[0].teacher).toBe('Горін')
  })

  it('повний розклад показує всі варіанти з підписами', () => {
    const lesson = day(G1, MON, 1, 'full').find((l) => l.period === 4)
    expect(lesson?.items.map((i) => i.who)).toEqual(['1 група', '2 група'])
    expect(lesson?.items.map((i) => i.subject)).toEqual([
      'Українська мова',
      'Країнознавство',
    ])
  })
})

describe('чергування по тижнях', () => {
  it('середа, 2 урок: перший тиждень географія, другий інформатика', () => {
    expect(at10b(G1, WED, 2, 1)?.items[0].subject).toBe('Географія')
    expect(at10b(G1, WED, 2, 2)?.items[0].subject).toBe('Інформатика')
  })

  it('однаково для обох навчальних груп — це не поділ класу', () => {
    expect(at10b(G2, WED, 2, 1)?.items[0].subject).toBe('Географія')
    expect(at10b(G2, WED, 2, 2)?.items[0].subject).toBe('Інформатика')
  })

  it('кабінет свій у кожного тижня', () => {
    expect(at10b(G1, WED, 2, 1)?.items[0].room).toBe('1')
    expect(at10b(G1, WED, 2, 2)?.items[0].room).toBe('19')
  })

  it('урок є завжди — на відміну від хімії', () => {
    expect(at10b(G1, WED, 2, 1)).toBeDefined()
    expect(at10b(G1, WED, 2, 2)).toBeDefined()
  })

  it('хімія 8-м уроком: лише 2 група і лише другий тиждень', () => {
    expect(at10b(G2, WED, 8, 1)).toBeUndefined()
    expect(at10b(G2, WED, 8, 2)?.items[0].subject).toBe('Хімія')
    expect(at10b(G1, WED, 8, 1)).toBeUndefined()
    expect(at10b(G1, WED, 8, 2)).toBeUndefined()
  })

  it('пояснюємо зниклу хімію тільки тому, у кого вона буває', () => {
    expect(offWeekNote(TEN_B, WED, G2, 1)).toContain('Хімія')
    expect(offWeekNote(TEN_B, WED, G2, 2)).toBeNull()
    expect(offWeekNote(TEN_B, WED, G1, 1)).toBeNull()
  })
})

describe('які поділи є в класі', () => {
  it('10-Б ділиться за всіма ознаками', () => {
    const dims = dimensionsOf(TEN_B)
    expect([...dims].sort()).toEqual(['classGroup', 'english', 'gender', 'language', 'week'])
  })

  it('у четвертих класах другої іноземної немає', () => {
    expect(dimensionsOf(classById('4а')!).has('language')).toBe(false)
  })
})

describe('що зараз', () => {
  const lessons = day(G1, MON)

  it('до першого дзвінка', () => {
    const s = computeStatus(lessons, at(7, 30))
    expect(s.kind).toBe('before')
    if (s.kind === 'before') expect(s.inMin).toBe(30)
  })

  it('під час уроку рахує, скільки лишилось', () => {
    const s = computeStatus(lessons, at(8, 22))
    expect(s.kind).toBe('lesson')
    if (s.kind === 'lesson') {
      expect(s.leftMin).toBe(18)
      expect(s.progress).toBeCloseTo(22 / 40, 5)
      expect(s.next?.period).toBe(2)
    }
  })

  it('рівно на дзвінку урок уже скінчився', () => {
    const s = computeStatus(lessons, at(8, 40))
    expect(s.kind).toBe('break')
    if (s.kind === 'break') expect(s.inMin).toBe(15)
  })

  it('рівно на початку урок уже почався', () => {
    const s = computeStatus(lessons, at(8, 55))
    expect(s.kind).toBe('lesson')
    if (s.kind === 'lesson') expect(s.progress).toBe(0)
  })

  it('після останнього уроку — на сьогодні все', () => {
    const s = computeStatus(lessons, at(23, 0))
    expect(s.kind).toBe('done')
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
    expect(nextSchoolIso(5)).toBe(1)
    expect(nextSchoolIso(7)).toBe(1)
    expect(nextSchoolIso(3)).toBe(4)
  })

  it('скільки діб чекати', () => {
    expect(daysUntil(6, 1)).toBe(2)
    expect(daysUntil(7, 1)).toBe(1)
    expect(daysUntil(5, 1)).toBe(3)
  })

  it('додавання днів переходить через межу місяця', () => {
    expect(addDays({ year: 2026, month: 8, day: 30 }, 2)).toEqual({
      year: 2026,
      month: 9,
      day: 1,
    })
  })
})

describe('налаштування зі старої версії', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    })
  })

  it('той, хто вже поставив застосунок для 10-Б, нічого не перевибирає', () => {
    localStorage.setItem(
      'rozklad-10b:prefs:v1',
      JSON.stringify({ classGroup: '2', language: 'fr', english: 'Б', gender: 'girls' }),
    )

    expect(loadPrefs()).toEqual({
      classId: '10б',
      classGroup: '2',
      language: 'ф',
      english: 'б',
      gender: 'д',
    })
  })

  it('перенесене зберігається, щоб більше не конвертувати', () => {
    localStorage.setItem(
      'rozklad-10b:prefs:v1',
      JSON.stringify({ classGroup: '1', language: 'de', english: 'А', gender: null }),
    )
    loadPrefs()
    expect(JSON.parse(localStorage.getItem('rozklad:prefs:v2')!)).toMatchObject({
      classId: '10б',
      english: 'а',
      language: 'н',
    })
  })

  it('порожньо — значить, питаємо клас', () => {
    expect(loadPrefs()).toBeNull()
  })

  it('невідомий клас у сховищі не ламає застосунок', () => {
    savePrefs({ ...G1, classId: '12я' })
    expect(loadPrefs()).toBeNull()
  })
})

describe('тексти', () => {
  it('українська множина', () => {
    expect(plural(1, ['урок', 'уроки', 'уроків'])).toBe('урок')
    expect(plural(3, ['урок', 'уроки', 'уроків'])).toBe('уроки')
    expect(plural(11, ['урок', 'уроки', 'уроків'])).toBe('уроків')
    expect(plural(21, ['урок', 'уроки', 'уроків'])).toBe('урок')
  })

  it('тривалість', () => {
    expect(formatDuration(18)).toBe('18 хв')
    expect(formatDuration(60)).toBe('1 год')
    expect(formatDuration(95)).toBe('1 год 35 хв')
  })
})

describe('п’ятниця 10-Б', () => {
  it('останній урок — по групах', () => {
    expect(at10b(G1, FRI, 7)?.items[0].subject).toBe('Країнознавство')
    expect(at10b(G2, FRI, 7)?.items[0].subject).toBe('Технології')
    expect(at10b(G2, FRI, 7)?.items[0].room).toBe('1')
  })
})
