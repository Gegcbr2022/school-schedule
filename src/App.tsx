import { useEffect, useMemo, useState } from 'react'
import { AllDaySheet } from './components/AllDaySheet'
import { BooksSheet } from './components/BooksSheet'
import { ClubsSheet } from './components/ClubsSheet'
import { DateStrip } from './components/DateStrip'
import {
  BooksIcon,
  CloseIcon,
  InfoIcon,
  MoonIcon,
  NoteIcon,
  SettingsIcon,
  ShareIcon,
  SunIcon,
  TeacherIcon,
} from './components/Icons'
import { LessonList } from './components/LessonList'
import { MenuSheet } from './components/MenuSheet'
import type { NoteTarget } from './components/NoteSheet'
import { NoteSheet } from './components/NoteSheet'
import { ProfileBar } from './components/ProfileBar'
import { SettingsSheet } from './components/SettingsSheet'
import { TasksSheet } from './components/TasksSheet'
import { SpecialCard, SpecialDayAgenda } from './components/SpecialCard'
import type { NextUp } from './components/StatusCard'
import { StatusCard } from './components/StatusCard'
import { TeachersSheet } from './components/TeachersSheet'
import { WeekSheet } from './components/WeekSheet'
import { SCHOOL_NAME } from './data/schedule'
import { specialDayOn } from './data/special'
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
import { haptic } from './lib/haptics'
import { isStandalone, useInstallPrompt, useNow, useTheme } from './lib/hooks'
import type { DisplayLesson, ViewMode } from './lib/lessons'
import {
  computeStatus,
  daysUntil,
  finishedCount,
  nextSchoolIso,
  offWeekNote,
} from './lib/lessons'
import type { Prefs } from './lib/prefs'
import { DAY_PERIOD, allNotes, getNote, setNote } from './lib/notes'
import { syncNotifications } from './lib/notifications'
import {
  DEFAULT_PREFS,
  activeProfile,
  clearPrefs,
  keepStorage,
  loadPrefs,
  pinTeacher,
  savePrefs,
  withProfile,
} from './lib/prefs'
import {
  ROLE_ALL_TITLE,
  clubsOn,
  lessonsOnly,
  profileClass,
  profileDay,
  profileName,
  profileSub,
  profileTeacher,
  withClubs,
} from './lib/profiles'

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
  const [teachersOpen, setTeachersOpen] = useState(false)
  const [weekOpen, setWeekOpen] = useState(false)
  const [tasksOpen, setTasksOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  /**
   * Звідки відкрито гуртки: з налаштувань чи дотиком по картці в дні.
   * Від цього залежить, куди повернутись, коли їх закрити.
   */
  const [clubsFrom, setClubsFrom] = useState<'settings' | 'day' | null>(null)
  const [allOpen, setAllOpen] = useState(false)
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
    const profile = activeProfile(active)
    const cls = profileClass(profile)
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

    // Учитель бачить свій день по всіх класах; учень — свій клас.
    const teacher = profileTeacher(profile)
    /** Уроки цього профілю плюс його гуртки — одним списком за часом. */
    const dayFor = (date: CalendarDate, dayIso: number, forWeek: typeof week, viewMode: ViewMode) =>
      withClubs(
        dayIso > 5 || specialDayOn(date)?.noLessons
          ? []
          : profileDay(profile, dayIso - 1, forWeek, viewMode),
        clubsOn(profile, dayIso, forWeek),
      )

    const lessons = dayFor(selected, selIso, week, mode)

    // Стан «що зараз» — завжди про сьогодні, незалежно від вибраного дня.
    const todayWeek = weekParity(addDays(today, 1 - todayIso))
    const todayLessons = dayFor(today, todayIso, todayWeek, 'my')

    // Найближчий навчальний день (для картки й переходу).
    const upcomingIso = nextSchoolIso(todayIso)
    const upcomingDate = addDays(today, daysUntil(todayIso, upcomingIso))
    const upcomingFirst =
      dayFor(
        upcomingDate,
        upcomingIso,
        weekParity(addDays(upcomingDate, 1 - upcomingIso)),
        'my',
      )[0] ?? null

    return {
      active,
      profile,
      cls,
      teacher,
      today,
      todayIso,
      selected,
      selIso,
      selWeekend,
      week,
      isToday,
      lessons,
      todayLessons,
      upcomingIso,
      upcomingDate,
      upcomingFirst,
      viewedSpecial,
      todaySpecial,
      currentWeek: todayWeek,
    }
    // Хвилини навмисно не в залежностях: розклад дня від них не залежить,
    // а перерахунок раз на пів хвилини змушував би заново будувати всі дні —
    // для вчителя це прохід по всіх 24 класах.
  }, [now.year, now.month, now.day, now.iso, picked, mode, prefs])

  /**
   * Що відбувається просто зараз — єдине, що змінюється з ходом часу.
   * `null` лише у справжній вихідний: у будній день без уроків картка
   * має сказати «уроків немає», а не «відпочивайте».
   */
  const status =
    view.todayIso > 5 && view.todayLessons.length === 0
      ? null
      : computeStatus(view.todayLessons, now.minutes)

  const alreadyOnUpcoming = dateKey(view.selected) === dateKey(view.upcomingDate)

  const nextUp: NextUp = {
    accusative: DAY_NAME_ACCUSATIVE[view.upcomingIso],
    nominative: DAY_NAME_LOWER[view.upcomingIso],
    lesson: view.upcomingFirst,
    onJump: alreadyOnUpcoming ? null : () => setPicked(view.upcomingDate),
  }

  // Лічильник — про уроки; гурток у «3 з 6 уроків» не рахується.
  const todaySchool = lessonsOnly(view.todayLessons)
  const done = finishedCount(todaySchool, now.minutes)
  const total = todaySchool.length
  const noSchool = view.selWeekend || Boolean(view.viewedSpecial?.noLessons)
  const skipped =
    mode === 'my' && !noSchool && !view.teacher
      ? offWeekNote(view.cls, view.selIso - 1, view.profile, view.week)
      : null
  const showTodayChip = !view.isToday
  /** Бічна картка «що зараз» стосується саме сьогодні — лише коли його й відкрито. */
  const showStatus = view.isToday
  /** Профілів кілька — з'являються і перемикач, і зведення по всіх одразу. */
  const many = view.active.profiles.length > 1

  const savePreferences = (next: Prefs) => {
    setPrefs(next)
    savePrefs(next)
  }

  const dateStr = dateKey(view.selected)
  /** До чого прив'язані нотатки — до профілю, а не до класу: клас можуть змінити. */
  const noteScope = view.profile.id
  // notesVersion у залежностях, щоб після збереження текст оновився.
  const noteFor = (period: number) => {
    void notesVersion
    return getNote({ classId: noteScope, date: dateStr, period })
  }
  /** Записані завдання: крапки в стрічці днів і лічильник на чіпі. */
  const tasks = useMemo(() => {
    void notesVersion
    const all = allNotes(noteScope)
    return {
      dates: new Set(all.map((note) => note.date)),
      // На чіпі — скільки ще попереду; минуле не смикає око щодня.
      ahead: all.filter((note) => note.date >= dateKey(view.today)).length,
    }
  }, [noteScope, notesVersion, view.today])

  const when = `${DAY_NAME[view.selIso]}, ${formatDateUk(view.selected)}`
  const openNote = (lesson: DisplayLesson) => setNoteTarget({ lesson, date: dateStr, when })
  /** Запис не до уроку, а до дня: чергування, прибирання, що взяти з собою. */
  const openDayNote = () => setNoteTarget({ date: dateStr, when })
  const dayNote = noteFor(DAY_PERIOD)
  /** До якого уроку відкрито редактор; 0 — нотатка на весь день. */
  const notePeriod = noteTarget?.lesson?.period ?? DAY_PERIOD

  useEffect(() => {
    if (prefs) syncNotifications(prefs, view.today, now.minutes)
  }, [prefs, view.today, now.minutes, notesVersion])

  return (
    <div className="app">
      <header className={stuck ? 'topbar topbar--stuck' : 'topbar'}>
        <div className="topbar__row">
          <button
            type="button"
            className="brand"
            onClick={() => setSettingsOpen(true)}
            aria-label={`Розклад: ${profileName(view.profile)}. Змінити`}
          >
            <span
              className={
                view.teacher || view.profile.name
                  ? 'brand__class brand__class--name'
                  : 'brand__class'
              }
            >
              {profileName(view.profile)}
            </span>
            <span className="brand__sub">{profileSub(view.profile)}</span>
          </button>

          <button
            type="button"
            className="iconbtn"
            onClick={() => setTeachersOpen(true)}
            aria-label="Вчителі"
          >
            <TeacherIcon />
          </button>

          {/*
            Карти кабінетів у шапці поки немає: номери в ній бета, а про
            заміни й позаурочні заходи розклад не знає — «вільний» означав
            би не те, що читається. Сам екран лишився в
            `components/RoomsSheet.tsx`: повернути його — це кнопка тут.
          */}

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

        <ProfileBar
          role={view.active.role}
          profiles={view.active.profiles}
          activeId={view.profile.id}
          onPick={(id) => savePreferences({ ...view.active, activeId: id })}
          onManage={() => setSettingsOpen(true)}
        />

        <DateStrip
          today={view.today}
          selected={view.selected}
          onSelect={setPicked}
          marked={tasks.dates}
        />
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

          {/* «Весь тиждень», а не «Тиждень»: поруч стоїть чіп парності («1 тиждень»). */}
          <button type="button" className="chip chip--button" onClick={() => setWeekOpen(true)}>
            Весь тиждень
          </button>

          {many && (
            <button type="button" className="chip chip--button" onClick={() => setAllOpen(true)}>
              {ROLE_ALL_TITLE[view.active.role]}
            </button>
          )}

          <button type="button" className="chip chip--button" onClick={() => setMenuOpen(true)}>
            Меню
          </button>

          {tasks.dates.size > 0 && (
            <button
              type="button"
              className="chip chip--button chip--task"
              onClick={() => setTasksOpen(true)}
            >
              Завдання
              {tasks.ahead > 0 && <span className="chip__count">{tasks.ahead}</span>}
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
                  status={status}
                  todayName={DAY_NAME[view.todayIso]}
                  nextUp={nextUp}
                  teacher={Boolean(view.teacher)}
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

            {/* Запис на цілий день — те, що не належить жодному уроку. */}
            <button
              type="button"
              className={dayNote ? 'daynote daynote--filled' : 'daynote'}
              onClick={openDayNote}
            >
              <NoteIcon />
              <span className="daynote__text">
                {dayNote || 'Нотатка на день — чергування, прибирання…'}
              </span>
            </button>

            {view.selWeekend && view.lessons.length === 0 ? (
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
            ) : (
              <>
                {/* Свято зі своїм планом дня; гуртки стануть під ним. */}
                {view.viewedSpecial?.noLessons ? (
                  <SpecialDayAgenda day={view.viewedSpecial} />
                ) : (
                  !view.teacher &&
                  !view.selWeekend && (
                    <div className="modeswitch" role="group" aria-label="Режим перегляду">
                      <button
                        type="button"
                        aria-pressed={mode === 'my'}
                        onClick={() => setMode('my')}
                      >
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
                  )
                )}

                {view.lessons.length > 0 ? (
                  <LessonList
                    lessons={view.lessons}
                    nowMin={view.isToday ? now.minutes : null}
                    noteFor={noteFor}
                    onOpenNote={openNote}
                    onOpenClub={() => setClubsFrom('day')}
                  />
                ) : (
                  !noSchool && (
                    <p className="empty">
                      {view.teacher
                        ? 'Цього дня уроків немає — день вільний.'
                        : 'Цього дня у вас уроків немає.'}
                    </p>
                  )
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
          {!view.teacher && view.cls.homeroom && (
            <>
              <br />
              Класний керівник: {view.cls.homeroom}
            </>
          )}
          <br />
          Час — київський.
        </footer>
      </main>

      {allOpen && (
        <AllDaySheet
          role={view.active.role}
          profiles={view.active.profiles}
          when={when}
          iso={view.selIso}
          week={view.week}
          noLessons={noSchool}
          nowMin={view.isToday ? now.minutes : null}
          onPick={(id) => {
            savePreferences({ ...view.active, activeId: id })
            setAllOpen(false)
          }}
          onClose={() => setAllOpen(false)}
        />
      )}

      {clubsFrom && (
        <ClubsSheet
          profile={view.profile}
          onSave={(clubs) => {
            // Перший гурток — це вже вкладена праця; просимо берегти сховище.
            if (clubs.length > 0) keepStorage()
            savePreferences(withProfile(view.active, { ...view.profile, clubs }))
          }}
          onClose={() => {
            const back = clubsFrom === 'settings'
            setClubsFrom(null)
            if (back) setSettingsOpen(true)
          }}
        />
      )}

      {tasksOpen && (
        <TasksSheet
          profile={view.profile}
          today={view.today}
          onOpenDay={(date) => {
            setPicked(date)
            setTasksOpen(false)
          }}
          onClose={() => setTasksOpen(false)}
        />
      )}

      {weekOpen && (
        <WeekSheet
          profile={view.profile}
          mode={mode}
          currentWeek={view.week}
          todayIso={view.todayIso <= 5 ? view.todayIso : undefined}
          todayWeek={view.currentWeek}
          onClose={() => setWeekOpen(false)}
        />
      )}

      {teachersOpen && (
        <TeachersSheet
          currentWeek={view.currentWeek}
          pinnedId={view.profile.teacherId}
          onPin={(teacherId) => savePreferences(pinTeacher(view.active, teacherId))}
          onClose={() => setTeachersOpen(false)}
        />
      )}

      {booksOpen && (
        <BooksSheet
          classId={view.cls.id}
          className={view.cls.name}
          teacher={view.teacher}
          onClose={() => setBooksOpen(false)}
        />
      )}

      {menuOpen && (
        <MenuSheet iso={view.selIso} date={dateStr} onClose={() => setMenuOpen(false)} />
      )}

      {noteTarget && (
        <NoteSheet
          target={noteTarget}
          // Простір ключів — той самий, що й при збереженні: у кожного
          // профілю він свій, інакше запис зберігся б в одного, а
          // відкрився порожнім в іншого.
          initial={getNote({ classId: noteScope, date: noteTarget.date, period: notePeriod })}
          onSave={(text) => {
            setNote({ classId: noteScope, date: noteTarget.date, period: notePeriod }, text)
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
          onClubs={() => {
            setSettingsOpen(false)
            setClubsFrom('settings')
          }}
          onClose={() => setSettingsOpen(false)}
          onReset={() => {
            // Питаємо, бо це стирає все: у батьків — профілі всіх дітей
            // разом із гуртками, у завуча — всі класи, за якими він
            // стежить. Прибирання одного профілю поруч підтвердження
            // просить, а це — більше за нього в кілька разів.
            if (!window.confirm('Скинути все? Профілі, гуртки й налаштування зникнуть.')) return
            haptic('warning')
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
