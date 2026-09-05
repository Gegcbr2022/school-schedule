import { describe, expect, it } from 'vitest'
import { BELLS } from '../data/schedule'
import { ROOM_LIST, periodAfter, periodAt, roomsAt } from './rooms'

const WED = 2
const FRI = 4
const roomAt = (day: number, period: number, room: string, week: 1 | 2 = 1) =>
  roomsAt(day, period as never, week).find((r) => r.room === room)

describe('карта кабінетів', () => {
  it('дзвінок ділить час на урок і перерву', () => {
    expect(periodAt(BELLS[1].start)).toBe(1)
    expect(periodAt(BELLS[1].end - 1)).toBe(1)
    // Рівно на дзвінок з уроку кабінет уже вільний.
    expect(periodAt(BELLS[1].end)).toBeNull()
    expect(periodAfter(BELLS[1].end)).toBe(2)
    expect(periodAfter(BELLS[12].start)).toBeNull()
  })

  it('у списку є і номери, і зали — номери першими', () => {
    expect(ROOM_LIST).toContain('25')
    expect(ROOM_LIST).toContain('сз')
    expect(ROOM_LIST).toContain('акт.зал')
    const firstName = ROOM_LIST.findIndex((r) => Number.isNaN(Number(r)))
    expect(ROOM_LIST.slice(0, firstName).every((r) => !Number.isNaN(Number(r)))).toBe(true)
  })

  it('зайнятий кабінет називає клас, предмет і вчителя', () => {
    const room = roomAt(WED, 1, '25')
    expect(room?.busy.map((u) => u.cls)).toEqual(['10-Б'])
    expect(room?.busy[0].subject).toBe('Інформатика')
    expect(room?.busy[0].group).toBe('1 група')
    expect(room?.busy[0].who).toBe('Іван Миколайович Г.')
  })

  it('в одному кабінеті може сидіти кілька груп', () => {
    // 8-А, середа, 8 урок: обидві підгрупи німецької в 3-му.
    expect(roomAt(WED, 8, '3')?.busy).toHaveLength(2)
  })

  it('через тиждень кабінет зайнятий не завжди', () => {
    // 9-А, середа, 2 урок: перший тиждень — німецька/французька, другий — географія.
    expect(roomAt(WED, 2, '1', 1)?.busy.map((u) => u.cls)).toEqual(['10-Б'])
    expect(roomAt(WED, 2, '1', 2)?.busy.map((u) => u.cls)).toEqual(['9-А'])
  })

  it('вільний кабінет — це порожній список, а не відсутній рядок', () => {
    const free = roomsAt(FRI, 12, 1).filter((r) => r.busy.length === 0)
    expect(free.length).toBeGreaterThan(20)
    expect(free.every((r) => r.label.length > 0)).toBe(true)
  })
})
