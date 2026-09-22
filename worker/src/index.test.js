import { describe, expect, it } from 'vitest'
import { buildFeed } from './index.js'

const now = '2026-09-22T10:31:00.000Z'

/** Тривога, як її віддає alerts.in.ua. */
function alert(over) {
  return { alert_type: 'air_raid', alert_level: 'yellow', started_at: '2026-09-22T10:05:00Z', ...over }
}

describe('що лягає у файл', () => {
  it('область із тривогою потрапляє, решта — ні', () => {
    const feed = buildFeed(
      {
        alerts: [
          alert({
            location_uid: '13',
            location_type: 'oblast',
            location_title: 'Івано-Франківська область',
            location_oblast: 'Івано-Франківська область',
            alert_level: 'red',
          }),
        ],
      },
      now,
    )
    expect(feed.v).toBe(1)
    expect(feed.regions['13']).toEqual({ level: 2, since: '2026-09-22T10:05:00Z' })
    expect(feed.regions['22']).toBeUndefined()
  })

  it('тривога по області доходить до кожного її району', () => {
    // Інакше той, хто обрав район, не побачив би загальнообласної тривоги
    // взагалі — і це найгірший з можливих способів помилитись.
    const feed = buildFeed(
      {
        alerts: [
          alert({
            location_uid: '13',
            location_type: 'oblast',
            location_title: 'Івано-Франківська область',
            location_oblast: 'Івано-Франківська область',
            alert_level: 'red',
          }),
        ],
      },
      now,
    )
    // 68 — Івано-Франківський, 71 — Калуський.
    expect(feed.regions['68']).toEqual({ level: 2, since: '2026-09-22T10:05:00Z' })
    expect(feed.regions['71'].level).toBe(2)
  })

  it('тривога в громаді піднімається до її району й області', () => {
    // `location_oblast_uid` у живій відповіді дублює `location_uid`, тож
    // рахувати треба за власною таблицею батьків.
    const feed = buildFeed(
      {
        alerts: [
          alert({
            location_uid: '353',
            location_type: 'hromada',
            location_oblast_uid: 353,
            location_oblast: 'Дніпропетровська область',
            location_title: 'Покровська територіальна громада',
            alert_level: 'red',
          }),
        ],
      },
      now,
    )
    // 47 — Нікопольський район, 9 — Дніпропетровська область.
    expect(feed.regions['47']).toMatchObject({ level: 2, scope: 'part', where: 'Покровська територіальна громада' })
    expect(feed.regions['9']).toMatchObject({ level: 2, scope: 'part' })
  })

  it('сусідній район області не чіпає', () => {
    // Заради цього все й затівалось: у прифронтовій області тривога майже
    // завжди є хоч десь, і школа в тихому районі не має її бачити.
    const feed = buildFeed(
      {
        alerts: [
          alert({
            location_uid: '353',
            location_type: 'hromada',
            location_oblast: 'Дніпропетровська область',
            location_title: 'Покровська територіальна громада',
          }),
        ],
      },
      now,
    )
    // 44 — Дніпровський район, інший кінець області.
    expect(feed.regions['44']).toBeUndefined()
  })

  it('кілька громад — найсуворіший рівень і найраніший початок', () => {
    const feed = buildFeed(
      {
        alerts: [
          alert({
            location_uid: '353',
            location_type: 'hromada',
            location_oblast: 'Дніпропетровська область',
            location_title: 'Покровська громада',
            alert_level: 'yellow',
            started_at: '2026-09-22T10:20:00Z',
          }),
          alert({
            location_uid: '356',
            location_type: 'hromada',
            location_oblast: 'Дніпропетровська область',
            location_title: 'Червоногригорівська громада',
            alert_level: 'red',
            started_at: '2026-09-22T10:05:00Z',
          }),
        ],
      },
      now,
    )
    expect(feed.regions['47']).toMatchObject({ level: 2, since: '2026-09-22T10:05:00Z' })
    expect(feed.regions['47'].where).toBe('Покровська громада, Червоногригорівська громада')
  })

  it('районів багато — називаємо два й «та інші»', () => {
    const hromada = (uid, title) =>
      alert({
        location_uid: uid,
        location_type: 'hromada',
        location_oblast: 'Дніпропетровська область',
        location_title: title,
      })
    const feed = buildFeed(
      { alerts: [hromada('351', 'Перша'), hromada('353', 'Друга'), hromada('356', 'Третя')] },
      now,
    )
    expect(feed.regions['47'].where).toBe('Перша, Друга та інші')
  })

  it('тривога по всьому району уточнення не потребує', () => {
    const feed = buildFeed(
      {
        alerts: [
          alert({
            location_uid: '47',
            location_type: 'raion',
            location_oblast: 'Дніпропетровська область',
            location_title: 'Нікопольський район',
          }),
        ],
      },
      now,
    )
    expect(feed.regions['47']).toEqual({ level: 1, since: '2026-09-22T10:05:00Z' })
    expect(feed.regions['9']).toMatchObject({ scope: 'part', where: 'Нікопольський район' })
  })

  it('тривога без рівня — це все одно тривога', () => {
    const feed = buildFeed(
      {
        alerts: [
          {
            location_uid: '13',
            location_type: 'oblast',
            location_title: 'Івано-Франківська область',
            alert_type: 'air_raid',
          },
        ],
      },
      now,
    )
    expect(feed.regions['13'].level).toBe(1)
  })

  it('артилерія й вуличні бої — не повітряна тривога', () => {
    const feed = buildFeed(
      {
        alerts: [
          alert({ location_uid: '23', location_type: 'oblast', alert_type: 'artillery_shelling' }),
          alert({ location_uid: '28', location_type: 'oblast', alert_type: 'urban_fights' }),
        ],
      },
      now,
    )
    expect(feed.regions).toEqual({})
  })

  it('завершена тривога не рахується', () => {
    const feed = buildFeed(
      {
        alerts: [
          alert({
            location_uid: '13',
            location_type: 'oblast',
            location_title: 'Івано-Франківська область',
            finished_at: '2026-09-22T10:30:00Z',
          }),
        ],
      },
      now,
    )
    expect(feed.regions).toEqual({})
  })

  it('невідоме місце не вигадує собі області', () => {
    const feed = buildFeed(
      { alerts: [alert({ location_uid: '999999', location_type: 'hromada', location_oblast: 'Небувалія' })] },
      now,
    )
    expect(feed.regions).toEqual({})
  })

  it('порожня відповідь — це тиша, а не помилка', () => {
    expect(buildFeed({}, now)).toEqual({ v: 1, at: now, regions: {} })
    expect(buildFeed(null, now)).toEqual({ v: 1, at: now, regions: {} })
  })
})
