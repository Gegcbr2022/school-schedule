/**
 * Підручники, збережені на пристрій.
 *
 * Кладемо їх у власний Cache Storage — окремо від кешу застосунку, щоб
 * важкі PDF не змішувалися з оболонкою і їх можна було видалити разом.
 * Читаємо звідти ж, тому збережена книжка відкривається і без інтернету.
 */

const CACHE = 'rozklad-books-v1'

/** Cache Storage немає в незахищеному контексті та в деяких приватних режимах. */
function available(): boolean {
  return typeof caches !== 'undefined'
}

async function open(): Promise<Cache | null> {
  if (!available()) return null
  try {
    return await caches.open(CACHE)
  } catch {
    return null
  }
}

/** Адреси книжок, які вже лежать на пристрої. */
export async function savedUrls(): Promise<Set<string>> {
  const cache = await open()
  if (!cache) return new Set()
  try {
    const keys = await cache.keys()
    return new Set(keys.map((r) => r.url))
  } catch {
    return new Set()
  }
}

/**
 * Завантажує книжку на пристрій.
 *
 * Для файлу з чужого домену потрібні CORS-заголовки — інакше відповідь
 * непрозора, і прочитати її ми вже не зможемо. Тому такі не зберігаємо,
 * а чесно повідомляємо, що не вийшло.
 */
export async function saveBook(url: string): Promise<boolean> {
  const cache = await open()
  if (!cache) return false

  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (!response.ok || response.type === 'opaque') return false
    await cache.put(url, response)
    return true
  } catch {
    return false
  }
}

export async function removeBook(url: string): Promise<void> {
  const cache = await open()
  if (!cache) return
  try {
    await cache.delete(url)
  } catch {
    /* не видалилось — не біда */
  }
}

/**
 * Байти збереженої книжки, або `null`, якщо її на пристрої немає.
 * Саме з них читалка малює сторінки, коли інтернету нема.
 */
export async function bookBytes(url: string): Promise<ArrayBuffer | null> {
  const cache = await open()
  if (!cache) return null

  try {
    const hit = await cache.match(url)
    return hit ? await hit.arrayBuffer() : null
  } catch {
    return null
  }
}

/** Скільки місця займають збережені книжки, у мегабайтах. */
export async function librarySize(): Promise<number> {
  const cache = await open()
  if (!cache) return 0
  try {
    const keys = await cache.keys()
    let bytes = 0
    for (const key of keys) {
      const response = await cache.match(key)
      if (response) bytes += (await response.clone().blob()).size
    }
    return bytes / 1024 / 1024
  } catch {
    return 0
  }
}
