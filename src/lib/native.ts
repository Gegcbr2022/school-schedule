/**
 * Чи працюємо ми всередині рідної оболонки (зараз — iOS, див. `ios/`).
 *
 * Прапорець ставить сама оболонка ще до першого скрипта сторінки
 * (`WebHost.swift`), тож він доступний одразу й не вимагає ані опитування
 * user-agent, ані здогадів.
 *
 * Потрібен у трьох місцях, і скрізь з однієї причини — у застосунку
 * браузерних механізмів або немає, або вони зайві: не пропонуємо
 * «додати на початковий екран», не реєструємо service worker (оновлення
 * приходять із App Store), не малюємо підказку про «Поділитися».
 */

declare global {
  interface Window {
    __native?: { platform: 'ios' }
    webkit?: {
      messageHandlers?: Record<string, { postMessage: (value: unknown) => void }>
    }
  }
}

export function isNative(): boolean {
  return typeof window !== 'undefined' && window.__native !== undefined
}
