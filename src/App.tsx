import { useEffect, useMemo, useState } from 'react'
import { DayTabs } from './components/DayTabs'
import { InfoIcon, MoonIcon, SettingsIcon, ShareIcon, SunIcon } from './components/Icons'
import { LessonList } from './components/LessonList'
import { SettingsSheet } from './components/SettingsSheet'
import type { NextUp } from './components/StatusCard'
import { StatusCard } from './components/StatusCard'
import type { DayId } from './data/schedule'
import { CLASS_NAME, SCHOOL_NAME } from './data/schedule'
import {
  DAY_NAME,
  DAY_NAME_ACCUSATIVE,
  DAY_NAME_LOWER,
  addDays,
  formatDateUk,
  plural,
  weekParity,
} from './lib/clock'
import { isStandalone, useInstallPrompt, useNow, useTheme } from './lib/hooks'
import type { ViewMode } from './lib/lessons'
import {
  buildDay,
  computeStatus,
  dayById,
  dayByIso,
  daysUntil,
  finishedCount,
  nextSchoolDay,
  offWeekNote,
} from './lib/lessons'
import type { Prefs } from './lib/prefs'
import { DEFAULT_PREFS, clearPrefs, loadPrefs, savePrefs } from './lib/prefs'

const IS_IOS =
  /iP(hone|od|ad)/.test(navigator.userAgent) ||
  // iPadOS уже давно представляється як Macintosh — ловимо його по тачскріну.
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

export default function App() {
  const now = useNow()
  const { theme, resolved, setTheme } = useTheme()
  const { canInstall, install } = useInstallPrompt()

  const [prefs, setPrefs] = useState<Prefs | null>(loadPrefs)
  const [mode, setMode] = useState<ViewMode>('my')
  /** `null` — тримаємось сьогоднішнього дня і самі переїжджаємо через північ. */
  const [picked, setPicked] = useState<DayId | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const view = useMemo(() => {
    const active = prefs ?? DEFAULT_PREFS
    const todayIso = now.iso
    const weekend = todayIso > 5

    // Опорний тиждень: поточний, а на вихідних — уже наступний.
    const monday = addDays(now, 1 - todayIso + (weekend ? 7 : 0))
    const week = weekParity(monday)

    const autoDay = dayByIso(todayIso) ?? nextSchoolDay(todayIso)
    const day = picked ? dayById(picked) : autoDay
    const date = addDays(monday, day.iso - 1)
    const isToday = !weekend && day.iso === todayIso

    const mine = buildDay(day, active, 'my', week)
    const lessons = mode === 'my' ? mine : buildDay(day, active, 'full', week)

    // Стан «що зараз» завжди особистий, навіть коли відкрито повний розклад.
    const todayDay = weekend ? null : dayByIso(todayIso)
    const todayLessons = todayDay ? buildDay(todayDay, active, 'my', week) : []
    const status = todayDay ? computeStatus(todayLessons, now.minutes) : null

    // Найближчий навчальний день може лежати вже в наступному тижні —
    // отже, і парність у нього своя.
    const upcoming = nextSchoolDay(todayIso)
    const upcomingDate = addDays(now, daysUntil(todayIso, upcoming.iso))
    const upcomingFirst =
      buildDay(upcoming, active, 'my', weekParity(upcomingDate))[0] ?? null

    return {
      active,
      todayIso,
      weekend,
      week,
      day,
      date,
      isToday,
      lessons,
      mine,
      status,
      todayLessons,
      upcoming,
      upcomingFirst,
    }
  }, [now, picked, mode, prefs])

  const nextUp: NextUp = {
    accusative: DAY_NAME_ACCUSATIVE[view.upcoming.iso],
    nominative: DAY_NAME_LOWER[view.upcoming.iso],
    lesson: view.upcomingFirst,
    onJump: view.day.id === view.upcoming.id ? null : () => setPicked(view.upcoming.id),
  }

  const done = finishedCount(view.todayLessons, now.minutes)
  const total = view.todayLessons.length
  const skipped = mode === 'my' ? offWeekNote(view.day, view.active, view.week) : null
  const showTodayChip = !view.weekend && !view.isToday

  const savePreferences = (next: Prefs) => {
    setPrefs(next)
    savePrefs(next)
  }

  return (
    <div className="app">
      <header className={stuck ? 'topbar topbar--stuck' : 'topbar'}>
        <div className="topbar__row">
          <div className="brand">
            <h1 className="brand__class">{CLASS_NAME}</h1>
            <p className="brand__sub">Розклад уроків</p>
          </div>

          <button
            type="button"
            className="iconbtn"
            onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
            aria-label={resolved === 'dark' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
          >
            {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          <button
            type="button"
            className="iconbtn"
            onClick={() => setSettingsOpen(true)}
            aria-label="Налаштування"
          >
            <SettingsIcon />
          </button>
        </div>

        <DayTabs active={view.day.id} todayIso={view.todayIso} onSelect={setPicked} />
      </header>

      <main>
        <div className="daymeta">
          <h2 className="daymeta__day">{DAY_NAME[view.day.iso]}</h2>
          <p className="daymeta__date">{formatDateUk(view.date)}</p>

          {view.isToday && total > 0 && (
            <span className="chip">
              {done} з {total} {plural(total, ['уроку', 'уроків', 'уроків'])}
            </span>
          )}

          <span className="chip" title="Уроки «через тиждень» орієнтуються на це число">
            {view.week} тиждень
          </span>

          {showTodayChip && (
            <button type="button" className="chip chip--button" onClick={() => setPicked(null)}>
              Сьогодні
            </button>
          )}
        </div>

        <div className="layout">
          <div className="layout__aside">
            {(view.isToday || view.weekend) && (
              <StatusCard
                status={view.status}
                todayName={DAY_NAME[view.todayIso]}
                nextUp={nextUp}
              />
            )}
          </div>

          <div className="layout__main">
            <div className="modeswitch" role="group" aria-label="Режим перегляду">
              <button type="button" aria-pressed={mode === 'my'} onClick={() => setMode('my')}>
                Мій розклад
              </button>
              <button type="button" aria-pressed={mode === 'full'} onClick={() => setMode('full')}>
                Повний розклад
              </button>
            </div>

            {view.lessons.length > 0 ? (
              <LessonList lessons={view.lessons} nowMin={view.isToday ? now.minutes : null} />
            ) : (
              <p className="empty">Цього дня у вас уроків немає.</p>
            )}

            {skipped && (
              <p className="hint">
                <InfoIcon />
                <span>{skipped}</span>
              </p>
            )}

            {canInstall && (
              <div className="install">
                <p className="install__text">Додайте розклад на головний екран — працює й без інтернету.</p>
                <button type="button" className="btn" onClick={install}>
                  Встановити
                </button>
              </div>
            )}

            {!canInstall && IS_IOS && !isStandalone() && (
              <p className="hint">
                <ShareIcon />
                <span>
                  Щоб застосунок жив на головному екрані: «Поділитися» → «На початковий екран».
                </span>
              </p>
            )}
          </div>
        </div>

        <footer className="appfooter">
          {SCHOOL_NAME}
          <br />
          Розклад дзвінків для 2–11 класів. Час — київський.
        </footer>
      </main>

      {(settingsOpen || prefs === null) && (
        <SettingsSheet
          mode={prefs === null ? 'onboarding' : 'settings'}
          prefs={view.active}
          theme={theme}
          onPrefs={savePreferences}
          onTheme={setTheme}
          onClose={() => setSettingsOpen(false)}
          onReset={() => {
            clearPrefs()
            setPrefs(null)
            setTheme('system')
            setSettingsOpen(false)
          }}
        />
      )}
    </div>
  )
}
