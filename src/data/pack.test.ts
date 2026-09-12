import { describe, expect, it } from 'vitest'
import { FORMAT, SEED_PACK, isNewer, isPack, pack } from './pack'
import { BELLS, PERIODS, SCHOOL_NAME, SUBJECTS } from './schedule'
import { TIMETABLE } from './timetable'
import { TEACHERS } from './teachers'

/**
 * Пак — це шов між даними й кодом, і ламається він тихо: зіпсований
 * пак не падає, а просто підмінюється насінним, і людина бачить
 * позавчорашній розклад, не знаючи про це. Тому перевіряємо тут
 * рівно дві речі: що насіння саме по собі валідне (інакше застосунок
 * не прийме власних даних із сервера) і що воно справді доходить до
 * тих, хто його читає.
 */

describe('насінний пак', () => {
  it('проходить власну перевірку — інакше сервер не зміг би віддати ці ж дані', () => {
    expect(isPack(SEED_PACK)).toBe(true)
  })

  it('переживає подорож через JSON', () => {
    // Саме в такому вигляді пак і приїжджає з мережі.
    expect(isPack(JSON.parse(JSON.stringify(SEED_PACK)))).toBe(true)
  })

  it('має дзвінок на кожен період, інакше день не збудувати', () => {
    for (const p of PERIODS) {
      expect(SEED_PACK.bells[p]).toBeDefined()
      expect(SEED_PACK.bells[p].end).toBeGreaterThan(SEED_PACK.bells[p].start)
    }
  })

  it('версія сортується як рядок', () => {
    // `isNewer` порівнює версії просто як рядки, тож формат мусить бути
    // таким, щоб пізніше було більшим. `рррр-мм-ддТгг:хх` — таким і є.
    expect(SEED_PACK.version).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
})

describe('isPack', () => {
  const good = JSON.parse(JSON.stringify(SEED_PACK))

  it('не пускає чужий формат', () => {
    expect(isPack({ ...good, format: FORMAT + 1 })).toBe(false)
  })

  it('не пускає пак без розкладу', () => {
    expect(isPack({ ...good, timetable: [] })).toBe(false)
    expect(isPack({ ...good, timetable: 'нема' })).toBe(false)
  })

  it('не пускає пак без дзвінків', () => {
    expect(isPack({ ...good, bells: {} })).toBe(false)
  })

  it('не пускає пак без школи', () => {
    expect(isPack({ ...good, school: undefined })).toBe(false)
    expect(isPack({ ...good, school: { ...good.school, yearStart: undefined } })).toBe(false)
  })

  it('не пускає сміття', () => {
    expect(isPack(null)).toBe(false)
    expect(isPack('{}')).toBe(false)
    expect(isPack({})).toBe(false)
    // Сервер, який на 404 віддає index.html, теж має бути відкинутий.
    expect(isPack({ format: FORMAT, version: '2030-01-01T00:00' })).toBe(false)
  })

  /*
   * Нижче — форми, які колись проходили перевірку й валили застосунок ще
   * під час обчислення модулів: `lib/rooms.ts` і `lib/teachers.ts`
   * будують свої таблиці одразу при імпорті, тож до `ErrorBoundary`
   * справа не доходила — був білий екран. Кожен рядок тут — реальний
   * спосіб зробити застосунок непридатним.
   */
  it('не пускає діряві масиви', () => {
    expect(isPack({ ...good, teachers: [null] })).toBe(false)
    expect(isPack({ ...good, teachers: [{ id: 1, code: 'ГЖ' }] })).toBe(false)
    expect(isPack({ ...good, timetable: [{ id: '10б', name: '10-Б' }] })).toBe(false)
    expect(isPack({ ...good, special: [null] })).toBe(false)
    expect(isPack({ ...good, special: [{ date: '2026-09-01' }] })).toBe(false)
  })

  it('вимагає дзвінок на кожен період, а не просто непорожні дзвінки', () => {
    expect(isPack({ ...good, bells: { 1: { start: 480, end: 520 } } })).toBe(false)
    // Ключі є, а всередині не час — мовчки дало б NaN у порівняннях,
    // тобто «урок не йде ніколи».
    const broken = { ...good, bells: { ...good.bells, 3: { start: 'ранок', end: 'потім' } } }
    expect(isPack(broken)).toBe(false)
  })

  it('вимагає повне меню — інакше аркуш меню падає на порожній даті', () => {
    expect(isPack({ ...good, menuMeta: {} })).toBe(false)
    expect(isPack({ ...good, menuMeta: { ...good.menuMeta, from: undefined } })).toBe(false)
  })

  it('не пускає версію в довільному форматі', () => {
    // Загублений нуль зробив би версію більшою за будь-яку жовтневу, і
    // розклад застряг би на ній назавжди — ні сервер, ні нова збірка
    // застосунку вже не витіснили б її.
    expect(isPack({ ...good, version: '2026-9-15T08:00' })).toBe(false)
    expect(isPack({ ...good, version: 'остання' })).toBe(false)
    expect(isPack({ ...good, version: '2026-09-15' })).toBe(false)

    // Ось чому саме: рядкове порівняння ставить вересень із одною цифрою
    // попереду жовтня. Формат — не косметика.
    const typo = '2026-9-15T08:00'
    const later = '2026-10-01T00:00'
    expect(typo > later).toBe(true)
  })
})

describe('isNewer', () => {
  const base = SEED_PACK

  it('бере свіжіший', () => {
    expect(isNewer({ ...base, version: '2099-01-01T00:00' }, base)).toBe(true)
  })

  it('не бере старіший', () => {
    expect(isNewer({ ...base, version: '2000-01-01T00:00' }, base)).toBe(false)
  })

  it('за однакової версії лишає той, що вже є', () => {
    expect(isNewer({ ...base }, base)).toBe(false)
  })
})

describe('пак доходить до тих, хто його читає', () => {
  it('у Node сховища немає, тож працюємо на насінні', () => {
    expect(pack).toBe(SEED_PACK)
  })

  it('довідники беруться з паку, а не з власних копій', () => {
    expect(BELLS).toBe(pack.bells)
    expect(SUBJECTS).toBe(pack.subjects)
    expect(TIMETABLE).toBe(pack.timetable)
    expect(TEACHERS).toBe(pack.teachers)
    expect(SCHOOL_NAME).toBe(pack.school.name)
  })
})
