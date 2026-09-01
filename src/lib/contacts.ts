/**
 * Телефони вчителів — необов'язковий шматок даних.
 *
 * Файл `data/contacts.ts` не лежить у git: поки школа не дозволила
 * публікувати контакти, вони не мають потрапляти на GitHub Pages.
 * Тому підключаємо його не звичайним `import`, який зламав би збірку
 * без файла, а `import.meta.glob` — той просто нічого не знаходить.
 *
 * Немає файла — довідник показує вчителів без телефонів, і все.
 */

type ContactsModule = { PHONES?: Record<number, string> }

// eager: файл крихітний, а асинхронність тут нічого не дає.
const found = import.meta.glob<ContactsModule>('../data/contacts.ts', { eager: true })
const PHONES: Record<number, string> = Object.values(found)[0]?.PHONES ?? {}

/** Чи є в цій збірці телефони взагалі. */
export const HAS_CONTACTS = Object.keys(PHONES).length > 0

/** Телефон учителя у форматі `380XXXXXXXXX`, якщо він у цій збірці є. */
export function phoneOf(teacherId: number): string | undefined {
  return PHONES[teacherId]
}

/** `380954026416` → `+380 95 402 64 16`. Незнайомий формат лишаємо як є. */
export function formatPhone(phone: string): string {
  const m = /^380(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone)
  return m ? `+380 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone
}

export function telHref(phone: string): string {
  return `tel:+${phone}`
}
