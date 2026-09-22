/**
 * Своя полиця: файли й посилання, які людина додала сама.
 *
 * НАВІЩО. Підручники класу застосунок знає, а конспект, робочий зошит,
 * методичку чи сфотографовану сторінку — ні. Вони живуть у чаті, в
 * «Файлах», у пошті й у галереї, тобто в п'яти різних місцях. Полиця
 * потрібна рівно для того, щоб усе, по що лізуть під час уроків, лежало
 * в одному.
 *
 * ДЕ ЦЕ ЛЕЖИТЬ. Байти — у тому самому Cache Storage, що й підручники
 * (`lib/library.ts`), під вигаданою адресою в зоні `.invalid`: вона
 * зарезервована й не резолвиться ніколи, тож ані в мережу за нею ніхто
 * не піде, ані з чужим файлом вона не зіткнеться. Завдяки цьому читалка,
 * «поділитися» й прибирання працюють із власним файлом так само, як із
 * підручником, — жодної окремої гілки в коді немає.
 *
 * Опис (назва, підпис, розмір) — у localStorage: його мало, він потрібен
 * миттєво й без нього список не намалювати.
 *
 * ЩО НІКУДИ НЕ ЙДЕ. Нічого. Файл не завантажується на сервер, бо сервера
 * немає; він лишається на пристрої так само, як нотатки й профілі.
 */

import { putBook, removeBook } from './library'

const KEY = 'rozklad:shelf:v1'

/** Більший файл у сховище браузера класти безглуздо — його виженуть. */
export const MAX_FILE_MB = 60

export type Material = {
  id: string
  title: string
  /** Підпис: «Алгебра», «Зошит», «Конспект за четвер». */
  note?: string
  /** `application/pdf`, `image/jpeg`… Порожньо — це посилання. */
  mime: string
  /** Байти файла; у посилання — 0. */
  size: number
  /** Коли додали, ISO. */
  addedAt: string
  /**
   * Зовнішнє посилання замість файла. Тоді байтів у сховищі немає, а
   * дотик просто відкриває адресу.
   */
  link?: string
}

/** Адреса, під якою байти лежать у полиці підручників. */
export function materialUrl(id: string): string {
  return `https://shelf.invalid/${id}`
}

function read(): Material[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isMaterial)
  } catch {
    return []
  }
}

function isMaterial(value: unknown): value is Material {
  if (typeof value !== 'object' || value === null) return false
  const it = value as Partial<Material>
  return typeof it.id === 'string' && typeof it.title === 'string'
}

function write(items: Material[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
    return true
  } catch {
    return false
  }
}

/** Усе, що на полиці, — свіже зверху. */
export function materials(): Material[] {
  return read().sort((a, b) => b.addedAt.localeCompare(a.addedAt))
}

/** Скільки місця займають власні файли, у байтах. */
export function shelfBytes(): number {
  return read().reduce((bytes, item) => bytes + item.size, 0)
}

/**
 * Ключ, якого ще немає. Час у ньому навмисно: він і сортує список, і
 * робить адресу файла унікальною без жодного лічильника.
 */
function nextId(taken: Set<string>): string {
  let id = `m${Date.now().toString(36)}`
  let n = 0
  while (taken.has(id)) {
    n += 1
    id = `m${Date.now().toString(36)}${n}`
  }
  return id
}

export type AddResult = { ok: true; item: Material } | { ok: false; why: string }

/** Додати файл із пристрою. */
export async function addFile(file: File, note?: string): Promise<AddResult> {
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return { ok: false, why: `Завеликий файл — більше ${MAX_FILE_MB} МБ телефон не збереже.` }
  }

  const items = read()
  const id = nextId(new Set(items.map((m) => m.id)))

  if (!(await putBook(materialUrl(id), file))) {
    return { ok: false, why: 'Не вдалося зберегти — найімовірніше, скінчилось місце.' }
  }

  const item: Material = {
    id,
    // Розширення в назві не потрібне: тип і так видно за значком.
    title: file.name.replace(/\.[^.]+$/, '') || 'Без назви',
    note: note?.trim() || undefined,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    addedAt: new Date().toISOString(),
  }

  if (!write([...items, item])) {
    // Опис не зберігся — байти без нього лише займають місце.
    await removeBook(materialUrl(id))
    return { ok: false, why: 'Не вдалося зберегти опис файла.' }
  }

  return { ok: true, item }
}

/** Додати посилання — на диск, на сайт видавництва, куди завгодно. */
export function addLink(title: string, link: string, note?: string): AddResult {
  const url = link.trim()
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, why: 'Посилання має починатися з http:// або https://' }
  }

  const items = read()
  const item: Material = {
    id: nextId(new Set(items.map((m) => m.id))),
    title: title.trim() || url.replace(/^https?:\/\//i, '').slice(0, 40),
    note: note?.trim() || undefined,
    mime: '',
    size: 0,
    addedAt: new Date().toISOString(),
    link: url,
  }

  if (!write([...items, item])) return { ok: false, why: 'Не вдалося зберегти.' }
  return { ok: true, item }
}

export async function removeMaterial(id: string): Promise<void> {
  const items = read()
  const victim = items.find((m) => m.id === id)
  write(items.filter((m) => m.id !== id))
  if (victim && !victim.link) await removeBook(materialUrl(id))
}

export function renameMaterial(id: string, title: string, note?: string): void {
  write(
    read().map((m) =>
      m.id === id ? { ...m, title: title.trim() || m.title, note: note?.trim() || undefined } : m,
    ),
  )
}

/**
 * Розмір файла так, як його читають: «70 Б», «340 КБ», «12.4 МБ».
 * Мегабайти з одним знаком після коми перетворюють дрібний конспект на
 * «0.0 МБ» — тобто на «нічого».
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} КБ`
  return `${(kb / 1024).toFixed(1)} МБ`
}

/** Чи це картинка — її показує не читалка PDF, а звичайний `img`. */
export function isImage(item: Material): boolean {
  return item.mime.startsWith('image/')
}
