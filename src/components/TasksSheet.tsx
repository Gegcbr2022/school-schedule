import { useId, useMemo } from 'react'
import type { ClassTimetable, WeekParity } from '../data/schedule'
import type { CalendarDate } from '../lib/clock'
import {
  DAY_NAME,
  addDays,
  dateKey,
  formatDateUk,
  formatTime,
  isoOf,
  parseDateKey,
  plural,
  weekParity,
} from '../lib/clock'
import { useModal } from '../lib/hooks'
import { buildDay } from '../lib/lessons'
import type { SavedNote } from '../lib/notes'
import { DAY_PERIOD, allNotes } from '../lib/notes'
import type { Prefs } from '../lib/prefs'
import { buildTeacherDay } from '../lib/teacherSchedule'
import type { Teacher } from '../lib/teachers'
import { CloseIcon, NoteIcon } from './Icons'

type Props = {
  /** Простір ключів нотаток: клас або вчитель. */
  scope: string
  cls: ClassTimetable
  prefs: Prefs
  teacher?: Teacher
  today: CalendarDate
  /** Відкрити цей день у розкладі. */
  onOpenDay: (date: CalendarDate) => void
  onClose: () => void
}

type Entry = SavedNote & {
  date: string
  subject: string
  start: number | null
}

export function TasksSheet({
  scope,
  cls,
  prefs,
  teacher,
  today,
  onOpenDay,
  onClose,
}: Props) {
  const headingId = useId()
  const sheetRef = useModal(onClose)
  const todayKey = dateKey(today)

  /**
   * Нотатка знає лише дату й номер уроку — предмет дістаємо з розкладу
   * того дня. Якщо розклад відтоді змінився і уроку вже немає, запис усе
   * одно показуємо: викидати написане не можна.
   */
  const entries = useMemo<Entry[]>(() => {
    const cache = new Map<string, ReturnType<typeof buildDay>>()

    const dayOf = (key: string) => {
      const cached = cache.get(key)
      if (cached) return cached
      const date = parseDateKey(key)
      const iso = isoOf(date)
      if (iso > 5) return []
      const week: WeekParity = weekParity(addDays(date, 1 - iso))
      // Завжди «мій» розклад: запис особистий, і предмет має бути свій,
      // навіть якщо застосунок зараз відкрито в повному розкладі.
      const built = teacher
        ? buildTeacherDay(teacher, iso - 1, week)
        : buildDay(cls, iso - 1, prefs, 'my', week)
      cache.set(key, built)
      return built
    }

    return allNotes(scope).map((note) => {
      // Запис на весь день ні до якого уроку не прив'язаний.
      if (note.period === DAY_PERIOD) {
        return { ...note, subject: 'На весь день', start: null }
      }
      const lesson = dayOf(note.date).find((l) => l.period === note.period)
      return {
        ...note,
        subject: lesson ? lesson.items.map((i) => i.subject).join(' / ') : 'Урок',
        start: lesson ? lesson.start : null,
      }
    })
  }, [scope, cls, prefs, teacher])

  const upcoming = entries.filter((entry) => entry.date >= todayKey)
  const past = entries.filter((entry) => entry.date < todayKey).reverse()

  const byDate = (list: Entry[]) => {
    const groups = new Map<string, Entry[]>()
    for (const entry of list) {
      const group = groups.get(entry.date)
      if (group) group.push(entry)
      else groups.set(entry.date, [entry])
    }
    return [...groups.entries()]
  }

  const renderGroup = ([key, items]: [string, Entry[]]) => {
    const date = parseDateKey(key)
    const iso = isoOf(date)
    return (
      <section className="tasks__day" key={key}>
        <h3 className="tasks__date">
          <button type="button" className="linkbtn" onClick={() => onOpenDay(date)}>
            {key === todayKey ? 'Сьогодні' : DAY_NAME[iso]}, {formatDateUk(date)}
          </button>
        </h3>
        <ul className="tasks__list">
          {items.map((entry) => (
            <li className="task" key={entry.period}>
              <span className="task__when">
                {entry.period === DAY_PERIOD
                  ? 'День'
                  : entry.start === null
                    ? `${entry.period} урок`
                    : formatTime(entry.start)}
              </span>
              <span className="task__body">
                <span className="task__subject">{entry.subject}</span>
                <span className="task__text">{entry.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    )
  }

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
            Завдання
          </h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити">
            <CloseIcon />
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="empty">
            <NoteIcon />
            <br />
            Тут збереться все, що ви запишете до уроків. Торкніться картки уроку —
            і додайте домашнє завдання чи нагадування.
          </p>
        ) : (
          <>
            <p className="sheet__intro">
              {upcoming.length > 0
                ? `${upcoming.length} ${plural(upcoming.length, ['запис', 'записи', 'записів'])} попереду`
                : 'Попереду порожньо — усе позаду'}
              {past.length > 0 &&
                ` · ${past.length} ${plural(past.length, ['минулий', 'минулих', 'минулих'])}`}
            </p>

            {byDate(upcoming).map(renderGroup)}

            {past.length > 0 && (
              <details className="tasks__past">
                <summary>Раніше</summary>
                {byDate(past).map(renderGroup)}
              </details>
            )}
          </>
        )}

        <div className="sheet__actions">
          <button type="button" className="btn btn--wide" onClick={onClose}>
            Закрити
          </button>
        </div>
      </div>
    </div>
  )
}
