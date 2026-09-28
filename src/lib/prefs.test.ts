import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFS, DEFAULT_PROFILE, clearPrefs, loadPrefs, nextProfileId, readClub, savePrefs } from './prefs'
import { isDateKey } from './clock'
import { getNote, setNote } from './notes'
import { profileDay, profileName, profileSub } from './profiles'

let data: Map<string, string>
beforeEach(() => {
  data = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('перевірка дат', () => {
  it.each(['2026-02-29', '2026-02-30', '2026-00-10', '2026-13-10', '2026-09-00', '2026-9-1', 'NaN-NaN-NaN', '', null])('відкидає %s', (date) => {
    expect(isDateKey(date)).toBe(false)
  })
  it.each(['2024-02-29', '2026-09-28', '2026-12-31'])('приймає %s', (date) => {
    expect(isDateKey(date)).toBe(true)
  })
})

describe('збережені профілі', () => {
  it('нова дитина не успадковує нотатки видаленого старого профілю', () => {
    const note = { classId: 'п2', date: '2026-09-28', period: 1 }
    setNote(note, 'Домашнє завдання попередньої дитини')
    // Другий профіль видалили, і в родині знову залишився один.
    const id = nextProfileId(DEFAULT_PREFS)
    expect(getNote({ ...note, classId: id })).toBe('')
    expect(getNote(note)).toBe('Домашнє завдання попередньої дитини')
  })
  it('не повторює ключ після видалення нового профілю й зберігає його без обрізання', () => {
    const firstId = nextProfileId(DEFAULT_PREFS)
    const note = { classId: firstId, date: '2026-09-28', period: 1 }
    setNote(note, 'Завдання видаленого профілю')
    const replacement = { ...DEFAULT_PROFILE, id: nextProfileId(DEFAULT_PREFS), name: 'Інша дитина' }
    savePrefs({ ...DEFAULT_PREFS, profiles: [DEFAULT_PROFILE, replacement], activeId: replacement.id })
    const restored = loadPrefs()!
    expect(restored.activeId).toBe(replacement.id)
    expect(restored.profiles[1].id).toBe(replacement.id)
    expect(getNote({ ...note, classId: restored.activeId })).toBe('')
    expect(getNote(note)).toBe('Завдання видаленого профілю')
  })
  it('зберігає всі профілі, групи, гуртки й активний профіль', () => {
    const prefs = { ...DEFAULT_PREFS, role: 'parent' as const, profiles: [DEFAULT_PROFILE, { ...DEFAULT_PROFILE, id: 'п2', name: 'Марія' }], activeId: 'п2' }
    savePrefs(prefs)
    expect(loadPrefs()).toEqual(prefs)
  })
  it('не губить дитину й її гуртки, коли клас зник зі свіжого паку', () => {
    const profile = { ...DEFAULT_PROFILE, id: 'п2', classId: 'old-class', clubs: [{ id: 'г1', name: 'Музика', days: [1], start: 600, end: 660 }] }
    savePrefs({ ...DEFAULT_PREFS, profiles: [profile], activeId: profile.id })
    expect(loadPrefs()?.profiles[0]).toMatchObject(profile)
  })
  it('після видалення активного профілю відкриває перший', () => {
    savePrefs({ ...DEFAULT_PREFS, activeId: 'removed' })
    expect(loadPrefs()?.activeId).toBe(DEFAULT_PROFILE.id)
  })
  it('зниклому класу не підставляє чужі уроки', () => {
    const profile = { ...DEFAULT_PROFILE, classId: 'old-class' }
    expect(profileDay(profile, 0, 1, 'my')).toEqual([])
    expect(profileName(profile)).toBe('Оберіть клас')
    expect(profileSub(profile)).toBe('Оновіть клас у налаштуваннях')
  })
  it('переносить ключ старого класу, під яким записані домашні завдання', () => {
    data.set('rozklad:prefs:v2', JSON.stringify({ classId: '10б', classGroup: '2', english: 'б' }))
    expect(loadPrefs()?.profiles[0]).toMatchObject({ id: '10б', classId: '10б', classGroup: '2', english: 'б' })
    expect(data.has('rozklad:prefs:v3')).toBe(true)
  })
  it('не вмикає тривоги чужого регіону замість зниклого вибраного', () => {
    savePrefs({ ...DEFAULT_PREFS, alerts: { ...DEFAULT_PREFS.alerts, enabled: true, region: 'removed' } })
    expect(loadPrefs()?.alerts.enabled).toBe(false)
  })
  it('залишає свідомо вибраний регіон увімкненим', () => {
    savePrefs({ ...DEFAULT_PREFS, alerts: { ...DEFAULT_PREFS.alerts, enabled: true } })
    expect(loadPrefs()?.alerts.enabled).toBe(true)
  })
  it('скидання налаштувань не стирає домашні завдання й матеріали', () => {
    savePrefs(DEFAULT_PREFS)
    data.set('rozklad:notes:v1', 'keep')
    data.set('rozklad:shelf:v1', 'keep')
    clearPrefs()
    expect(loadPrefs()).toBeNull()
    expect(data.get('rozklad:notes:v1')).toBe('keep')
    expect(data.get('rozklad:shelf:v1')).toBe('keep')
  })
})

describe('гуртки з імпорту й сховища', () => {
  const club = { id: 'г1', name: 'Музика', days: [1, 3], start: 600, end: 660 }
  it('не приймає дробовий день тижня', () => {
    expect(readClub({ ...club, days: [1.5] })).toBeNull()
    expect(readClub({ ...club, days: [1, 1, 3, 2.5] })?.days).toEqual([1, 3])
  })
  it('не округляє кінець заняття до неіснуючої 24:00', () => {
    expect(readClub({ ...club, end: 1439.8 })).toBeNull()
    expect(readClub({ ...club, start: 600.5 })).toBeNull()
  })
  it('не пропускає неіснуючі дати сезону й оплати', () => {
    const result = readClub({ ...club, from: '2026-02-30', to: '2026-13-01', paidUntil: '2026-00-01', skip: ['2026-02-30', '2026-09-28'] })
    expect(result?.from).toBeUndefined()
    expect(result?.to).toBeUndefined()
    expect(result?.paidUntil).toBeUndefined()
    expect(result?.skip).toEqual(['2026-09-28'])
  })
})
