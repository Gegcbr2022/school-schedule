import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PACK_KEY, SEED_PACK } from '../data/pack'
import { checkForFreshPack } from './packUpdate'

const fresh = { ...SEED_PACK, version: '2099-01-01T00:00' }
let setItem: ReturnType<typeof vi.fn>
beforeEach(() => {
  setItem = vi.fn()
  vi.stubGlobal('localStorage', { getItem: () => null, setItem })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => fresh }))
})
afterEach(() => vi.unstubAllGlobals())

describe('оновлення паку', () => {
  it('повідомляє про оновлення лише після успішного збереження', async () => {
    expect(await checkForFreshPack()).toBe(true)
    expect(setItem).toHaveBeenCalledWith(PACK_KEY, JSON.stringify(fresh))
  })
  it('не запускає нескінченні перезавантаження, коли сховище переповнено', async () => {
    setItem.mockImplementation(() => { throw new Error('QuotaExceededError') })
    expect(await checkForFreshPack()).toBe(false)
  })
  it('поточна версія не потребує оновлення', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => SEED_PACK }))
    expect(await checkForFreshPack()).toBe(false)
    expect(setItem).not.toHaveBeenCalled()
  })
  it('HTML замість паку або відсутність мережі не ламають розклад', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await checkForFreshPack()).toBe(false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ format: 1 }) }))
    expect(await checkForFreshPack()).toBe(false)
  })
})
