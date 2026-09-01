import { useId, useMemo, useState } from 'react'
import type { ClassTimetable, WeekParity } from '../data/schedule'
import { plural } from '../lib/clock'
import { useModal } from '../lib/hooks'
import type { ViewMode } from '../lib/lessons'
import { buildDay } from '../lib/lessons'
import type { Prefs } from '../lib/prefs'
import { buildTeacherDay, weekFrom } from '../lib/teacherSchedule'
import type { Teacher } from '../lib/teachers'
import { politeName } from '../lib/teachers'
import { CloseIcon } from './Icons'
import { WeekGrid } from './WeekGrid'

type Props = {
  cls: ClassTimetable
  prefs: Prefs
  mode: ViewMode
  /** Якщо стоїть — показуємо тиждень цього вчителя, а не класу. */
  teacher?: Teacher
  /** Парність поточного тижня — з неї й починаємо. */
  currentWeek: WeekParity
  /** Сьогоднішній день (ISO 1…5), щоб підсвітити; вихідні — не передавати. */
  todayIso?: number
  onClose: () => void
}

const DAYS = [0, 1, 2, 3, 4]

/**
 * Увесь тиждень одним екраном — те, чого в застосунку бракувало найбільше:
 * у стрічці днів видно лише один день за раз, а планують тиждень.
 */
export function WeekSheet({
  cls,
  prefs,
  mode,
  teacher,
  currentWeek,
  todayIso,
  onClose,
}: Props) {
  const headingId = useId()
  const sheetRef = useModal(onClose)
  const [week, setWeek] = useState<WeekParity>(currentWeek)

  const days = useMemo(
    () =>
      weekFrom(
        DAYS.map((day) =>
          teacher
            ? buildTeacherDay(teacher, day, week)
            : buildDay(cls, day, prefs, mode, week),
        ),
      ),
    [cls, prefs, mode, teacher, week],
  )

  const lessons = days.reduce((n, day) => n + day.count, 0)
  const windows = days.reduce((n, day) => n + day.windows, 0)

  return (
    <div
      className="sheet-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="sheet"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
      >
        <div className="sheet__grip" aria-hidden="true" />

        <div className="sheet__head">
          <h2 className="sheet__title" id={headingId}>
            Тиждень
          </h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити">
            <CloseIcon />
          </button>
        </div>

        <p className="sheet__intro">
          {teacher ? politeName(teacher) : cls.name}
          {!teacher && mode === 'full' && ' · усі групи'} · {lessons}{' '}
          {plural(lessons, ['урок', 'уроки', 'уроків'])}
          {windows > 0 && (
            <>
              {' '}
              · {windows} {plural(windows, ['вікно', 'вікна', 'вікон'])}
            </>
          )}
        </p>

        <div className="modeswitch" role="group" aria-label="Тиждень">
          <button type="button" aria-pressed={week === 1} onClick={() => setWeek(1)}>
            1 тиждень
          </button>
          <button type="button" aria-pressed={week === 2} onClick={() => setWeek(2)}>
            2 тиждень
          </button>
        </div>

        <WeekGrid days={days} todayIso={week === currentWeek ? todayIso : undefined} />

        <div className="sheet__actions">
          <button type="button" className="btn btn--wide" onClick={onClose}>
            Закрити
          </button>
        </div>
      </div>
    </div>
  )
}
