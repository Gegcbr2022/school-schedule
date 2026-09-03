import { beforeEach, describe, expect, it } from 'vitest'
import type { Period } from '../data/schedule'
import { BELLS, GROUP_DIM, PERIODS, SUBJECTS, subjectName } from '../data/schedule'
import { BOOKS, booksForClass } from '../data/books'
import { specialDayOn } from '../data/special'
import { TIMETABLE } from '../data/timetable'
import { addDays, formatDuration, kyivNow, parseTime, plural, weekParity } from './clock'
import type { DisplayLesson } from './lessons'
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
import { MENU, menuCovers, menuFor, portion } from '../data/menu'
import { DAY_PERIOD, allNotes, datesWithNotes, setNote } from './notes'
import type { Prefs } from './prefs'
import { loadPrefs, savePrefs } from './prefs'

const at = (h: number, m: number) => h * 60 + m

const G1: Prefs = {
  classId: '10б',
  classGroup: '1',
  language: 'н',
  english: 'а',
  gender: 'х',
  teacherId: null,
}
const G2: Prefs = { ...G1, classGroup: '2', language: 'ф', english: 'б', gender: 'д' }
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

  // Після паперового розкладу з кабінетами нерозшифрованих не лишилось —
  // цей тест не дасть новому імпорту тихо привести код без назви.
  it('усі скорочення з розкладу розшифровані', () => {
    const bare = new Set<string>()
    for (const cls of TIMETABLE)
      for (const day of cls.days)
        for (const lesson of day) for (const cell of lesson.c) if (!SUBJECTS[cell.s]) bare.add(cell.s)
    expect([...bare]).toEqual([])
  })

  it('невідоме скорочення показуємо як є, а не вигадуємо', () => {
    expect(SUBJECTS['щось']).toBeUndefined()
    expect(subjectName('щось')).toBe('щось')
  })

  it('розшифровки з паперового розкладу з кабінетами', () => {
    expect(subjectName('п')).toBe('Природознавство')
    expect(subjectName('да')).toBe('Ділова англійська')
    // Раніше тут стояла «Хореографія» — здогад, і неправильний.
    expect(subjectName('хе')).toBe('Християнська етика')
  })

  it('підказані в школі розшифровки на місці', () => {
    expect(subjectName('нр')).toBe('Навчаємось разом')
    expect(subjectName('мпЗ')).toBe('Моя планета Земля')
    expect(subjectName('тфв')).toBe('Твої фізичні відкриття')
  })

  it('технології в 4–9 ділять на хлопців і дівчат, у 10–11 — на групи', () => {
    const gendered = classById('8а')!.days.flat().flatMap((l) => l.c).filter((c) => c.s === 'т')
    expect(gendered.map((c) => c.g)).toEqual(['х', 'д'])

    const byGroup = classById('10б')!.days.flat().flatMap((l) => l.c).filter((c) => c.s === 'т')
    expect(byGroup.every((c) => c.g === '1' || c.g === '2')).toBe(true)
  })

  it('велика М — математика, мала м — мистецтво', () => {
    expect(subjectName('М')).toBe('Математика')
    expect(subjectName('м')).toBe('Мистецтво')
  })

  it('«і» з паперу розділено: весь клас — історія, по групах — інформатика', () => {
    // Понеділок, 3 урок — історик ЛК у своєму 19-му, весь клас.
    expect(at10b(G1, MON, 3)?.items[0].subject).toBe('Історія')
    expect(at10b(G1, MON, 3)?.items[0].room).toBe('19')
    // Вівторок, 3 урок — інформатик ІГ, 2 група, комп'ютерний 15-й.
    expect(at10b(G2, TUE, 3)?.items[0].subject).toBe('Інформатика')
    expect(at10b(G2, TUE, 3)?.items[0].room).toBe('15')
  })

  it('жоден клас не має інформатики без поділу на групи', () => {
    for (const cls of TIMETABLE) {
      for (const cell of cls.days.flat().flatMap((l) => l.c)) {
        if (cell.s === 'і') expect(['1', '2']).toContain(cell.g)
        if (cell.s === 'іст') expect(cell.g === '1' || cell.g === '2').toBe(false)
      }
    }
  })

  it('усі розшифровані скорочення справді трапляються в розкладі', () => {
    const used = new Set(TIMETABLE.flatMap((c) => c.days.flat().flatMap((l) => l.c.map((x) => x.s))))
    // «еврика» є лише в підручниках 5–8, у сітці уроків її немає.
    const bookOnly = new Set(['еврика'])
    for (const code of Object.keys(SUBJECTS)) {
      if (!bookOnly.has(code)) expect(used.has(code)).toBe(true)
    }
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

  // Вчителя підписуємо так, як до нього звертаються: ім'я, по батькові
  // і рівно стільки прізвища, щоб не сплутати тезок.
  it('вчителі підказують, яка група твоя', () => {
    expect(at10b(G1, MON, 4)?.items[0].teacher).toBe('Галина Богданівна Ж.')
    expect(at10b(G2, TUE, 5)?.items[0].teacher).toBe('Оксана Василівна Д.')
    expect(at10b({ ...G1, english: 'а' }, MON, 5)?.items[0].teacher).toBe('Надія Володимирівна А.')
    expect(at10b({ ...G1, english: 'б' }, MON, 5)?.items[0].teacher).toBe('Галина Василівна П.')
    expect(at10b({ ...G1, english: 'в' }, MON, 5)?.items[0].teacher).toBe('Анастасія Євгенівна Г.')
  })

  // Хімія в середу 8-м уроком стоїть тільки на другому тижні й на весь клас,
  // без жодного поділу. У повному розкладі її видно завжди — тож підпис про
  // тиждень тут обов'язковий, інакше вона мовчки висить у першому.
  it('урок «через тиждень» у повному розкладі підписаний навіть без поділу', () => {
    const wk1 = day(G1, WED, 1, 'full').find((l) => l.period === 8)
    expect(wk1?.items[0].subject).toBe('Хімія')
    expect(wk1?.note).toBe('Наступного тижня · 2 тиждень')

    const wk2 = day(G1, WED, 2, 'full').find((l) => l.period === 8)
    expect(wk2?.note).toBe('Цього тижня · 2 тиждень')
  })

  it('у «моєму» розкладі цієї хімії першого тижня немає зовсім', () => {
    expect(day(G1, WED, 1, 'my').some((l) => l.period === 8)).toBe(false)
    expect(day(G1, WED, 2, 'my').some((l) => l.period === 8)).toBe(true)
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
  it('середа, 2 урок: перший тиждень географія, другий історія', () => {
    expect(at10b(G1, WED, 2, 1)?.items[0].subject).toBe('Географія')
    expect(at10b(G1, WED, 2, 2)?.items[0].subject).toBe('Історія')
  })

  it('однаково для обох навчальних груп — це не поділ класу', () => {
    expect(at10b(G2, WED, 2, 1)?.items[0].subject).toBe('Географія')
    expect(at10b(G2, WED, 2, 2)?.items[0].subject).toBe('Історія')
  })

  it('кабінет свій у кожного тижня', () => {
    expect(at10b(G1, WED, 2, 1)?.items[0].room).toBe('1')
    expect(at10b(G1, WED, 2, 2)?.items[0].room).toBe('19')
  })

  it('урок є завжди — на відміну від хімії', () => {
    expect(at10b(G1, WED, 2, 1)).toBeDefined()
    expect(at10b(G1, WED, 2, 2)).toBeDefined()
  })

  it('хімія 8-м уроком: для всього класу, але лише на другому тижні', () => {
    // Перший тиждень — немає ні в кого.
    expect(at10b(G1, WED, 8, 1)).toBeUndefined()
    expect(at10b(G2, WED, 8, 1)).toBeUndefined()
    // Другий тиждень — є в обох груп.
    expect(at10b(G1, WED, 8, 2)?.items[0].subject).toBe('Хімія')
    expect(at10b(G2, WED, 8, 2)?.items[0].subject).toBe('Хімія')
  })

  it('пояснюємо зниклу хімію на першому тижні всім', () => {
    expect(offWeekNote(TEN_B, WED, G1, 1)).toContain('Хімія')
    expect(offWeekNote(TEN_B, WED, G2, 1)).toContain('Хімія')
    expect(offWeekNote(TEN_B, WED, G1, 2)).toBeNull()
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

describe('вікно проти перерви', () => {
  const lesson = (period: number, n: number): DisplayLesson => ({
    n,
    period,
    ...BELLS[period as Period],
    items: [{ subject: 'Математика' }],
  })

  it('пропущені цілі уроки — це вікно, а не перерва', () => {
    // 1-й і 4-й уроки: між ними два порожні.
    const day = [lesson(1, 1), lesson(4, 2)]
    const status = computeStatus(day, at(9, 0))
    expect(status.kind).toBe('break')
    if (status.kind === 'break') expect(status.free).toBe(2)
  })

  it('сусідні уроки — звичайна перерва', () => {
    const day = [lesson(1, 1), lesson(2, 2)]
    const status = computeStatus(day, at(8, 45))
    expect(status.kind).toBe('break')
    if (status.kind === 'break') expect(status.free).toBe(0)
  })
})

describe('записані завдання', () => {
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

  it('віддає лише свій клас, за датою і уроком', () => {
    setNote({ classId: '10б', date: '2026-09-04', period: 2 }, 'контрольна')
    setNote({ classId: '10б', date: '2026-09-03', period: 4 }, 'вивчити теорему')
    setNote({ classId: '10б', date: '2026-09-03', period: 1 }, 'атлас')
    setNote({ classId: '9а', date: '2026-09-03', period: 1 }, 'чуже')

    expect(allNotes('10б')).toEqual([
      { date: '2026-09-03', period: 1, text: 'атлас' },
      { date: '2026-09-03', period: 4, text: 'вивчити теорему' },
      { date: '2026-09-04', period: 2, text: 'контрольна' },
    ])
    expect(datesWithNotes('10б')).toEqual(new Set(['2026-09-03', '2026-09-04']))
  })

  it('порожній текст стирає запис, а не лишає пустий', () => {
    setNote({ classId: '10б', date: '2026-09-03', period: 1 }, 'щось')
    setNote({ classId: '10б', date: '2026-09-03', period: 1 }, '   ')
    expect(allNotes('10б')).toEqual([])
  })

  // Чергування — не до уроку, а до дня: такий запис іде першим у своєму дні.
  it('нотатка на весь день стоїть перед уроками того самого дня', () => {
    setNote({ classId: '10б', date: '2026-09-03', period: 3 }, 'реферат')
    setNote({ classId: '10б', date: '2026-09-03', period: DAY_PERIOD }, 'чергування')

    expect(allNotes('10б').map((n) => n.text)).toEqual(['чергування', 'реферат'])
    expect(datesWithNotes('10б')).toEqual(new Set(['2026-09-03']))
  })

  // Вчитель пише нотатки до своїх уроків, а не до класу, — простір ключів свій.
  it('вчительські записи не змішуються з класними', () => {
    setNote({ classId: '10б', date: '2026-09-03', period: 1 }, 'учнівське')
    setNote({ classId: 'вч123', date: '2026-09-03', period: 1 }, 'вчительське')
    expect(allNotes('10б').map((n) => n.text)).toEqual(['учнівське'])
    expect(allNotes('вч123').map((n) => n.text)).toEqual(['вчительське'])
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
      teacherId: null,
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

describe('підручники', () => {
  it('усі 9-і класи бачать один список', () => {
    const a = booksForClass('9а')
    expect(booksForClass('9б')).toBe(a)
    expect(booksForClass('9в')).toBe(a)
    expect(a.length).toBeGreaterThan(0)
  })

  it('для класу без підручників список порожній, а не помилка', () => {
    // Підручники є в 5–9; у 4, 10, 11 поки немає.
    expect(booksForClass('4а')).toEqual([])
    expect(booksForClass('11б')).toEqual([])
  })

  it('назва предмета береться з розкладу, а не дублюється', () => {
    for (const group of Object.values(BOOKS).flat()) {
      if (group.subject) expect(SUBJECTS[group.subject]).toBeDefined()
      else expect(group.title).toBeTruthy()
    }
  })

  it('у кожної книжки є назва', () => {
    for (const group of Object.values(BOOKS).flat()) {
      expect(group.books.length).toBeGreaterThan(0)
      for (const book of group.books) expect(book.title.trim()).not.toBe('')
    }
  })

  it('посилання, якщо є, ведуть на pdf', () => {
    for (const group of Object.values(BOOKS).flat()) {
      for (const book of group.books) {
        // Або повна адреса, або шлях до файлу в public/ — але завжди pdf.
        if (book.url) expect(book.url).toMatch(/\.pdf(\?.*)?$/i)
      }
    }
  })

  it('усі книжки 5–9 класів мають файл і кількість сторінок', () => {
    for (const grade of ['5', '6', '7', '8', '9']) {
      const groups = booksForClass(`${grade}а`)
      expect(groups.length).toBeGreaterThan(0)
      for (const group of groups) {
        for (const book of group.books) {
          expect(book.url).toBeTruthy()
          expect(book.pages).toBeGreaterThan(0)
        }
      }
    }
  })

  it('адреси файлів унікальні — нічого не перезаписується', () => {
    const urls = booksForClass('9а')
      .flatMap((g) => g.books)
      .map((b) => b.url)
    expect(new Set(urls).size).toBe(urls.length)
  })
})

describe('меню їдальні', () => {
  it('п’ять днів, у кожному сніданок і обід, у кожної страви вихід', () => {
    expect(MENU).toHaveLength(5)
    for (const day of MENU) {
      expect(day.breakfast.length).toBeGreaterThan(0)
      expect(day.lunch.length).toBeGreaterThan(0)
      for (const dish of [...day.breakfast, ...day.lunch]) {
        expect(dish.name.trim()).not.toBe('')
        expect(dish.out.trim()).not.toBe('')
      }
    }
  })

  it('на вихідних меню немає', () => {
    expect(menuFor(1)).toBe(MENU[0])
    expect(menuFor(5)).toBe(MENU[4])
    expect(menuFor(6)).toBeNull()
    expect(menuFor(7)).toBeNull()
  })

  // Меню затверджують на період: коли він мине, чесніше сказати про це,
  // ніж видавати старі страви за сьогоднішні.
  it('діє лише в затверджений період', () => {
    expect(menuCovers('2026-09-02')).toBe(true)
    expect(menuCovers('2026-09-04')).toBe(true)
    expect(menuCovers('2026-09-01')).toBe(false)
    expect(menuCovers('2026-09-07')).toBe(false)
  })

  it('вихід — у грамах, окрім штук', () => {
    expect(portion('150')).toBe('150 г')
    expect(portion('120/5')).toBe('120/5 г')
    expect(portion('1 шт')).toBe('1 шт')
  })
})

describe('особливі дні', () => {
  it('1 вересня 2026 — День знань без уроків із лінійкою о 10:00', () => {
    const day = specialDayOn({ year: 2026, month: 9, day: 1 })
    expect(day?.title).toBe('День знань')
    expect(day?.noLessons).toBe(true)
    expect(day?.events?.[0]).toMatchObject({ time: '10:00' })
  })

  it('звичайний день не особливий', () => {
    expect(specialDayOn({ year: 2026, month: 9, day: 2 })).toBeNull()
  })

  it('parseTime розбирає час і відкидає кривий', () => {
    expect(parseTime('10:00')).toBe(600)
    expect(parseTime('08:45')).toBe(525)
    expect(parseTime('25:00')).toBeNull()
    expect(parseTime('хай')).toBeNull()
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
