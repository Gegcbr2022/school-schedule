import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const shell = 'https://example.test/school-schedule/'
const assets = [`${shell}assets/app.js`, `${shell}assets/app.css`, `${shell}assets/pdf.js`, `${shell}assets/pdf.worker.mjs`]

function worker({ failAsset = false } = {}) {
  const handlers = new Map()
  const entries = new Map()
  const key = (request) => typeof request === 'string' ? request : request.url
  const fetch = vi.fn(async (request) => new Response(`body:${key(request)}`))
  const cache = {
    match: vi.fn(async (request) => entries.get(key(request))?.clone()),
    async put(request, response) { entries.set(key(request), response.clone()) },
    async add(request) { entries.set(key(request), await fetch(request)) },
    async addAll(requests) {
      if (failAsset) throw new Error('An entry asset failed')
      for (const request of requests) await this.add(request)
    },
  }
  const skipWaiting = vi.fn()
  const deleteCache = vi.fn()
  const claim = vi.fn()
  runInNewContext(source.replace('const BUILD_ASSETS = []', `const BUILD_ASSETS = ${JSON.stringify(assets)}`), {
    self: { location: new URL(`${shell}sw.js`), addEventListener: (type, handler) => handlers.set(type, handler), skipWaiting, clients: { claim } },
    caches: { open: async () => cache, keys: async () => ['rozklad-books-v1', 'rozklad-shell-v4-old', 'rozklad-shell-v5-dev', 'other'], delete: deleteCache },
    Request: class extends Request { constructor(url, options) { super(new URL(url, shell), options) } },
    URL, Response, fetch,
  })
  async function lifecycle(type) {
    let pending
    handlers.get(type)({ waitUntil: (promise) => { pending = promise } })
    await pending
  }
  async function request(path, options = {}) {
    let response
    handlers.get('fetch')({
      request: { url: new URL(path, shell).href, method: 'GET', mode: 'navigate', ...options },
      respondWith: (value) => { response = value },
    })
    return await response
  }
  return { fetch, entries, cache, skipWaiting, claim, deleteCache, lifecycle, request }
}

describe('service worker', () => {
  it('перший візит зберігає HTML, JS, CSS і читалку PDF для офлайну', async () => {
    const sw = worker()
    await sw.lifecycle('install')
    expect(sw.entries.has(shell)).toBe(true)
    for (const asset of assets) expect(sw.entries.has(asset)).toBe(true)
    expect(sw.skipWaiting).toHaveBeenCalledOnce()
  })
  it('не активує неповний випуск без основних файлів', async () => {
    const sw = worker({ failAsset: true })
    await expect(sw.lifecycle('install')).rejects.toThrow('entry asset')
    expect(sw.skipWaiting).not.toHaveBeenCalled()
  })
  it('офлайн-скрипт не губиться через Vary: Origin у precache-відповіді', async () => {
    const sw = worker()
    await sw.lifecycle('install')
    sw.fetch.mockRejectedValue(new Error('offline'))
    expect((await sw.request('assets/app.js', { mode: 'cors' })).status).toBe(200)
    expect(sw.cache.match).toHaveBeenLastCalledWith(expect.objectContaining({ url: assets[0] }), { ignoreVary: true })
  })
  it('політика приватності не підміняє офлайн-розклад', async () => {
    const sw = worker()
    await sw.lifecycle('install')
    await sw.request('privacy.html')
    sw.fetch.mockRejectedValue(new Error('offline'))
    expect(await (await sw.request('./')).text()).toBe(`body:${shell}`)
    expect(await (await sw.request('privacy.html')).text()).toBe(`body:${shell}privacy.html`)
  })
  it('посилання з параметрами використовує головну офлайн-копію', async () => {
    const sw = worker()
    await sw.lifecycle('install')
    sw.fetch.mockRejectedValue(new Error('offline'))
    expect((await sw.request('?source=friend')).status).toBe(200)
    expect((await sw.request('index.html')).status).toBe(200)
  })
  it('збій сервера не перекриває справну збережену версію', async () => {
    const sw = worker()
    await sw.lifecycle('install')
    sw.fetch.mockResolvedValue(new Response('server error', { status: 503 }))
    expect(await (await sw.request('./')).text()).toBe(`body:${shell}`)
  })
  it('при оновленні зберігає скачані книжки й чужі кеші', async () => {
    const sw = worker()
    await sw.lifecycle('activate')
    expect(sw.deleteCache.mock.calls).toEqual([['rozklad-shell-v4-old']])
    expect(sw.claim).toHaveBeenCalledOnce()
  })
  it.each(['data/school.json', 'book.pdf', 'https://other.test/file'])('не перехоплює %s', async (url) => {
    expect(await worker().request(url, { mode: 'cors' })).toBeUndefined()
  })
  it('не перехоплює POST', async () => {
    expect(await worker().request('./', { method: 'POST' })).toBeUndefined()
  })
})
