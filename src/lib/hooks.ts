import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { KyivTime } from './clock'
import { kyivNow } from './clock'
import type { Theme } from './prefs'
import { loadTheme, saveTheme } from './prefs'

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'

/**
 * Робить із контейнера повноцінну модалку:
 *   · переводить фокус усередину при відкритті;
 *   · тримає Tab у межах модалки (не пускає на закриту сторінку позаду);
 *   · повертає фокус на кнопку, що її відкрила, при закритті;
 *   · закриває на Escape.
 *
 * Повертає ref, який треба повісити на корінь модалки.
 */
export function useModal(onClose: () => void): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const root = ref.current
    // Фокус на сам контейнер (він має tabIndex={-1}), а не на перше поле:
    // інакше на iOS одразу вискакувала б клавіатура ще до анімації появи.
    root?.focus()

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !root) return

      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === root,
      )
      if (items.length === 0) return
      const edge = event.shiftKey ? items[0] : items[items.length - 1]
      if (document.activeElement === edge || !root.contains(document.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? items[items.length - 1] : items[0]).focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
      // Повертаємо фокус туди, звідки прийшли, — інакше він завис би в нікуди.
      opener?.focus?.()
    }
  }, [onClose])

  return ref
}

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

/**
 * Висота екранної клавіатури в пікселях (0 — клавіатури немає).
 *
 * На iOS у standalone-режимі layout-viewport не стискається під клавіатуру,
 * тож нижній аркуш ховається за нею. Рахуємо різницю через visualViewport
 * і піднімаємо аркуш на цю висоту.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return inset
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

declare global {
  interface Window {
    /** Подія встановлення, спіймана інлайновим скриптом в index.html. */
    __installPrompt?: InstallEvent | null
  }
}

const DISMISSED_KEY = 'rozklad:install-dismissed:v1'

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
 * встановлення, і зникає після встановлення або після того, як її закрили.
 *
 * Саму подію ловить інлайновий скрипт у index.html: Chrome кидає її ще до
 * того, як React змонтується, а отримати її пізніше вже не можна.
 */
export function useInstallPrompt(): {
  canInstall: boolean
  install: () => void
  dismiss: () => void
} {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (isStandalone()) return

    const pick = () => setEvent(window.__installPrompt ?? null)
    // Подія могла впасти ще до монтування — забираємо притримане.
    pick()

    const onInstalled = () => {
      window.__installPrompt = null
      setEvent(null)
    }

    window.addEventListener('installpromptready', pick)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('installpromptready', pick)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(() => {
    if (!event) return
    void event.prompt()
    // Одну й ту саму подію двічі показати не можна.
    window.__installPrompt = null
    setEvent(null)
  }, [event])

  const dismiss = useCallback(() => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      /* не збереглось — покажемо ще раз наступного разу */
    }
  }, [])

  return { canInstall: event !== null && !dismissed, install, dismiss }
}
