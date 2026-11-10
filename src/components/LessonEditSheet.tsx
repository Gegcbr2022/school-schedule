import { useId, useMemo, useState } from 'react'
import type { ClassTimetable, WeekParity } from '../data/schedule'
import { BELLS, PERIODS, SUBJECTS } from '../data/schedule'
import { DAY_NAME, formatTime } from '../lib/clock'
import type { LessonEdit, Place } from '../lib/edits'
import { revertEdit, saveLesson, weekOnly } from '../lib/edits'
import { haptic } from '../lib/haptics'
import { useBackdropClose, useKeyboardInset, useModal } from '../lib/hooks'
import type { DisplayLesson } from '../lib/lessons'
import type { Profile } from '../lib/prefs'
import { profileDay } from '../lib/profiles'
import { scheduleName, scheduleTeachers } from '../lib/teachers'
import { CloseIcon } from './Icons'

type Props = {
  profile: Profile
  cls: ClassTimetable
  week: WeekParity
  /** День, 0 (Пн) … 4 (Пт), з якого відкрили. */
  day: number
  /** Урок, який правимо; немає — додаємо новий. */
  lesson?: DisplayLesson
  onSave: (edits: LessonEdit[]) => void
  onClose: () => void
}

/**
 * Виправити урок самому: предмет, кабінет, учитель, коли він — або
 * прибрати його зовсім. Правка лишається на пристрої, у «моєму»
 * розкладі (`lib/edits.ts`).
 */
export function LessonEditSheet({ profile, cls, week, day, lesson, onSave, onClose }: Props) {
  const headingId = useId()
  const subjectsId = useId()
  const teachersId = useId()
  const sheetRef = useModal(onClose)
  const backdrop = useBackdropClose(onClose)
  const keyboard = useKeyboardInset()

  const first = lesson?.items[0]
  const [subject, setSubject] = useState(first?.subject ?? '')
  const [room, setRoom] = useState(first?.room ?? '')
  const [teacher, setTeacher] = useState(first?.teacher ?? '')
  const [d, setD] = useState(day)
  const [p, setP] = useState(() => {
    if (lesson) return lesson.period
    // Новий урок — одразу після останнього: так його найчастіше й додають.
    const last = profileDay(profile, day, week, 'my').at(-1)
    return last ? Math.min(last.period + 1, PERIODS.length) : 1
  })

  const subjects = useMemo(
    () => [...new Set(Object.values(SUBJECTS))].sort((a, b) => a.localeCompare(b, 'uk')),
    [],
  )
  const teachers = useMemo(() => scheduleTeachers().map(scheduleName), [])

  /** Що вже стоїть у вибраний день — щоб урок не ліг поверх іншого наосліп. */
  const taken = useMemo(
    () =>
      new Map(
        profileDay(profile, d, week, 'my').map((l) => [
          l.period,
          l.items.map((i) => i.subject).join(' / '),
        ]),
      ),
    [profile, d, week],
  )
  const from: Place | null = lesson ? { d: day, p: lesson.period } : null
  const takenBy = (period: number) =>
    from && from.d === d && from.p === period ? undefined : taken.get(period)

  const commit = (edits: LessonEdit[]) => {
    haptic('success')
    onSave(edits)
    onClose()
  }

  const save = () => {
    // «каб. 12» і «12» — одне й те саме; «каб.» картка допише сама.
    const r = room.trim().replace(/^каб\.?\s*/i, '')
    const t = teacher.trim()
    commit(
      saveLesson(profile.edits, cls, profile, week, from, { d, p }, {
        subject: subject.trim(),
        ...(r ? { room: r } : {}),
        ...(t ? { teacher: t } : {}),
      }),
    )
  }

  return (
    <div className="sheet-backdrop" style={{ paddingBottom: keyboard }} {...backdrop}>
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
            {lesson ? 'Виправити урок' : 'Додати урок'}
          </h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити">
            <CloseIcon />
          </button>
        </div>

        <p className="sheet__intro">
          Правка лишиться на цьому пристрої, у «Моєму розкладі». Шкільний розклад вона не
          змінить.
        </p>

        <fieldset className="field">
          <legend className="field__label">Предмет</legend>
          <input
            className="textinput"
            type="text"
            list={subjectsId}
            value={subject}
            maxLength={60}
            placeholder="Почніть вводити — підкажемо"
            aria-label="Предмет"
            onChange={(event) => setSubject(event.target.value)}
          />
          <datalist id={subjectsId}>
            {subjects.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </fieldset>

        <fieldset className="field">
          <legend className="field__label">Коли</legend>
          <div className="timepair">
            <select
              className="select"
              value={d}
              aria-label="День"
              onChange={(event) => setD(Number(event.target.value))}
            >
              {[0, 1, 2, 3, 4].map((index) => (
                <option key={index} value={index}>
                  {DAY_NAME[index + 1]}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={p}
              aria-label="Урок за дзвінками"
              onChange={(event) => setP(Number(event.target.value))}
            >
              {PERIODS.map((period) => (
                <option key={period} value={period}>
                  {period} · {formatTime(BELLS[period].start)}
                  {takenBy(period) ? ` · ${takenBy(period)}` : ''}
                </option>
              ))}
            </select>
          </div>
          {takenBy(p) && (
            <p className="field__hint">Там уже {takenBy(p)} — цей урок стане замість нього.</p>
          )}
          {weekOnly(cls, profile, { d, p }) && (
            <p className="field__hint">
              Тут уроки чергуються по тижнях, тож правка — лише на {week}-й тиждень.
            </p>
          )}
        </fieldset>

        <fieldset className="field">
          <legend className="field__label">Кабінет</legend>
          <input
            className="textinput"
            type="text"
            value={room}
            maxLength={20}
            placeholder="12, сз, акт.зал"
            aria-label="Кабінет"
            onChange={(event) => setRoom(event.target.value)}
          />
        </fieldset>

        <fieldset className="field">
          <legend className="field__label">Учитель</legend>
          <input
            className="textinput"
            type="text"
            list={teachersId}
            value={teacher}
            maxLength={60}
            placeholder="Не обов'язково"
            aria-label="Учитель"
            onChange={(event) => setTeacher(event.target.value)}
          />
          <datalist id={teachersId}>
            {teachers.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </fieldset>

        <div className="sheet__actions">
          <button
            type="button"
            className="btn btn--wide"
            disabled={!subject.trim()}
            onClick={save}
          >
            Зберегти
          </button>
          {from && (
            <button
              type="button"
              className="linkbtn"
              onClick={() => commit(saveLesson(profile.edits, cls, profile, week, from, from, null))}
            >
              Прибрати урок
            </button>
          )}
          {from && lesson?.edited && (
            <button
              type="button"
              className="linkbtn"
              onClick={() => commit(revertEdit(profile.edits, cls.id, from, week))}
            >
              Повернути як у розкладі
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
