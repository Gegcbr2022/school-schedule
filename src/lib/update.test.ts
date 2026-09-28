import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())

describe('оновлення без втрати незбереженого', () => {
  it.each([false, true])('не перечитує відкритий редактор, прихований застосунок = %s', async (hidden) => {
    vi.resetModules()
    let open = true
    let observeChange: () => void = () => {}
    const reload = vi.fn()
    const disconnect = vi.fn()
    const observe = vi.fn()
    vi.stubGlobal('document', { hidden, body: {}, querySelector: () => open ? {} : null })
    vi.stubGlobal('window', { location: { reload } })
    vi.stubGlobal('MutationObserver', class {
      constructor(callback: () => void) { observeChange = callback }
      observe = observe
      disconnect = disconnect
    })
    const { reloadWhenIdle } = await import('./update')
    reloadWhenIdle()
    reloadWhenIdle()
    expect(reload).not.toHaveBeenCalled()
    expect(observe).toHaveBeenCalledTimes(1)
    observeChange()
    expect(reload).not.toHaveBeenCalled()
    open = false
    observeChange()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalledTimes(1)
  })
  it('перечитує одразу, якщо жодного редактора немає', async () => {
    vi.resetModules()
    const reload = vi.fn()
    vi.stubGlobal('document', { querySelector: () => null })
    vi.stubGlobal('window', { location: { reload } })
    const { reloadWhenIdle } = await import('./update')
    reloadWhenIdle()
    expect(reload).toHaveBeenCalledOnce()
  })
})
