/**
 * Повітряна тривога.
 *
 * НАВІЩО ЦЕ В РОЗКЛАДІ. Тривога — єдине, що ламає розклад щодня. Вона
 * не переносить урок, вона забирає його середину: клас іде в укриття, і
 * питання «на який урок повертатись» стоїть щоразу заново. Відповідь на
 * нього застосунок уже може дати — розклад і дзвінки в нього є.
 *
 * ДВА РІВНІ. З 5 вересня 2026 року тривогу оголошують жовтим і червоним
 * рівнем (постанова КМУ №1092). Це не «слабше» й «сильніше», а різні
 * дії: на жовтому (загроза БпЛА) школа може працювати, якщо є укриття;
 * на червоному (ракетна небезпека) в укриття йдуть усі. Тому рівень
 * видно кольором, а не дрібним рядком. Відбій сирена більше не дає
 * зовсім — звідси й нагадування після нього.
 *
 * ЗВІДКИ ДАНІ. Не з alerts.in.ua напряму: їхній API потребує токена, а
 * токен у застосунку — це токен, вкритий у застосунку. Тому дані беруться
 * так само, як розклад: маленький статичний JSON поруч, який складає
 * наш власний Worker (`worker/`). Застосунок нічого не надсилає й ні про
 * кого не звітує — це звичайний GET.
 *
 * ЧОГО НЕМАЄ. Гарантії, що сповіщення прилетить за секунду. Поки
 * застосунок відкритий — питаємо самі; коли закритий, це робить
 * оболонка у фоні (`ios/App/Alerts.swift`), а час для фонових задач
 * роздає iOS і не за розкладом. Це підстраховка, а не сирена.
 */

export type AlertLevel = 0 | 1 | 2

export const ALERT_NONE: AlertLevel = 0
/** Жовтий: загроза БпЛА. */
export const ALERT_YELLOW: AlertLevel = 1
/** Червоний: ракетна небезпека, балістика, масований удар. */
export const ALERT_RED: AlertLevel = 2

export const ALERT_TITLE: Record<number, string> = {
  1: 'Жовтий рівень',
  2: 'Червоний рівень',
}

export const ALERT_DETAIL: Record<number, string> = {
  1: 'Загроза БпЛА',
  2: 'Ракетна небезпека — в укриття',
}

/** Стан одного регіону, як його віддає наш файл. */
type FeedEntry = {
  level: number
  /** Коли почалась, ISO. */
  since?: string
  /** `part` — тривога не по всій області, а в окремих районах. */
  scope?: string
  /** Де саме: «Івано-Франківський район, Калуський район». */
  where?: string
}

type Feed = {
  v: 1
  /** Коли дані востаннє складали, ISO. */
  at: string
  /** Лише ті регіони, де тривога справді є. */
  regions: Record<string, FeedEntry>
}

export type AlertState = {
  level: AlertLevel
  /** Коли почалась — мілісекунди від епохи, або `null`. */
  since: number | null
  /**
   * Де саме, якщо тривога не по всій області.
   *
   * У живих даних більшість тривог оголошують по районах, а не по
   * областях. Написати «тривога в Івано-Франківській області», коли
   * гуде лише у Верховинському районі, — це налякати пів краю й
   * привчити не вірити застосунку.
   */
  where: string | null
  /**
   * Коли ми востаннє змогли дізнатись стан. `null` — жодного разу.
   * Саме на цьому й тримається чесність: «тривоги немає» і «ми не
   * знаємо» — різні речі, і плутати їх не можна.
   */
  checked: number | null
}

export const NO_ALERT: AlertState = {
  level: ALERT_NONE,
  since: null,
  where: null,
  checked: null,
}

/**
 * Скільки даним можна вірити. Довше — і замість стану тривоги ми
 * показуємо здогад, який коштує дорожче за порожній екран.
 */
export const ALERT_STALE_MS = 5 * 60 * 1000

/** Дані є, але вони застарі: мережі немає довше, ніж можна мовчати. */
export function alertStale(state: AlertState, now = Date.now()): boolean {
  return state.checked === null || now - state.checked > ALERT_STALE_MS
}

/**
 * Звідки брати стан тривоги. Порожньо — можливості немає взагалі, і
 * застосунок про тривогу навіть не заїкається.
 */
export function alertsUrl(): string {
  return import.meta.env.VITE_ALERTS_URL ?? ''
}

export function alertsAvailable(): boolean {
  return alertsUrl() !== ''
}

function isFeed(value: unknown): value is Feed {
  if (typeof value !== 'object' || value === null) return false
  const it = value as Partial<Feed>
  return it.v === 1 && typeof it.at === 'string' && typeof it.regions === 'object'
}

function levelOf(raw: unknown): AlertLevel {
  // Рівня може не бути: поле нове, а тривога — стара. Тоді це звичайна
  // повітряна тривога, і мовчати про неї не можна.
  if (raw === 2) return ALERT_RED
  if (raw === 1 || raw === undefined || raw === null) return ALERT_YELLOW
  return typeof raw === 'number' && raw >= 2 ? ALERT_RED : ALERT_YELLOW
}

/** Стан одного регіону з готового документа. */
export function stateFor(feed: unknown, region: string, at: number): AlertState {
  if (!isFeed(feed)) return NO_ALERT
  const entry = feed.regions[region]
  if (!entry) return { level: ALERT_NONE, since: null, where: null, checked: at }

  const since = entry.since ? Date.parse(entry.since) : Number.NaN
  return {
    level: levelOf(entry.level),
    since: Number.isFinite(since) ? since : null,
    where: entry.scope === 'part' && entry.where ? entry.where : null,
    checked: at,
  }
}

/** Одне питання «як там зараз». `null` — не вийшло, стан лишається старий. */
export async function checkAlert(region: string): Promise<AlertState | null> {
  const url = alertsUrl()
  if (!url) return null

  try {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) return null
    return stateFor(await response.json(), region, Date.now())
  } catch {
    return null
  }
}

/* ── Місток до оболонки ──────────────────────────────────────────────── */

type Bridge = { postMessage: (value: unknown) => void }

function bridge(): Bridge | null {
  return (window.webkit?.messageHandlers?.alerts as Bridge | undefined) ?? null
}

/** Чи вміє оболонка стежити за тривогою у фоні. */
export function alertsWatchable(): boolean {
  return bridge() !== null && alertsAvailable()
}

export type AlertSettings = {
  enabled: boolean
  region: string
  onStart: boolean
  onEnd: boolean
  backToClass: boolean
  live: boolean
}

let lastSettings = ''

/**
 * Передати оболонці, за чим стежити у фоні.
 *
 * Адресу шлемо звідси, а не зашиваємо в Swift: джерело даних одне, і
 * розійтись вони не мають. Уроки оболонка й так знає — вони лежать у
 * знімку для віджетів.
 */
export function syncAlertSettings(settings: AlertSettings): void {
  const target = bridge()
  if (!target) return

  const message = { type: 'alerts', url: alertsUrl(), ...settings }
  const serialized = JSON.stringify(message)
  if (serialized === lastSettings) return

  try {
    target.postMessage(message)
    lastSettings = serialized
  } catch {
    /* Тривога не має ламати розклад. */
  }
}
