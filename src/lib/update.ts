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
 * Перечитати сторінку, але не з-під рук: поки відкрита шторка — чекаємо,
 * поки застосунок згорнуть. Тим самим користується оновлення розкладу
 * (`packUpdate.ts`), тож правило «не смикати екран» одне на обидва випадки.
 */
export function reloadWhenIdle(): void {
  // Застосунок уже не на екрані — перечитувати можна просто зараз, навіть
  // із відкритою шторкою: з-під рук ми нічого не смикаємо. Ця гілка тут не
  // для швидкості: нас часто й кличуть саме з обробника згортання, а
  // одноразовий слухач, доданий під час цієї ж події, на неї вже не
  // спрацює — і перезавантаження просто загубилося б.
  if (document.hidden || !busy()) {
    window.location.reload()
    return
  }
  // Дочекаємось, поки застосунок згорнуть, — відкриється вже нова версія.
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) window.location.reload()
    },
    { once: true },
  )
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
