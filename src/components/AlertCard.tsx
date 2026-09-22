import type { Place } from '../data/regions'
import type { AlertState } from '../lib/alerts'
import { ALERT_DETAIL, ALERT_TITLE, alertStale } from '../lib/alerts'
import { formatElapsed, formatTime } from '../lib/clock'
import type { DisplayLesson } from '../lib/lessons'
import { roomLabel } from '../lib/lessons'

type Props = {
  state: AlertState
  region: Place
  /** Коли був відбій — мілісекунди; `null`, якщо його ще не було. */
  endedAt: number | null
  /** На який урок повертатись; `null` — повертатись нема на що. */
  resume: DisplayLesson | null
  nowMs: number
}

/**
 * Скільки показувати картку відбою. Довше вона не про що: людина або
 * вже повернулась до класу, або сьогодні туди не піде.
 */
const AFTER_MS = 40 * 60 * 1000

function subjectOf(lesson: DisplayLesson): string {
  return lesson.items.map((i) => i.subject).join(' / ')
}

function whereOf(lesson: DisplayLesson): string | null {
  const rooms = lesson.items.map((i) => roomLabel(i.room)).filter((r): r is string => r !== null)
  return rooms.length > 0 ? [...new Set(rooms)].join(' · ') : null
}

/** «4 урок, математика, каб. 12, об 11:00» — одним рядком. */
function resumeLine(lesson: DisplayLesson): string {
  const where = whereOf(lesson)
  const what = where ? `${subjectOf(lesson)} · ${where}` : subjectOf(lesson)
  return `${lesson.n} урок · ${what} · о ${formatTime(lesson.start)}`
}

/**
 * Повітряна тривога над розкладом.
 *
 * Показує не просто «тривога», а те, чого більше ніде немає: на який
 * урок повертатись після відбою. Відбій о 10:20 сам по собі не каже, що
 * йти треба на четвертий, — а розклад і дзвінки застосунок уже знає.
 */
export function AlertCard({ state, region, endedAt, resume, nowMs }: Props) {
  if (state.level > 0) {
    const stale = alertStale(state, nowMs)
    const going = state.since === null ? null : Math.floor((nowMs - state.since) / 60_000)

    return (
      <section
        className={state.level === 2 ? 'alert alert--red' : 'alert alert--yellow'}
        aria-label="Повітряна тривога"
        role="status"
      >
        <p className="alert__label">
          <span className="alert__pulse" aria-hidden="true" />
          {ALERT_TITLE[state.level]}
        </p>
        <h2 className="alert__title">{ALERT_DETAIL[state.level]}</h2>
        <p className="alert__where">
          {/*
            У живих даних більшість тривог оголошують по районах. Написати
            «тривога в області», коли гуде в одному районі, — це налякати
            пів краю й привчити не вірити застосунку.
          */}
          {state.where ?? region.name}
          {state.where && ` · ${region.name}`}
          {going !== null && going > 0 && ` · триває ${formatElapsed(going)}`}
        </p>
        {resume && <p className="alert__resume">Після відбою — {resumeLine(resume)}</p>}
        {stale && (
          <p className="alert__stale">
            Дані застаріли — застосунок давно не міг перевірити стан. Вірте сирені, а не екрану.
          </p>
        )}
      </section>
    )
  }

  // Відбою сирена більше не дає зовсім — з вересня 2026 вона звучить
  // лише на початок. Тому саме тут застосунок і потрібен найбільше.
  if (endedAt !== null && nowMs - endedAt < AFTER_MS) {
    return (
      <section className="alert alert--clear" aria-label="Відбій тривоги" role="status">
        <p className="alert__label">Відбій</p>
        <h2 className="alert__title">
          {resume ? `${resume.n} урок о ${formatTime(resume.start)}` : 'Уроків сьогодні вже немає'}
        </h2>
        {resume ? (
          <p className="alert__where">
            {subjectOf(resume)}
            {whereOf(resume) && ` · ${whereOf(resume)}`}
          </p>
        ) : (
          <p className="alert__where">{region.name} · тривоги немає</p>
        )}
      </section>
    )
  }

  return null
}
