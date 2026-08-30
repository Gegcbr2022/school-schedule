import { formatTime } from '../lib/clock'
import type { DisplayLesson } from '../lib/lessons'

type Props = {
  lessons: DisplayLesson[]
  /**
   * Поточний київський час у хвилинах — або `null`, якщо показуємо
   * не сьогоднішній день (тоді нічого не підсвічуємо).
   */
  nowMin: number | null
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

export function LessonList({ lessons, nowMin }: Props) {
  const states = statesFor(lessons, nowMin)

  return (
    <ol className="timeline">
      {lessons.map((lesson, index) => {
        const state = states[index]
        const badge = BADGE[state]

        return (
          <li key={lesson.n} className={`lesson lesson--${state}`}>
            <div className="lesson__time">
              <span className="lesson__start">{formatTime(lesson.start)}</span>
              <span className="lesson__end">{formatTime(lesson.end)}</span>
            </div>

            <div className="lesson__rail" aria-hidden="true">
              <span className="lesson__dot" />
            </div>

            <div className="lesson__card">
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
                {lesson.items.map((item) => (
                  <p key={`${item.who ?? ''}-${item.subject}`} className="lesson__subject">
                    {item.who && <span className="lesson__who">{item.who}</span>}
                    {item.subject}
                  </p>
                ))}
              </div>

              {lesson.note && <p className="lesson__note">{lesson.note}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
