import { useCallback, useEffect, useState } from 'react'
import type { KyivTime } from './clock'
import { kyivNow } from './clock'
import type { Theme } from './prefs'
import { loadTheme, saveTheme } from './prefs'

/**
 * Київський час, який сам оновлюється.
 *
 * Раз на пів хвилини достатньо: у нас хвилинна точність. Додатково
 * перечитуємо час, коли вкладка знову стає видимою — інакше телефон,
 * який пролежав у кишені всю ніч, показав би вчорашній день.
 */
export function useNow(intervalMs = 30_000): KyivTime {
  const [now, setNow] = useState<KyivTime>(() => kyivNow())

  useEffect(() => {
    const tick = () => setNow(kyivNow())
    const id = window.setInterval(tick, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', tick)
    window.addEventListener('pageshow', tick)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', tick)
      window.removeEventListener('pageshow', tick)
    }
  }, [intervalMs])

  return now
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

export type ResolvedTheme = 'light' | 'dark'

/** Тема: вибір користувача + те, що з нього вийшло після системних налаштувань. */
export function useTheme(): {
  theme: Theme
  resolved: ResolvedTheme
  setTheme: (theme: Theme) => void
} {
  const [theme, setThemeState] = useState<Theme>(loadTheme)
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia(DARK_QUERY).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved: ResolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
    // Колір системної панелі в standalone-режимі має збігатися з фоном сторінки.
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', resolved === 'dark' ? '#0d0f14' : '#f4f5f7')
  }, [resolved])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    saveTheme(next)
  }, [])

  return { theme, resolved, setTheme }
}

type InstallEvent = Event & { prompt: () => Promise<void> }

/** Чи запущені ми як встановлений застосунок. */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari до сьогодні тримає це у власній нестандартній властивості.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * Кнопка «Встановити» з'являється лише там, де браузер справді пропонує
 * встановлення, і зникає назавжди після встановлення.
 */
export function useInstallPrompt(): { canInstall: boolean; install: () => void } {
  const [event, setEvent] = useState<InstallEvent | null>(null)

  useEffect(() => {
    if (isStandalone()) return

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallEvent)
    }
    const onInstalled = () => setEvent(null)

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(() => {
    if (!event) return
    void event.prompt()
    setEvent(null)
  }, [event])

  return { canInstall: event !== null, install }
}
