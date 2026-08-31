import { useEffect, useMemo, useState } from 'react'
import { BooksSheet } from './components/BooksSheet'
import { DayTabs } from './components/DayTabs'
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
import {
  DAY_NAME,
  DAY_NAME_ACCUSATIVE,
  DAY_NAME_LOWER,
  addDays,
  dateKey,
  formatDateUk,
  plural,
  weekParity,
} from './lib/clock'
import { isStandalone, useInstallPrompt, useNow, useTheme } from './lib/hooks'
import type { DisplayLesson, ViewMode } from './lib/lessons'
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
   * Вибраний день. `null` — тримаємось сьогоднішнього і самі переїжджаємо
   * через північ. `weekOffset` дозволяє зазирнути в наступний тиждень —
   * саме так працює перехід «Переглянути понеділок» у п'ятницю.
   */
  const [picked, setPicked] = useState<{ index: number; weekOffset: number } | null>(null)
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
    const todayIso = now.iso
    const weekend = todayIso > 5

    // Опорний тиждень: поточний, а на вихідних — уже наступний.
    // Перегляд наступного тижня (picked.weekOffset) зсуває і тиждень, і парність.
    const baseMonday = addDays(now, 1 - todayIso + (weekend ? 7 : 0))
    const monday = addDays(baseMonday, 7 * (picked?.weekOffset ?? 0))
    const week = weekParity(monday)

    const autoIndex = dayIndexOf(todayIso) ?? 0
    const dayIndex = picked?.index ?? autoIndex
    const date = addDays(monday, dayIndex)
    const isToday = !weekend && (picked?.weekOffset ?? 0) === 0 && dayIndex === autoIndex

    // Особливі дні (свята, лінійки) прив'язані до календарної дати
    // й перекривають звичайний розклад саме на цей день.
    const viewedSpecial = specialDayOn(date)
    const todaySpecial = specialDayOn(now)

    const lessons = viewedSpecial?.noLessons ? [] : buildDay(cls, dayIndex, active, mode, week)

    // Стан «що зараз» завжди особистий, навіть коли відкрито повний розклад.
    const todayIndex = dayIndexOf(todayIso)
    const todayLessons =
      todayIndex === null || todaySpecial?.noLessons
        ? []
        : buildDay(cls, todayIndex, active, 'my', week)
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
      viewedSpecial,
      todaySpecial,
      picked,
    }
  }, [now, picked, mode, prefs])

  // Найближчий навчальний день лежить у наступному тижні, якщо його номер
  // не пізніше сьогоднішнього (напр. п'ятниця → понеділок).
  const jumpWeekOffset =
    !view.weekend && view.upcomingIso <= view.todayIso ? 1 : 0
  const alreadyThere =
    view.dayIndex === view.upcomingIndex && (view.picked?.weekOffset ?? 0) === jumpWeekOffset

  const nextUp: NextUp = {
    accusative: DAY_NAME_ACCUSATIVE[view.upcomingIso],
    nominative: DAY_NAME_LOWER[view.upcomingIso],
    lesson: view.upcomingFirst,
    onJump: alreadyThere
      ? null
      : () => setPicked({ index: view.upcomingIndex, weekOffset: jumpWeekOffset }),
  }

  const done = finishedCount(view.todayLessons, now.minutes)
  const total = view.todayLessons.length
  const skipped =
    mode === 'my' ? offWeekNote(view.cls, view.dayIndex, view.active, view.week) : null
  const showTodayChip = !view.weekend && !view.isToday
  /** Бічна картка «що зараз» — для сьогодні, вихідних чи особливого дня. */
  const showStatus = view.isToday || view.weekend || view.todaySpecial !== null

  const savePreferences = (next: Prefs) => {
    setPrefs(next)
    savePrefs(next)
  }

  const dateStr = dateKey(view.date)
  // notesVersion у залежностях, щоб після збереження текст оновився.
  const noteFor = (period: number) => {
    void notesVersion
    return getNote({ classId: view.cls.id, date: dateStr, period })
  }
  const openNote = (lesson: DisplayLesson) =>
    setNoteTarget({
      lesson,
      date: dateStr,
      when: `${DAY_NAME[view.dayIndex + 1]}, ${formatDateUk(view.date)}`,
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

        <DayTabs
          active={view.dayIndex}
          todayIso={view.todayIso}
          onSelect={(index) => setPicked({ index, weekOffset: view.picked?.weekOffset ?? 0 })}
        />
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

          <span className="chip">
            {view.week} тиждень
            <span className="visually-hidden">
              {' '}
              — уроки «через тиждень» орієнтуються на це число
            </span>
          </span>

          {showTodayChip && (
            <button type="button" className="chip chip--button" onClick={() => setPicked(null)}>
              Сьогодні
            </button>
          )}
        </div>

        <div className={showStatus ? 'layout' : 'layout layout--solo'}>
          <div className="layout__aside">
            {view.todaySpecial ? (
              <SpecialCard day={view.todaySpecial} nowMin={now.minutes} />
            ) : (
              showStatus && (
                <StatusCard
                  status={view.status}
                  todayName={DAY_NAME[view.todayIso]}
                  nextUp={nextUp}
                />
              )
            )}
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

            {view.viewedSpecial?.noLessons ? (
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
