import { formatDuration, formatTime, plural } from '../lib/clock'
import type { DayStatus, DisplayLesson } from '../lib/lessons'

/** Куди дивитись далі: найближчий навчальний день і його перший урок. */
export type NextUp = {
  /** «понеділок» — знахідний відмінок, для кнопки. */
  accusative: string
  /** «понеділок» — називний, для тексту. */
  nominative: string
  lesson: DisplayLesson | null
  /** `null`, якщо цей день і так уже відкрито. */
  onJump: (() => void) | null
}

type Props = {
  /** `null` — сьогодні вихідний. */
  status: DayStatus | null
  todayName: string
  nextUp: NextUp
}

function subjectOf(lesson: DisplayLesson): string {
  return lesson.items.map((i) => i.subject).join(' / ')
}

function Range({ lesson }: { lesson: DisplayLesson }) {
  return (
    <p className="status__range">
      {formatTime(lesson.start)} — {formatTime(lesson.end)}
    </p>
  )
}

function NextLine({ lesson }: { lesson: DisplayLesson }) {
  return (
    <div className="status__next">
      <span className="status__next-label">Наступний:</span>
      <span className="status__next-name">{subjectOf(lesson)}</span>
      <span className="status__next-time">{formatTime(lesson.start)}</span>
    </div>
  )
}

function JumpBlock({ nextUp }: { nextUp: NextUp }) {
  return (
    <>
      <div className="status__next">
        <span className="status__next-label">Далі — у {nextUp.nominative}:</span>
        {nextUp.lesson && (
          <>
            <span className="status__next-name">{subjectOf(nextUp.lesson)}</span>
            <span className="status__next-time">{formatTime(nextUp.lesson.start)}</span>
          </>
        )}
      </div>
      {nextUp.onJump && (
        <div className="status__actions">
          <button type="button" className="btn btn--wide" onClick={nextUp.onJump}>
            Переглянути {nextUp.accusative}
          </button>
        </div>
      )}
    </>
  )
}

export function StatusCard({ status, todayName, nextUp }: Props) {
  // Вихідний: уроків немає взагалі, показуємо найближчий навчальний день.
  if (status === null) {
    return (
      <section className="status" aria-label="Що зараз">
        <p className="status__label">{todayName}</p>
        <h2 className="status__subject">Сьогодні вихідний</h2>
        <p className="status__range">Відпочивайте 🌤️</p>
        <JumpBlock nextUp={nextUp} />
      </section>
    )
  }

  if (status.kind === 'empty') {
    return (
      <section className="status" aria-label="Що зараз">
        <p className="status__label">{todayName}</p>
        <h2 className="status__subject">Сьогодні уроків немає</h2>
        <p className="status__range">За вашими групами на сьогодні нічого не стоїть.</p>
        <JumpBlock nextUp={nextUp} />
      </section>
    )
  }

  if (status.kind === 'lesson') {
    const { current, next, leftMin, progress } = status
    const percent = Math.min(100, Math.max(0, Math.round(progress * 100)))
    return (
      <section className="status status--live" aria-label="Що зараз">
        <p className="status__label">
          <span className="status__pulse" aria-hidden="true" />
          Зараз
        </p>
        <h2 className="status__subject">{subjectOf(current)}</h2>
        <Range lesson={current} />

        <p className="status__count">
          До кінця <b>{formatDuration(leftMin)}</b>
        </p>
        <div
          className="progress"
          role="progressbar"
          aria-label="Скільки уроку минуло"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="progress__fill" style={{ width: `${percent}%` }} />
        </div>

        {next ? <NextLine lesson={next} /> : <JumpBlock nextUp={nextUp} />}
      </section>
    )
  }

  if (status.kind === 'break') {
    return (
      <section className="status status--break" aria-label="Що зараз">
        <p className="status__label">
          <span className="status__pulse" aria-hidden="true" />
          Перерва
        </p>
        <h2 className="status__subject">{subjectOf(status.next)}</h2>
        <Range lesson={status.next} />
        <p className="status__count">
          Наступний урок через <b>{formatDuration(status.inMin)}</b>
        </p>
      </section>
    )
  }

  if (status.kind === 'before') {
    return (
      <section className="status" aria-label="Що зараз">
        <p className="status__label">Перший урок</p>
        <h2 className="status__subject">{subjectOf(status.next)}</h2>
        <Range lesson={status.next} />
        <p className="status__count">
          Початок через <b>{formatDuration(status.inMin)}</b>
        </p>
      </section>
    )
  }

  // status.kind === 'done'
  return (
    <section className="status" aria-label="Що зараз">
      <p className="status__label">На сьогодні все</p>
      <h2 className="status__subject">Уроки закінчилися 🎉</h2>
      <p className="status__range">
        Сьогодні було {status.total} {plural(status.total, ['урок', 'уроки', 'уроків'])}.
      </p>
      <JumpBlock nextUp={nextUp} />
    </section>
  )
}
