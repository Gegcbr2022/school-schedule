import { describe, expect, it } from 'vitest'
import type { Club, Profile } from './prefs'
import { DEFAULT_GROUPS } from './prefs'
import { buildPack, decodePack, encodePack, mergeClubs, profileFromPack } from './share'

const football: Club = {
  id: 'г1',
  name: 'Футбол',
  days: [2, 4],
  start: 17 * 60,
  end: 18 * 60 + 30,
  travel: 30,
  place: 'ДЮСШ',
  teacher: 'Іван Петрович',
  phone: '+380671234567',
  note: 'Взяти форму',
}

const marijka: Profile = {
  ...DEFAULT_GROUPS,
  id: 'п1',
  name: 'Марійка',
  classId: '10б',
  classGroup: '2',
  english: 'б',
  teacherId: null,
  clubs: [football],
}

const ALL = { schedule: true, clubs: true, clean: false }

describe('що саме їде', () => {
  it('клас, поділи й гуртки — як налаштовано', () => {
    const pack = buildPack(marijka, ALL)
    expect(pack.name).toBe('Марійка')
    expect(pack.cls).toMatchObject({ id: '10б', classGroup: '2', english: 'б' })
    expect(pack.clubs).toHaveLength(1)
  })

  it('телефон і нотатка не їдуть, поки цього не попросили', () => {
    // У нотатках і телефонах бувають чужі дані, і поділитись ними
    // випадково — рівно те, про що потім шкодують.
    const pack = buildPack(marijka, { ...ALL, clean: true })
    expect(pack.clubs![0].phone).toBeUndefined()
    expect(pack.clubs![0].note).toBeUndefined()
    // А ім'я тренера лишається: без нього гурток безіменний.
    expect(pack.clubs![0].teacher).toBe('Іван Петрович')
  })

  it('можна поділитись самими гуртками', () => {
    const pack = buildPack(marijka, { schedule: false, clubs: true, clean: true })
    expect(pack.cls).toBeUndefined()
    expect(pack.clubs).toHaveLength(1)
  })

  it('порожній профіль не тягне порожній список гуртків', () => {
    const pack = buildPack({ ...marijka, clubs: [] }, ALL)
    expect(pack.clubs).toBeUndefined()
  })
})

describe('туди й назад', () => {
  it('переживає кодування без втрат', () => {
    const pack = buildPack(marijka, ALL)
    const back = decodePack(encodePack(pack))
    expect(back).toEqual(pack)
  })

  it('кирилиця не ламається', () => {
    const pack = buildPack({ ...marijka, name: 'Наталя-Софія' }, ALL)
    expect(decodePack(encodePack(pack))!.name).toBe('Наталя-Софія')
  })

  it('обрізане посилання не видає себе за розклад', () => {
    const code = encodePack(buildPack(marijka, ALL))
    expect(decodePack(code.slice(0, code.length - 12))).toBeNull()
  })

  it('сміття замість вантажу — це просто null', () => {
    expect(decodePack('')).toBeNull()
    expect(decodePack('не-база64!!')).toBeNull()
    expect(decodePack(btoa('{"v":1}'))).toBeNull()
  })

  it('чужа версія формату не читається', () => {
    expect(decodePack(btoa(JSON.stringify({ v: 99, school: 'x' })))).toBeNull()
  })

  it('криві гуртки відсіюються, решта лишається', () => {
    const broken = JSON.stringify({
      v: 1,
      school: 'licey11',
      name: 'Хтось',
      clubs: [football, { id: 'г2', name: '', days: [], start: 0, end: 0 }],
    })
    // Той самий base64url, що складає застосунок, — але зібраний руками,
    // щоб перевірка не залежала від нашого ж кодувальника.
    const bytes = new TextEncoder().encode(broken)
    const code = btoa(String.fromCharCode(...bytes))
    const pack = decodePack(code)
    expect(pack!.clubs).toHaveLength(1)
  })
})

describe('куди це покласти', () => {
  it('невідомий клас не ламає імпорт — беремо свій', () => {
    const pack = { v: 1, school: 'licey11', name: 'Гість', cls: { id: '99я' } as never }
    expect(profileFromPack(pack, 'п7', '10б').classId).toBe('10б')
  })

  it('поділи з вантажу доїжджають', () => {
    const pack = buildPack(marijka, ALL)
    const made = profileFromPack(pack, 'п7', '10б')
    expect(made).toMatchObject({ id: 'п7', name: 'Марійка', classId: '10б', classGroup: '2', english: 'б' })
  })

  it('гуртки з однаковими ключами не затирають одне одного', () => {
    // У вантажі цілком може приїхати свій «г1» — і без нового ключа він
    // мовчки замінив би чужий гурток.
    const mine: Club = { id: 'г1', name: 'Плавання', days: [1], start: 600, end: 660 }
    const merged = mergeClubs([mine], [football])
    expect(merged).toHaveLength(2)
    expect(new Set(merged.map((c) => c.id)).size).toBe(2)
    expect(merged.map((c) => c.name)).toEqual(['Плавання', 'Футбол'])
  })

  it('той самий гурток удруге не додається', () => {
    expect(mergeClubs([football], [{ ...football, id: 'інший' }])).toHaveLength(1)
  })
})
