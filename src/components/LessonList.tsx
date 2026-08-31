import { Fragment } from 'react'
import { formatDuration, formatTime } from '../lib/clock'
import type { DisplayLesson } from '../lib/lessons'
import { roomLabel } from '../lib/lessons'
import { NoteIcon } from './Icons'

type Props = {
  lessons: DisplayLesson[]
  /**
   * Поточний київський час у хвилинах — або `null`, якщо показуємо
   * не сьогоднішній день (тоді нічого не підсвічуємо).
   */
  nowMin: number | null
  /** Текст нотатки для уроку за його періодом (порожній — нотатки немає). */
  noteFor: (period: number) => string
  /** Відкрити редактор нотатки для цього уроку. */
  onOpenNote: (lesson: DisplayLesson) => void
}

type State = 'past' | 'current' | 'next' | 'future' | 'plain'

function statesFor(lessons: DisplayLesson[], nowMin: number | null): State[] {
  if (nowMin === null) return lessons.map(() => 'plain')

  let nextTaken = false
  return lessons.map((lesson) => {
    if (nowMin >= lesson.end) return 'past'
    if (nowMin >= lesson.start) return 'current'
    if (!nextTaken) {
      nextTaken = true
      return 'next'
    }
    return 'future'
  })
}

const BADGE: Partial<Record<State, string>> = {
  current: 'Зараз',
  next: 'Далі',
}

/** Перерва між двома уроками, у хвилинах (0 — суміжні впритул). */
function breakBetween(a: DisplayLesson, b: DisplayLesson): number {
  return Math.max(0, b.start - a.end)
}

export function LessonList({ lessons, nowMin, noteFor, onOpenNote }: Props) {
  const states = statesFor(lessons, nowMin)

  return (
    <ol className="timeline">
      {lessons.map((lesson, index) => {
        const state = states[index]
        const badge = BADGE[state]

        // Скільки уроку минуло — для живої смужки на поточній картці.
        const progress =
          state === 'current' && nowMin !== null
            ? Math.min(1, Math.max(0, (nowMin - lesson.start) / (lesson.end - lesson.start)))
            : null

        // Перерва до наступного уроку — показуємо, якщо триває зараз чи попереду.
        const nextLesson = lessons[index + 1]
        const gap = nextLesson ? breakBetween(lesson, nextLesson) : 0
        const onBreakNow =
          nowMin !== null && nextLesson
            ? nowMin >= lesson.end && nowMin < nextLesson.start
            : false

        return (
          <Fragment key={lesson.n}>
            <li className={`lesson lesson--${state}`}>
              <div className="lesson__time">
                <span className="lesson__start">{formatTime(lesson.start)}</span>
                <span className="lesson__end">{formatTime(lesson.end)}</span>
              </div>

              <div className="lesson__rail" aria-hidden="true">
                <span className="lesson__dot" />
              </div>

              <button
                type="button"
                className="lesson__card"
                onClick={() => onOpenNote(lesson)}
                aria-label={`${lesson.items.map((i) => i.subject).join(', ')}, ${lesson.n} урок — додати нотатку`}
              >
                <div className="lesson__head">
                  <span className="lesson__num">{lesson.n} урок</span>
                  {badge && (
                    <span
                      className={
                        state === 'current' ? 'lesson__badge' : 'lesson__badge lesson__badge--soft'
                      }
                    >
                      {badge}
                    </span>
                  )}
                  {state === 'past' && <span className="visually-hidden">Урок минув</span>}
                </div>

                <div className="lesson__variants">
                  {lesson.items.map((item) => {
                    const room = roomLabel(item.room)
                    return (
                      <p key={`${item.who ?? ''}-${item.subject}`} className="lesson__subject">
                        {item.who && <span className="lesson__who">{item.who}</span>}
                        {item.subject}
                        {room && <span className="lesson__room">{room}</span>}
                        {item.teacher && <span className="lesson__teacher">{item.teacher}</span>}
                      </p>
                    )
                  })}
                </div>

                {lesson.note && <p className="lesson__note">{lesson.note}</p>}

                {noteFor(lesson.period) ? (
                  <p className="lesson__usernote">
                    <NoteIcon />
                    {noteFor(lesson.period)}
                  </p>
                ) : (
                  <span className="lesson__addnote">
                    <NoteIcon />
                    Додати ДЗ
                  </span>
                )}

                {progress !== null && (
                  <div className="lesson__progress" aria-hidden="true">
                    <div className="lesson__progress-fill" style={{ width: `${progress * 100}%` }} />
                  </div>
                )}
              </button>
            </li>

            {gap > 0 && (
              <li className={onBreakNow ? 'brk brk--now' : 'brk'} aria-hidden="true">
                <span className="brk__label">
                  {onBreakNow ? 'Перерва' : 'перерва'} {formatDuration(gap)}
                </span>
              </li>
            )}
          </Fragment>
        )
      })}
    </ol>
  )
}
