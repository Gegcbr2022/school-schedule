/**
 * Тактильна відповідь на дотик.
 *
 * У браузері нічого не робить — і це навмисно. `navigator.vibrate` на
 * iOS немає взагалі, а там, де є, це вібромотор на весь телефон: для
 * перемикання дня в розкладі він завеликий і дратує. Справжній короткий
 * відгук уміє лише рідна оболонка (`ios/App/Haptics.swift`), тож туди
 * прохання й іде, а більше нікуди.
 */

type Haptic = 'selection' | 'light' | 'success' | 'warning'

type Bridge = { postMessage: (value: string) => void }

function bridge(): Bridge | null {
  return (window.webkit?.messageHandlers?.haptics as Bridge | undefined) ?? null
}

export function haptic(kind: Haptic): void {
  try {
    bridge()?.postMessage(kind)
  } catch {
    /* Відгук — приємність, а не робота. Мовчки обходимось без нього. */
  }
}

/**
 * Один слухач на весь застосунок замість виклику в кожній кнопці.
 *
 * Усі перемикачі — дні, «мій/повний», групи, профілі, тижні — підписані
 * `aria-pressed`, бо цього вимагає доступність. Виходить, що ознака
 * «тут міняють вибір» у розмітці вже є, і другої вигадувати не треба:
 * додався новий перемикач — він одразу з відгуком, нічого не забудеш.
 *
 * Слухаємо `pointerdown`, а не `click`: у рідних застосунках відгук
 * приходить під палець одразу, а не після відпускання.
 */
export function installHaptics(): void {
  if (!bridge()) return

  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target as Element | null
      if (target?.closest('[aria-pressed]')) haptic('selection')
    },
    { passive: true, capture: true },
  )
}
