import { useEffect, useId, useRef, useState } from 'react'
import { formatTime } from '../lib/clock'
import { useKeyboardInset, useModal } from '../lib/hooks'
import type { DisplayLesson } from '../lib/lessons'

export type NoteTarget = {
  /** Урок, до якого запис. Немає — нотатка на весь день. */
  lesson?: DisplayLesson
  /** `рррр-мм-дд` того дня, до якого належить нотатка. */
  date: string
  /** «Понеділок, 31 серпня» — щоб було видно, до чого запис. */
  when: string
}

type Props = {
  target: NoteTarget
  initial: string
  onSave: (text: string) => void
  onClose: () => void
}

/**
 * Редактор нотатки: домашнє завдання до уроку — або запис на весь день,
 * як-от чергування. Різниця лише в шапці й підказці; сховище спільне.
 */
export function NoteSheet({ target, initial, onSave, onClose }: Props) {
  const [text, setText] = useState(initial)
  const headingId = useId()
  const sheetRef = useModal(onClose)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const keyboard = useKeyboardInset()

  // Фокусуємо поле лише після анімації появи — тоді iOS ставить клавіатуру
  // на місце з першого разу, а не «зависає» над аркушем.
  useEffect(() => {
    const id = window.setTimeout(() => textareaRef.current?.focus(), 320)
    return () => window.clearTimeout(id)
  }, [])

  const save = () => {
    onSave(text)
    onClose()
  }

  const lesson = target.lesson
  const subject = lesson ? lesson.items.map((i) => i.subject).join(' / ') : 'Нотатка на день'

  return (
    <div
      className="sheet-backdrop"
      style={{ paddingBottom: keyboard }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="sheet sheet--note"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
      >
        <div className="sheet__grip" aria-hidden="true" />

        <div className="sheet__head">
          <h2 className="sheet__title" id={headingId}>
            {subject}
          </h2>
        </div>

        <p className="sheet__intro">
          {target.when}
          {lesson && (
            <>
              {' '}
              · {lesson.n} урок · {formatTime(lesson.start)}–{formatTime(lesson.end)}
            </>
          )}
        </p>

        <textarea
          ref={textareaRef}
          className="note-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            lesson
              ? 'Домашнє завдання, що принести, нагадування…'
              : 'Чергування, прибирання, що взяти з собою…'
          }
          rows={4}
          aria-label="Текст нотатки"
        />

        <div className="sheet__actions">
          <button type="button" className="btn btn--wide" onClick={save}>
            Зберегти
          </button>
          {initial && (
            <button
              type="button"
              className="linkbtn"
              onClick={() => {
                onSave('')
                onClose()
              }}
            >
              Видалити нотатку
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
