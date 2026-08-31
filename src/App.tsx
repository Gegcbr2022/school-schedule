import { useEffect, useMemo, useState } from 'react'
import { BooksSheet } from './components/BooksSheet'
import { DateStrip } from './components/DateStrip'
import {
  BooksIcon,
  CloseIcon,
  InfoIcon,
  MoonIcon,
  SettingsIcon,
  ShareIcon,
  SunIcon,
} from './components/Icons'
import { LessonList } from './components/LessonList'
import type { NoteTarget } from './components/NoteSheet'
import { NoteSheet } from './components/NoteSheet'
import { SettingsSheet } from './components/SettingsSheet'
import { SpecialCard, SpecialDayAgenda } from './components/SpecialCard'
import type { NextUp } from './components/StatusCard'
import { StatusCard } from './components/StatusCard'
import { SCHOOL_NAME } from './data/schedule'
import { specialDayOn } from './data/special'
import { TIMETABLE } from './data/timetable'
import type { CalendarDate } from './lib/clock'
import {
  DAY_NAME,
  DAY_NAME_ACCUSATIVE,
  DAY_NAME_LOWER,
  addDays,
  dateKey,
  formatDateUk,
  isoOf,
  plural,
  weekParity,
} from './lib/clock'
import { isStandalone, useInstallPrompt, useNow, useTheme } from './lib/hooks'
import type { DisplayLesson, ViewMode } from './lib/lessons'
import {
  buildDay,
  classById,
  computeStatus,
  daysUntil,
  finishedCount,
  nextSchoolIso,
  offWeekNote,
} from './lib/lessons'
import type { Prefs } from './lib/prefs'
import { getNote, setNote } from './lib/notes'
import { DEFAULT_PREFS, clearPrefs, loadPrefs, savePrefs } from './lib/prefs'

const IS_IOS =
  /iP(hone|od|ad)/.test(navigator.userAgent) ||
  // iPadOS уже давно представляється як Macintosh — ловимо його по тачскріну.
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

export default function App() {
  const now = useNow()
  const { theme, resolved, setTheme } = useTheme()
  const { canInstall, install, dismiss } = useInstallPrompt()

  const [prefs, setPrefs] = useState<Prefs | null>(loadPrefs)
  const [mode, setMode] = useState<ViewMode>('my')
  /**
   * Вибрана дата. `null` — тримаємось сьогоднішнього дня і самі переїжджаємо
   * через північ. Дата дозволяє гортати будь-куди: вихідні, наступний тиждень.
   */
  const [picked, setPicked] = useState<CalendarDate | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [booksOpen, setBooksOpen] = useState(false)
  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null)
  /** Смикаємо, щоб перечитати нотатки з localStorage після збереження. */
  const [notesVersion, setNotesVersion] = useState(0)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const view = useMemo(() => {
    const active = prefs ?? DEFAULT_PREFS
    // Клас за замовчуванням може зникнути з даних — тоді беремо перший наявний.
    const cls = classById(active.classId) ?? classById(DEFAULT_PREFS.classId) ?? TIMETABLE[0]
    const today: CalendarDate = { year: now.year, month: now.month, day: now.day }
    const todayIso = now.iso

    // Що зараз відкрито — конкретна дата.
    const selected = picked ?? today
    const selIso = isoOf(selected)
    const selWeekend = selIso > 5
    const week = weekParity(addDays(selected, 1 - selIso))
    const isToday = dateKey(selected) === dateKey(today)

    // Особливі дні (свята, лінійки) прив'язані до календарної дати.
    const viewedSpecial = specialDayOn(selected)
    const todaySpecial = specialDayOn(today)

    const lessons =
      selWeekend || viewedSpecial?.noLessons
        ? []
        : buildDay(cls, selIso - 1, active, mode, week)

    // Стан «що зараз» — завжди про сьогодні, незалежно від вибраного дня.
    const todayWeekend = todayIso > 5
    const todayWeek = weekParity(addDays(today, 1 - todayIso))
    const todayLessons =
      todayWeekend || todaySpecial?.noLessons
        ? []
        : buildDay(cls, todayIso - 1, active, 'my', todayWeek)
    const status = todayWeekend ? null : computeStatus(todayLessons, now.minutes)

    // Найближчий навчальний день (для картки й переходу).
    const upcomingIso = nextSchoolIso(todayIso)
    const upcomingDate = addDays(today, daysUntil(todayIso, upcomingIso))
    const upcomingFirst =
      buildDay(cls, upcomingIso - 1, active, 'my', weekParity(addDays(upcomingDate, 1 - upcomingIso)))[0] ??
      null

    return {
      active,
      cls,
      today,
      todayIso,
      selected,
      selIso,
      selWeekend,
      week,
      isToday,
      lessons,
      status,
      todayLessons,
      upcomingIso,
      upcomingDate,
      upcomingFirst,
      viewedSpecial,
      todaySpecial,
    }
  }, [now, picked, mode, prefs])

  const alreadyOnUpcoming = dateKey(view.selected) === dateKey(view.upcomingDate)

  const nextUp: NextUp = {
    accusative: DAY_NAME_ACCUSATIVE[view.upcomingIso],
    nominative: DAY_NAME_LOWER[view.upcomingIso],
    lesson: view.upcomingFirst,
    onJump: alreadyOnUpcoming ? null : () => setPicked(view.upcomingDate),
  }

  const done = finishedCount(view.todayLessons, now.minutes)
  const total = view.todayLessons.length
  const skipped =
    mode === 'my' && !view.selWeekend
      ? offWeekNote(view.cls, view.selIso - 1, view.active, view.week)
      : null
  const showTodayChip = !view.isToday
  /** Бічна картка «що зараз» стосується саме сьогодні — лише коли його й відкрито. */
  const showStatus = view.isToday

  const savePreferences = (next: Prefs) => {
    setPrefs(next)
    savePrefs(next)
  }

  const dateStr = dateKey(view.selected)
  // notesVersion у залежностях, щоб після збереження текст оновився.
  const noteFor = (period: number) => {
    void notesVersion
    return getNote({ classId: view.cls.id, date: dateStr, period })
  }
  const openNote = (lesson: DisplayLesson) =>
    setNoteTarget({
      lesson,
      date: dateStr,
      when: `${DAY_NAME[view.selIso]}, ${formatDateUk(view.selected)}`,
    })

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
            onClick={() => setBooksOpen(true)}
            aria-label="Підручники"
          >
            <BooksIcon />
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

        <DateStrip today={view.today} selected={view.selected} onSelect={setPicked} />
      </header>

      <main>
        <div className="daymeta">
          <h1 className="daymeta__day">{DAY_NAME[view.selIso]}</h1>
          <p className="daymeta__date">{formatDateUk(view.selected)}</p>

          {view.isToday && total > 0 && (
            <span className="chip">
              {done} з {total} {plural(total, ['уроку', 'уроків', 'уроків'])}
            </span>
          )}

          {!view.selWeekend && (
            <span className="chip">
              {view.week} тиждень
              <span className="visually-hidden">
                {' '}
                — уроки «через тиждень» орієнтуються на це число
              </span>
            </span>
          )}

          {showTodayChip && (
            <button type="button" className="chip chip--button" onClick={() => setPicked(null)}>
              Сьогодні
            </button>
          )}
        </div>

        <div className={showStatus ? 'layout' : 'layout layout--solo'}>
          <div className="layout__aside">
            {showStatus &&
              (view.todaySpecial ? (
                <SpecialCard day={view.todaySpecial} nowMin={now.minutes} />
              ) : (
                <StatusCard
                  status={view.status}
                  todayName={DAY_NAME[view.todayIso]}
                  nextUp={nextUp}
                />
              ))}
          </div>

          <div className="layout__main">
            {canInstall && (
              <div className="install">
                <p className="install__text">
                  <b>Встановити застосунок</b>
                  <br />
                  Іконка на екрані, працює без інтернету.
                </p>
                <button type="button" className="btn" onClick={install}>
                  Встановити
                </button>
                <button
                  type="button"
                  className="iconbtn iconbtn--small"
                  onClick={dismiss}
                  aria-label="Не пропонувати встановлення"
                >
                  <CloseIcon />
                </button>
              </div>
            )}

            {view.selWeekend ? (
              <div className="weekend">
                <p className="weekend__title">{DAY_NAME[view.selIso]} — вихідний 🌤️</p>
                <div className="status__actions">
                  <button
                    type="button"
                    className="btn btn--wide"
                    onClick={() => {
                      const iso = nextSchoolIso(view.selIso)
                      setPicked(addDays(view.selected, daysUntil(view.selIso, iso)))
                    }}
                  >
                    Переглянути {DAY_NAME_ACCUSATIVE[nextSchoolIso(view.selIso)]}
                  </button>
                </div>
              </div>
            ) : view.viewedSpecial?.noLessons ? (
              <SpecialDayAgenda day={view.viewedSpecial} />
            ) : (
              <>
                <div className="modeswitch" role="group" aria-label="Режим перегляду">
                  <button type="button" aria-pressed={mode === 'my'} onClick={() => setMode('my')}>
                    Мій розклад
                  </button>
                  <button
                    type="button"
                    aria-pressed={mode === 'full'}
                    onClick={() => setMode('full')}
                  >
                    Повний розклад
                  </button>
                </div>

                {view.lessons.length > 0 ? (
                  <LessonList
                    lessons={view.lessons}
                    nowMin={view.isToday ? now.minutes : null}
                    noteFor={noteFor}
                    onOpenNote={openNote}
                  />
                ) : (
                  <p className="empty">Цього дня у вас уроків немає.</p>
                )}

                {skipped && (
                  <p className="hint">
                    <InfoIcon />
                    <span>{skipped}</span>
                  </p>
                )}
              </>
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

      {booksOpen && (
        <BooksSheet
          classId={view.cls.id}
          className={view.cls.name}
          onClose={() => setBooksOpen(false)}
        />
      )}

      {noteTarget && (
        <NoteSheet
          target={noteTarget}
          initial={getNote({
            classId: view.cls.id,
            date: noteTarget.date,
            period: noteTarget.lesson.period,
          })}
          onSave={(text) => {
            setNote(
              { classId: view.cls.id, date: noteTarget.date, period: noteTarget.lesson.period },
              text,
            )
            setNotesVersion((v) => v + 1)
          }}
          onClose={() => setNoteTarget(null)}
        />
      )}

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
