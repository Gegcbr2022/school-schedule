import { useId, useMemo, useState } from 'react'
import type { WeekParity } from '../data/schedule'
import { formatTime, plural } from '../lib/clock'
import { HAS_CONTACTS, formatPhone, phoneOf, telHref } from '../lib/contacts'
import { useModal } from '../lib/hooks'
import { roomLabel } from '../lib/lessons'
import type { TeacherFacts } from '../lib/teacherSchedule'
import { buildTeacherWeek, teacherFacts } from '../lib/teacherSchedule'
import type { Teacher } from '../lib/teachers'
import {
  formalName,
  initialsOf,
  isSharedCode,
  politeName,
  scheduleTeachers,
  undecodedCodes,
} from '../lib/teachers'
import { BackIcon, CloseIcon, PhoneIcon, SearchIcon } from './Icons'

type Props = {
  /** Парність поточного тижня — з неї починаємо показ. */
  currentWeek: WeekParity
  /** Хто зараз відкритий як «мій розклад», якщо це вчитель. */
  pinnedId: number | null
  /** Показувати розклад цього вчителя на головному екрані. */
  onPin: (id: number | null) => void
  onClose: () => void
}

const DAY_FULL = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця"]

type Entry = {
  key: string
  teacher: Teacher
  /** Прізвище відоме, а не самий лише код із паперу. */
  known: boolean
  facts: TeacherFacts
  /** Усе, за чим шукаємо, одним рядком у нижньому регістрі. */
  haystack: string
}

function entryOf(teacher: Teacher, known: boolean): Entry {
  const facts = teacherFacts(teacher)
  return {
    key: known ? `id${teacher.id}` : `code${teacher.code}`,
    teacher,
    known,
    facts,
    haystack: [formalName(teacher), teacher.code, ...facts.subjects, ...facts.classes]
      .join(' ')
      .toLowerCase(),
  }
}

/**
 * Довідник — це люди, а не коди: під кодом «НГ» ходять двоє, і кожна має
 * свій розклад. Нерозшифровані коди йдуть у кінець, як на папері.
 */
function buildDirectory(): Entry[] {
  const known = scheduleTeachers().map((t) => entryOf(t, true))
  const unknown = undecodedCodes().map(({ code }) =>
    // Псевдо-вчитель: без `when` під код підпадають усі його уроки —
    // саме те, що треба, поки ми не знаємо, хто це.
    entryOf({ id: -1, code, last: code, first: '' }, false),
  )
  return [...known, ...unknown]
}

export function TeachersSheet({ currentWeek, pinnedId, onPin, onClose }: Props) {
  const headingId = useId()
  const sheetRef = useModal(onClose)

  const directory = useMemo(() => buildDirectory(), [])
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const needle = query.trim().toLowerCase()
  const shown = needle ? directory.filter((e) => e.haystack.includes(needle)) : directory
  const current = selected ? (directory.find((e) => e.key === selected) ?? null) : null

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
        <div className="sheet__head">
          {current && (
            <button
              type="button"
              className="iconbtn"
              onClick={() => setSelected(null)}
              aria-label="Назад до списку"
            >
              <BackIcon />
            </button>
          )}
          <h2 className="sheet__title" id={headingId}>
            {current ? (current.known ? current.teacher.last : current.teacher.code) : 'Вчителі'}
          </h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити">
            <CloseIcon />
          </button>
        </div>

        {current ? (
          <TeacherCard
            entry={current}
            currentWeek={currentWeek}
            pinned={current.known && current.teacher.id === pinnedId}
            onPin={onPin}
            onClose={onClose}
          />
        ) : (
          <>
            <label className="tsearch">
              <SearchIcon />
              <input
                type="search"
                inputMode="search"
                placeholder="Прізвище, предмет, клас або код…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Пошук учителя"
              />
            </label>

            <p className="sheet__intro">
              Хто є хто в розкладі: {directory.length} записів. Торкніться, щоб побачити
              тижневий розклад учителя разом із вікнами.
            </p>

            <ul className="tdir">
              {shown.map((entry) => (
                <li key={entry.key}>
                  <button
                    type="button"
                    className="tdir__item"
                    onClick={() => setSelected(entry.key)}
                  >
                    <span className="tdir__avatar" aria-hidden="true">
                      {entry.known ? initialsOf(entry.teacher) : '?'}
                    </span>
                    <span className="tdir__body">
                      <span className="tdir__name">
                        {entry.known ? formalName(entry.teacher) : `Код «${entry.teacher.code}»`}
                        <span className="tdir__code">{entry.teacher.code}</span>
                      </span>
                      {entry.facts.subjects.length > 0 && (
                        <span className="tdir__subjects">{entry.facts.subjects.join(', ')}</span>
                      )}
                      {entry.facts.homerooms.length > 0 && (
                        <span className="tdir__hr">
                          Класний керівник {entry.facts.homerooms.join(', ')}
                        </span>
                      )}
                      {!entry.known && (
                        <span className="tdir__hr">Кого позначено цим кодом — не з'ясували</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
              {shown.length === 0 && <li className="empty">Нікого не знайшли.</li>}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function TeacherCard({
  entry,
  currentWeek,
  pinned,
  onPin,
  onClose,
}: {
  entry: Entry
  currentWeek: WeekParity
  pinned: boolean
  onPin: (id: number | null) => void
  onClose: () => void
}) {
  const [week, setWeek] = useState<WeekParity>(currentWeek)
  const { teacher, facts, known } = entry
  const days = useMemo(() => buildTeacherWeek(teacher, week), [teacher, week])
  const windows = days.reduce((n, day) => n + day.windows, 0)
  const phone = known ? phoneOf(teacher.id) : undefined

  return (
    <>
      <p className="sheet__intro">
        {known && <b>{politeName(teacher)}</b>}
        {known && <br />}
        {facts.subjects.join(', ') || 'Предметів у розкладі немає'}
        <br />
        {facts.classes.length} {plural(facts.classes.length, ['клас', 'класи', 'класів'])} ·{' '}
        {facts.perWeek} {plural(facts.perWeek, ['урок', 'уроки', 'уроків'])} на тиждень
        {facts.homerooms.length > 0 && (
          <>
            <br />
            Класний керівник {facts.homerooms.join(', ')}
          </>
        )}
        {isSharedCode(teacher.code) && known && (
          <>
            <br />
            Код «{teacher.code}» у розкладі спільний із однофамільцем — уроки розведено
            за предметом.
          </>
        )}
        {!known && (
          <>
            <br />
            У паперовому розкладі стоїть лише код. Нижче — всі уроки під ним.
          </>
        )}
      </p>

      {(phone || pinned || known) && (
        <div className="tcard__actions">
          {phone && (
            <a className="btn btn--ghost" href={telHref(phone)}>
              <PhoneIcon />
              {formatPhone(phone)}
            </a>
          )}
          {known && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                onPin(pinned ? null : teacher.id)
                if (!pinned) onClose()
              }}
            >
              {pinned ? 'Це мій розклад ✓' : 'Показувати як мій розклад'}
            </button>
          )}
        </div>
      )}

      <div className="modeswitch" role="group" aria-label="Тиждень">
        <button type="button" aria-pressed={week === 1} onClick={() => setWeek(1)}>
          1 тиждень
        </button>
        <button type="button" aria-pressed={week === 2} onClick={() => setWeek(2)}>
          2 тиждень
        </button>
      </div>

      <div className="tweek">
        {days.map((day) => (
          <section className="tday" key={day.iso}>
            <h3 className="tday__head">
              {DAY_FULL[day.iso - 1]}
              <span className="tday__meta">
                {day.count > 0
                  ? `${day.count} ${plural(day.count, ['урок', 'уроки', 'уроків'])}`
                  : 'без уроків'}
                {day.windows > 0 &&
                  ` · ${day.windows} ${plural(day.windows, ['вікно', 'вікна', 'вікон'])}`}
              </span>
            </h3>

            {day.rows.length === 0 ? (
              <p className="tday__empty">Уроків немає.</p>
            ) : (
              <ol className="trows">
                {day.rows.map((row) =>
                  row.kind === 'window' ? (
                    <li className="trow trow--window" key={row.period}>
                      <span className="trow__time">{formatTime(row.start)}</span>
                      <span className="trow__window">Вікно</span>
                    </li>
                  ) : (
                    <li className="trow" key={row.period}>
                      <span className="trow__time">
                        {formatTime(row.start)}
                        <span className="trow__end">{formatTime(row.end)}</span>
                      </span>
                      <span className="trow__body">
                        {row.entries.map((item, i) => (
                          <span className="tentry" key={i}>
                            <span className="tentry__class">{item.className}</span>
                            <span className="tentry__subject">{item.subject}</span>
                            {(roomLabel(item.room) || item.who) && (
                              <span className="tentry__meta">
                                {[roomLabel(item.room), item.who].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </span>
                        ))}
                      </span>
                    </li>
                  ),
                )}
              </ol>
            )}
          </section>
        ))}
      </div>

      <p className="hint hint--muted">
        За {week} тиждень {windows} {plural(windows, ['вікно', 'вікна', 'вікон'])}.
        {!HAS_CONTACTS && known && ' Телефони у цій збірці не публікуються.'}
      </p>
    </>
  )
}
