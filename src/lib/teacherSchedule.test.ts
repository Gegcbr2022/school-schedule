import { describe, expect, it } from 'vitest'
import { booksForGrade } from '../data/books'
import { TIMETABLE } from '../data/timetable'
import {
  buildTeacherDay,
  buildTeacherWeek,
  teacherFacts,
  teacherGrades,
} from './teacherSchedule'
import type { Teacher } from './teachers'
import {
  codeHolders,
  isSharedCode,
  scheduleName,
  scheduleTeachers,
  teacherLabel,
  teacherOf,
  undecodedCodes,
} from './teachers'

const WEEKS = [1, 2] as const

/** Прізвище вчителя за кодом; для спільних кодів — за предметом і класом. */
const who = (code: string, subject?: string, classId?: string) =>
  teacherOf(code, subject, classId)?.last

const byLast = (last: string): Teacher => {
  const found = scheduleTeachers().find((t) => t.last === last)
  if (!found) throw new Error(`У розкладі немає вчителя ${last}`)
  return found
}

/** Усі коди, що справді трапляються в розкладі. */
function codesInTimetable(): Set<string> {
  const codes = new Set<string>()
  for (const cls of TIMETABLE)
    for (const day of cls.days)
      for (const lesson of day) for (const cell of lesson.c) if (cell.t) codes.add(cell.t)
  return codes
}

describe('розшифровка кодів', () => {
  it('кожен код із розкладу має підпис', () => {
    for (const code of codesInTimetable()) {
      expect(teacherLabel(code), code).toBeTruthy()
    }
  })

  it('нерозгаданий код показуємо ним самим, а не чужим прізвищем', () => {
    for (const { code } of undecodedCodes()) {
      expect(codeHolders(code)).toHaveLength(0)
      expect(teacherLabel(code)).toBe(code)
    }
  })

  it('трилітерний код розводить тезок: СВС — Савчук Світлана Василівна', () => {
    const savchuk = teacherOf('СВС')
    expect(savchuk?.last).toBe('Савчук')
    expect(savchuk?.patronymic).toBe('Василівна')
  })

  it('спільний код ОК — це англійська Кравчишин і українська Козак', () => {
    expect(isSharedCode('ОК')).toBe(true)
    expect(who('ОК', 'ам', '7а')).toBe('Кравчишин')
    expect(who('ОК', 'ум', '5а')).toBe('Козак')
  })

  it('ЛЧ розводиться і предметом, і класом', () => {
    expect(who('ЛЧ', 'іст', '9а')).toBe('Човган')
    expect(who('ЛЧ', 'мм', '7а')).toBe('Чорній')
    // «Навчаємось разом» кожна веде у власному класі — предмета тут мало.
    expect(who('ЛЧ', 'нр', '7в')).toBe('Чорній')
    expect(who('ЛЧ', 'нр', '9а')).toBe('Човган')
  })

  it('нерозведений спільний код підписуємо обома прізвищами, а не навмання', () => {
    // Предмета, якого немає в жодної умови, вистачити не може.
    expect(teacherOf('ОК', 'фк', '7а')).toBeUndefined()
    expect(teacherLabel('ОК', 'фк', '7а')).toContain('/')
  })
})

describe('як підписуємо вчителя', () => {
  it("ім'я, по батькові й скорочене прізвище", () => {
    expect(scheduleName(byLast('Желяк'))).toBe('Галина Богданівна Ж.')
    expect(teacherLabel('ГЖ', 'ум', '10б')).toBe('Галина Богданівна Ж.')
  })

  it('тезкам прізвище доростає рівно до розрізнення', () => {
    // Матійчук і Микитин — обидві Світлани Степанівни, обидві на «М».
    expect(scheduleName(byLast('Матійчук'))).toBe('Світлана Степанівна Ма.')
    expect(scheduleName(byLast('Микитин'))).toBe('Світлана Степанівна Ми.')
  })

  it('підписи всіх учителів розкладу різні', () => {
    const names = scheduleTeachers().map(scheduleName)
    expect(new Set(names).size).toBe(names.length)
  })

  it('кожна комірка розкладу веде рівно до однієї людини', () => {
    const undecoded = new Set(undecodedCodes().map((u) => u.code))
    for (const cls of TIMETABLE)
      for (const day of cls.days)
        for (const lesson of day)
          for (const cell of lesson.c) {
            if (!cell.t || undecoded.has(cell.t)) continue
            expect(teacherOf(cell.t, cell.s, cls.id), `${cls.id} ${cell.s} ${cell.t}`).toBeDefined()
          }
  })
})

describe('розклад учителя', () => {
  it('вікна — це рівно порожні періоди між першим і останнім уроком', () => {
    for (const week of WEEKS) {
      for (const teacher of scheduleTeachers()) {
        for (const day of buildTeacherWeek(teacher, week)) {
          const lessons = day.rows.filter((r) => r.kind === 'lesson')
          const windows = day.rows.filter((r) => r.kind === 'window')
          expect(windows.length).toBe(day.windows)
          expect(lessons.length).toBe(day.count)
          if (day.rows.length === 0) continue

          // Ряди йдуть суцільно за номером періоду, без дір і без повторів.
          const periods = day.rows.map((r) => r.period)
          for (let i = 1; i < periods.length; i += 1) {
            expect(periods[i]).toBe(periods[i - 1] + 1)
          }
          // Край дня — завжди урок: вікно ні першим, ні останнім не буває.
          expect(day.rows[0].kind).toBe('lesson')
          expect(day.rows[day.rows.length - 1].kind).toBe('lesson')
        }
      }
    }
  })

  it('день учителя збігається з уроками того самого тижня', () => {
    for (const week of WEEKS) {
      for (const teacher of scheduleTeachers()) {
        buildTeacherWeek(teacher, week).forEach((day, index) => {
          const asLessons = buildTeacherDay(teacher, index, week)
          expect(asLessons).toHaveLength(day.count)
          // Нумерація власна, а період — загальношкільний.
          asLessons.forEach((lesson, i) => expect(lesson.n).toBe(i + 1))
        })
      }
    }
  })

  it('уроки однофамільців під спільним кодом не перемішуються', () => {
    const gaschak = teacherFacts(byLast('Гащак')) // англійська
    const gorichko = teacherFacts(byLast('Горічко')) // фізкультура
    expect(gaschak.subjects).toEqual(['Англійська мова'])
    expect(gorichko.subjects).toEqual(['Фізична культура'])
  })

  it('класного керівника впізнаємо попри різний порядок імені у розкладі', () => {
    // «Христина Братина», «Теремко Марія», «Світлана В. Савчук» — усі три форми.
    expect(teacherFacts(byLast('Братина')).homerooms).toContain('4-А')
    expect(teacherFacts(byLast('Теремко')).homerooms).toContain('5-Д')
    expect(teacherFacts(byLast('Савчук')).homerooms).toContain('5-Г')
  })

  it('у директорки лише математика в одинадцятих', () => {
    const facts = teacherFacts(byLast('Романишин'))
    expect(facts.subjects).toEqual(['Математика'])
    expect(facts.classes).toEqual(['11-А', '11-Б'])
  })
})

describe('підручники вчителя', () => {
  it('предмети розкладено по паралелях, від молодшої до старшої', () => {
    const grades = teacherGrades(byLast('Варварук')) // географія, 6–11
    expect(grades.map((g) => g.grade)).toEqual(['6', '7', '8', '9', '10', '11'])
    for (const { subjects } of grades) expect(subjects).toEqual(['г'])
  })

  // У розкладі це один код «М», а підручники окремі — алгебра й геометрія.
  it('алгебру й геометрію вчитель математики бачить за кодом із розкладу', () => {
    const seven = teacherGrades(byLast('Загаровська')).find((g) => g.grade === '7')
    expect(seven?.subjects).toContain('М')
    expect(booksForGrade('7', ['М']).map((g) => g.title)).toEqual(['Алгебра', 'Геометрія'])
  })

  it('чужі предмети на полицю не потрапляють', () => {
    const geo = booksForGrade('9', ['г'])
    expect(geo.length).toBeGreaterThan(0)
    for (const group of geo) expect(group.subject).toBe('г')
  })

  it('паралель без підручників дає порожньо, а не помилку', () => {
    // Географія в 11-х є, підручників у застосунку — ще ні.
    expect(teacherGrades(byLast('Варварук')).at(-1)?.grade).toBe('11')
    expect(booksForGrade('11', ['г'])).toEqual([])
  })
})
