/**
 * Оновлення самого розкладу, окремо від оновлення застосунку.
 *
 * НАВІЩО ОКРЕМО. Розклад міняється серед навчального року: перенесли
 * урок, замінили вчителя, виклали нове меню. Раніше це означало зібрати
 * й викласти застосунок заново. Для сайту ще терпимо, для App Store — ні:
 * там кожна збірка чекає перевірки по кілька днів, а розклад потрібен
 * завтра вранці. Тому дані їдуть своїм шляхом: маленький JSON поруч із
 * застосунком, який можна замінити будь-якої миті.
 *
 * ЩО РОБИТЬ. Тихо питає сервер, чи немає свіжішого паку, і якщо є —
 * складає його до `localStorage`. На екран нічого не підставляє: пак,
 * на якому працює цей запуск, вибрано ще до першого малювання
 * (див. `data/pack.ts`). Новий застосується, коли сторінку буде
 * перечитано, — а перечитаємо ми її аж тоді, коли застосунок згорнуть.
 * Міняти розклад під руками в людини, яка саме на нього дивиться, гірше,
 * ніж показати старий ще хвилину.
 *
 * ЧОГО НЕ РОБИТЬ. Нічого не надсилає й ні про кого не звітує: це
 * звичайний GET статичного файла. Немає мережі — просто нічого не
 * стається, застосунок працює на тому, що вже має.
 */

import type { Pack } from '../data/pack'
import { PACK_KEY, isNewer, isPack, isRejected, pack } from '../data/pack'
import { reloadWhenIdle } from './update'

/** Раз на пів години — того ж порядку, що й перевірка версії застосунку. */
const CHECK_EVERY_MS = 30 * 60 * 1000

/**
 * Звідки брати пак. За замовчуванням — поруч із застосунком, тож на
 * GitHub Pages у підпапці, на власному домені й у рідній оболонці це
 * працює без налаштувань. `VITE_PACK_URL` потрібен лише тоді, коли дані
 * живуть на іншому домені, ніж застосунок, — наприклад, коли iOS-збірка
 * ходить по розклад на ваш VPS.
 */
function packUrl(): string {
  return import.meta.env.VITE_PACK_URL || `${import.meta.env.BASE_URL}data/school.json`
}

function store(fresh: Pack): void {
  try {
    localStorage.setItem(PACK_KEY, JSON.stringify(fresh))
  } catch {
    /* Немає місця або приватний режим — лишаємось на тому паку, що є. */
  }
}

/**
 * Одна перевірка. Повертає `true`, якщо збережено свіжіший пак.
 *
 * `cache: 'no-store'` навмисне: файл маленький, а піймати місячної
 * давнини копію з кеша саме тоді, коли розклад змінився, — рівно та
 * помилка, заради якої все це й робиться.
 */
export async function checkForFreshPack(): Promise<boolean> {
  try {
    const response = await fetch(packUrl(), { cache: 'no-store' })
    if (!response.ok) return false

    const parsed: unknown = await response.json()
    // Формат не той або дані зіпсовані — мовчки лишаємось на своєму.
    if (!isPack(parsed) || !isNewer(parsed, pack)) return false
    // На цій версії застосунок уже одного разу не піднявся. Скачати її
    // знову — означає зламатися вдруге, тож чекаємо наступної.
    if (isRejected(parsed.version)) return false

    store(parsed)
    return true
  } catch {
    return false
  }
}

/**
 * Стежити за розкладом, поки застосунок відкритий: одразу, при поверненні
 * на екран і раз на пів години.
 */
export function watchForFreshPack(): void {
  let pending = false

  const check = (): void => {
    if (pending || !navigator.onLine) return
    void checkForFreshPack().then((fresh) => {
      if (fresh) pending = true
    })
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      check()
      return
    }
    // Застосунок згорнули — найкращий момент перечитати сторінку:
    // людина повернеться вже з новим розкладом і нічого не помітить.
    if (!pending) return
    // Знімаємо прапорець одразу: інакше кожне наступне згортання вішало б
    // ще один відкладений перезапуск на ту саму подію.
    pending = false
    reloadWhenIdle()
  })

  window.setInterval(check, CHECK_EVERY_MS)
  check()
}
