import { useEffect, useMemo, useState } from 'react'
import { DayTabs } from './components/DayTabs'
import { InfoIcon, MoonIcon, SettingsIcon, ShareIcon, SunIcon } from './components/Icons'
import { LessonList } from './components/LessonList'
import { SettingsSheet } from './components/SettingsSheet'
import type { NextUp } from './components/StatusCard'
import { StatusCard } from './components/StatusCard'
import { SCHOOL_NAME } from './data/schedule'
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
  classById,
  computeStatus,
  dayIndexOf,
  daysUntil,
  finishedCount,
  nextSchoolIso,
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
  const [picked, setPicked] = useState<number | null>(null)
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
    const cls = classById(active.classId) ?? classById(DEFAULT_PREFS.classId)!
    const todayIso = now.iso
    const weekend = todayIso > 5

    // Опорний тиждень: поточний, а на вихідних — уже наступний.
    const monday = addDays(now, 1 - todayIso + (weekend ? 7 : 0))
    const week = weekParity(monday)

    const autoIndex = dayIndexOf(todayIso) ?? 0
    const dayIndex = picked ?? autoIndex
    const date = addDays(monday, dayIndex)
    const isToday = !weekend && dayIndex === autoIndex

    const lessons = buildDay(cls, dayIndex, active, mode, week)

    // Стан «що зараз» завжди особистий, навіть коли відкрито повний розклад.
    const todayIndex = dayIndexOf(todayIso)
    const todayLessons =
      todayIndex === null ? [] : buildDay(cls, todayIndex, active, 'my', week)
    const status = todayIndex === null ? null : computeStatus(todayLessons, now.minutes)

    // Найближчий навчальний день може лежати вже в наступному тижні —
    // отже, і парність у нього своя.
    const upcomingIso = nextSchoolIso(todayIso > 5 ? 7 : todayIso)
    const upcomingIndex = dayIndexOf(upcomingIso) ?? 0
    const upcomingDate = addDays(now, daysUntil(todayIso, upcomingIso))
    const upcomingFirst =
      buildDay(cls, upcomingIndex, active, 'my', weekParity(upcomingDate))[0] ?? null

    return {
      active,
      cls,
      todayIso,
      weekend,
      week,
      dayIndex,
      date,
      isToday,
      lessons,
      status,
      todayLessons,
      upcomingIso,
      upcomingIndex,
      upcomingFirst,
    }
  }, [now, picked, mode, prefs])

  const nextUp: NextUp = {
    accusative: DAY_NAME_ACCUSATIVE[view.upcomingIso],
    nominative: DAY_NAME_LOWER[view.upcomingIso],
    lesson: view.upcomingFirst,
    onJump:
      view.dayIndex === view.upcomingIndex ? null : () => setPicked(view.upcomingIndex),
  }

  const done = finishedCount(view.todayLessons, now.minutes)
  const total = view.todayLessons.length
  const skipped =
    mode === 'my' ? offWeekNote(view.cls, view.dayIndex, view.active, view.week) : null
  const showTodayChip = !view.weekend && !view.isToday
  /** Що зараз — має сенс лише для сьогоднішнього дня або вихідних. */
  const showStatus = view.isToday || view.weekend

  const savePreferences = (next: Prefs) => {
    setPrefs(next)
    savePrefs(next)
  }

  return (
    <div className="app">
      <header className={stuck ? 'topbar topbar--stuck' : 'topbar'}>
        <div className="topbar__row">
          <button
            type="button"
            className="brand"
            onClick={() => setSettingsOpen(true)}
            aria-label={`Клас ${view.cls.name}. Змінити клас`}
          >
            <span className="brand__class">{view.cls.name}</span>
            <span className="brand__sub">Розклад уроків</span>
          </button>

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

        <DayTabs active={view.dayIndex} todayIso={view.todayIso} onSelect={setPicked} />
      </header>

      <main>
        <div className="daymeta">
          <h1 className="daymeta__day">{DAY_NAME[view.dayIndex + 1]}</h1>
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

        <div className={showStatus ? 'layout' : 'layout layout--solo'}>
          <div className="layout__aside">
            {showStatus && (
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
                <p className="install__text">
                  Додайте розклад на головний екран — працює й без інтернету.
                </p>
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
          {view.cls.homeroom && (
            <>
              <br />
              Класний керівник: {view.cls.homeroom}
            </>
          )}
          <br />
          Час — київський.
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
