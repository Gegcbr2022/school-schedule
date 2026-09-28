/**
 * Автооновлення застосунку.
 *
 * Встановлений PWA сам не перезавантажується: відкрита сторінка лишається
 * на тій версії, з якої стартувала, скільки б її не згортали. Тому питаємо
 * про оновлення самі — коли застосунок повертається на екран і раз на пів
 * години, — а коли новий service worker перебирає керування, перечитуємо
 * сторінку.
 *
 * Щоб браузер узагалі побачив нову версію, `sw.js` має відрізнятися від
 * попереднього: відбиток збірки в нього проставляє `vite.config.ts`.
 */

const CHECK_EVERY_MS = 30 * 60 * 1000

/** Поки відкрита шторка, людина щось робить — не смикаємо сторінку з-під рук. */
function busy(): boolean {
  return document.querySelector('[role="dialog"]') !== null
}

/**
 * Перечитати сторінку, але не з-під рук: поки відкрита шторка — чекаємо
 * її закриття. Згортання телефона не означає, що нотатку вже збережено.
 * Тим самим користується оновлення розкладу
 * (`packUpdate.ts`), тож правило «не смикати екран» одне на обидва випадки.
 */
let pendingReload: MutationObserver | null = null

export function reloadWhenIdle(): void {
  if (!busy()) {
    pendingReload?.disconnect()
    pendingReload = null
    window.location.reload()
    return
  }
  if (pendingReload) return
  pendingReload = new MutationObserver(() => {
    if (!busy()) reloadWhenIdle()
  })
  pendingReload.observe(document.body, { childList: true, subtree: true })
}

export function watchForUpdates(swUrl: string): void {
  if (!('serviceWorker' in navigator)) return

  // Перший візит: керування ще ні в кого не було, перезавантажуватись нема з чого.
  const hadController = navigator.serviceWorker.controller !== null

  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      const check = () => {
        if (navigator.onLine) void registration.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.setInterval(check, CHECK_EVERY_MS)

      let reloading = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return
        reloading = true
        reloadWhenIdle()
      })
    })
    .catch(() => {
      /* без офлайну теж жити можна */
    })
}
