import { describe, expect, it } from 'vitest'
import { applyEdits, readEdits, removedOn, revertEdit, saveLesson } from './edits'
import { buildDay, classById } from './lessons'
import type { Groups, Profile } from './prefs'
import { DEFAULT_PROFILE } from './prefs'
import { profileDay } from './profiles'

const TEN_B = classById('10б')!
const G2: Groups = { classGroup: '2', language: 'ф', english: 'б', gender: 'д' }
const WED = 2
const THU = 3
const ukr = { subject: 'Українська мова', teacher: 'Оксана Василівна Д.' }
const me = (edits: Profile['edits']): Profile => ({ ...DEFAULT_PROFILE, ...G2, edits })
const periods = (profile: Profile, d: number, week: 1 | 2 = 1) =>
  profileDay(profile, d, week, 'my').map((l) => `${l.n}:${l.period}:${l.items[0].subject}`)

describe('власні правки уроків', () => {
  it('перенос: зникає зі старого місця, стає на нове, нумерація заново', () => {
    const tue5 = { d: 1, p: 5 } // українська 2-ї групи у вівторок 5-м
    const edits = saveLesson(undefined, TEN_B, G2, 1, tue5, { d: THU, p: 8 }, ukr)
    expect(profileDay(me(edits), 1, 1, 'my').some((l) => l.period === 5)).toBe(false)
    const thu = profileDay(me(edits), THU, 1, 'my')
    expect(thu.at(-1)).toMatchObject({ n: thu.length, period: 8, edited: true, items: [ukr] })
    // Прибраний урок видно, щоб його можна було повернути.
    expect(removedOn(TEN_B, G2, edits, 1, 1).map((l) => l.period)).toEqual([5])
    // «Повний» розклад лишається шкільним.
    expect(profileDay(me(edits), 1, 1, 'full')).toEqual(buildDay(TEN_B, 1, G2, 'full', 1))
  })

  it('перенесли назад — жодних правок не лишається', () => {
    const tue5 = { d: 1, p: 5 }
    const there = saveLesson(undefined, TEN_B, G2, 1, tue5, { d: THU, p: 8 }, ukr)
    const official = buildDay(TEN_B, 1, G2, 'my', 1).find((l) => l.period === 5)!.items[0]
    const back = saveLesson(there, TEN_B, G2, 1, { d: THU, p: 8 }, tue5, {
      subject: official.subject,
      room: official.room,
      teacher: official.teacher,
    })
    expect(back).toEqual([])
  })

  it('кабінет виправили — урок той самий, інший кабінет', () => {
    const edits = saveLesson(undefined, TEN_B, G2, 1, { d: 0, p: 1 }, { d: 0, p: 1 }, {
      subject: 'Математика',
      room: '7',
    })
    expect(profileDay(me(edits), 0, 1, 'my')[0]).toMatchObject({ n: 1, items: [{ room: '7' }] })
    expect(revertEdit(edits, '10б', { d: 0, p: 1 }, 1)).toEqual([])
  })

  it('урок «через тиждень» правиться лише на відкритий тиждень', () => {
    // Середа, 2 урок: першого тижня географія, другого — історія.
    const edits = saveLesson(undefined, TEN_B, G2, 1, { d: WED, p: 2 }, { d: WED, p: 2 }, null)
    expect(edits).toEqual([{ cls: '10б', d: WED, p: 2, w: 1, item: null }])
    expect(periods(me(edits), WED, 1).some((s) => s.includes(':2:'))).toBe(false)
    expect(periods(me(edits), WED, 2).some((s) => s.endsWith(':2:Історія'))).toBe(true)
  })

  it('правка на тиждень переважає щотижневу', () => {
    const day = buildDay(TEN_B, 0, G2, 'my', 1)
    const edits = [
      { cls: '10б', d: 0, p: 1, item: { subject: 'А' } },
      { cls: '10б', d: 0, p: 1, w: 1 as const, item: { subject: 'Б' } },
    ]
    expect(applyEdits(day, edits, '10б', 0, 1)[0].items[0].subject).toBe('Б')
    expect(applyEdits(day, edits, '10б', 0, 2)[0].items[0].subject).toBe('А')
    // Правка іншого класу сюди не дістає.
    expect(applyEdits(day, [{ ...edits[0], cls: '10а' }], '10б', 0, 1)).toBe(day)
  })

  it('зі сховища бере лише цілі записи', () => {
    expect(readEdits('сміття')).toBeUndefined()
    expect(
      readEdits([
        { cls: '10б', d: 3, p: 7, item: { subject: ' Українська мова ', room: '', teacher: 'ОД' } },
        { cls: '10б', d: 2, p: 1, w: 2, item: null },
        { cls: '10б', d: 5, p: 1, item: null },
        { cls: '10б', d: 1, p: 13, item: null },
        { cls: '10б', d: 1, p: 1, item: { subject: '  ' } },
        { cls: '10б', d: 1, p: 1 },
        null,
      ]),
    ).toEqual([
      { cls: '10б', d: 3, p: 7, item: { subject: 'Українська мова', teacher: 'ОД' } },
      { cls: '10б', d: 2, p: 1, w: 2, item: null },
    ])
  })
})
