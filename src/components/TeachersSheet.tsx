import { useId, useMemo, useState } from 'react'
import type { WeekParity } from '../data/schedule'
import { formatTime, kyivNow, plural } from '../lib/clock'
import { HAS_CONTACTS, formatPhone, phoneOf, telHref } from '../lib/contacts'
import { useModal } from '../lib/hooks'
import type { TeacherFacts } from '../lib/teacherSchedule'
import { computeStatus, roomLabel } from '../lib/lessons'
import { buildTeacherDay, buildTeacherWeek, teacherFacts } from '../lib/teacherSchedule'
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
import { WeekGrid } from './WeekGrid'

type Props = {
  /** Парність поточного тижня — з неї починаємо показ. */
  currentWeek: WeekParity
  /** Хто зараз відкритий як «мій розклад», якщо це вчитель. */
  pinnedId: number | null
  /** Показувати розклад цього вчителя на головному екрані. */
  onPin: (id: number | null) => void
  onClose: () => void
}

type Entry = {
  key: string
  teacher: Teacher
  /** Є запис у журналі: телефон, «мій розклад», закріплення. */
  known: boolean
  /** Прізвище відоме — з журналу або з учительського розкладу. */
  named: boolean
  facts: TeacherFacts
  /** Усе, за чим шукаємо, одним рядком у нижньому регістрі. */
  haystack: string
}

function entryOf(teacher: Teacher, known: boolean, named = known): Entry {
  const facts = teacherFacts(teacher)
  return {
    key: known ? `id${teacher.id}` : `code${teacher.code}`,
    teacher,
    known,
    named,
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
  const unknown = undecodedCodes().map(({ code, last, first }) =>
    // Псевдо-вчитель: без `when` під код підпадають усі його уроки — саме
    // те, що треба, поки в журналі його немає. Прізвище буває відоме й без
    // журналу: його називає учительський розклад.
    entryOf({ id: -1, code, last: last ?? code, first: first ?? '' }, false, Boolean(last)),
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
        <div className="sheet__grip" aria-hidden="true" />

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
                      {entry.named ? initialsOf(entry.teacher) : '?'}
                    </span>
                    <span className="tdir__body">
                      <span className="tdir__name">
                        {entry.named ? formalName(entry.teacher) : `Код «${entry.teacher.code}»`}
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
                        <span className="tdir__hr">
                          {entry.named
                            ? 'У журналі ліцею запису немає'
                            : "Кого позначено цим кодом — не з'ясували"}
                        </span>
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

/**
 * Де вчитель просто зараз — щоб не бігати поверхами, шукаючи його.
 * Рахуємо тим самим кодом, що й «що зараз» на головному екрані.
 */
function nowLine(teacher: Teacher, week: WeekParity): string | null {
  const now = kyivNow()
  if (now.iso > 5) return null

  const status = computeStatus(buildTeacherDay(teacher, now.iso - 1, week), now.minutes)
  const where = (item: { cls?: string; room?: string }) =>
    [item.cls, roomLabel(item.room)].filter(Boolean).join(', ')

  switch (status.kind) {
    case 'empty':
      return 'Сьогодні уроків немає'
    case 'before':
      return `Перший урок о ${formatTime(status.next.start)}`
    case 'lesson':
      return `Зараз веде ${status.current.items.map(where).join(' · ')} — до ${formatTime(status.current.end)}`
    case 'break':
      return `Перерва до ${formatTime(status.next.start)}, далі ${status.next.items.map(where).join(' · ')}`
    case 'done':
      return 'Уроки на сьогодні закінчились'
  }
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
  const { teacher, facts, known, named } = entry
  const days = useMemo(() => buildTeacherWeek(teacher, week), [teacher, week])
  const windows = days.reduce((n, day) => n + day.windows, 0)
  const phone = known ? phoneOf(teacher.id) : undefined
  const now = nowLine(teacher, currentWeek)

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
            {named
              ? 'У журналі ліцею такого запису немає — лишились ім’я з учительського розкладу й уроки під цим кодом.'
              : 'У паперовому розкладі стоїть лише код. Нижче — всі уроки під ним.'}
          </>
        )}
      </p>

      {now && <p className="tnow">{now}</p>}

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

      <WeekGrid days={days} />

      <p className="hint hint--muted">
        За {week} тиждень {windows} {plural(windows, ['вікно', 'вікна', 'вікон'])}.
        {!HAS_CONTACTS && known && ' Телефони у цій збірці не публікуються.'}
      </p>
    </>
  )
}
