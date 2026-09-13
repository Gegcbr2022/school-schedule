import { useId, useState } from 'react'
import type { WeekParity } from '../data/schedule'
import { haptic } from '../lib/haptics'
import { DAY_SHORT_NAME, formatTime, parseTime, plural } from '../lib/clock'
import { useBackdropClose, useModal } from '../lib/hooks'
import type { Club, Profile } from '../lib/prefs'
import { nextClubId } from '../lib/prefs'
import { leaveAt, profileName } from '../lib/profiles'
import { CloseIcon, PlusIcon, StarIcon, TrashIcon } from './Icons'

type Props = {
  profile: Profile
  onSave: (clubs: Club[]) => void
  onClose: () => void
}

const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7]

/** Порожня заготовка: вівторок о 16:00 — просто щоб не починати з нуля. */
function blankClub(clubs: Club[]): Club {
  return { id: nextClubId(clubs), name: '', days: [], start: 16 * 60, end: 17 * 60 }
}

/** «Пн, Ср · 17:00–18:30» — один рядок про те, коли гурток. */
function whenOf(club: Club): string {
  const days = club.days.map((d) => DAY_SHORT_NAME[d]).join(', ')
  return `${days} · ${formatTime(club.start)}–${formatTime(club.end)}`
}

/** Скільки закладати на дорогу. Нуль — «поруч, іти нікуди». */
const TRAVEL = [0, 10, 15, 30, 45]

function ClubForm({
  club,
  onDone,
  onCancel,
}: {
  club: Club
  onDone: (club: Club) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<Club>(club)
  const update = (patch: Partial<Club>) => setDraft((d) => ({ ...d, ...patch }))

  const toggleDay = (iso: number) =>
    update({
      days: draft.days.includes(iso)
        ? draft.days.filter((d) => d !== iso)
        : [...draft.days, iso].sort((a, b) => a - b),
    })

  // Не даємо зберегти те, чого не вийде показати в розкладі.
  const ready = draft.name.trim().length > 0 && draft.days.length > 0 && draft.end > draft.start

  return (
    <div className="clubform">
      <fieldset className="field">
        <legend className="field__label">Назва</legend>
        <input
          className="textinput"
          type="text"
          value={draft.name}
          maxLength={60}
          placeholder="Футбол, музична школа, репетитор…"
          aria-label="Назва гуртка"
          onChange={(event) => update({ name: event.target.value })}
        />
      </fieldset>

      <fieldset className="field">
        <legend className="field__label">Дні</legend>
        <div className="daypick">
          {ISO_DAYS.map((iso) => (
            <button
              key={iso}
              type="button"
              className="daypick__day"
              aria-pressed={draft.days.includes(iso)}
              onClick={() => toggleDay(iso)}
            >
              {DAY_SHORT_NAME[iso]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend className="field__label">Час</legend>
        <div className="timepair">
          <input
            className="textinput textinput--time"
            type="time"
            step={300}
            value={formatTime(draft.start)}
            aria-label="Початок"
            onChange={(event) => {
              const at = parseTime(event.target.value)
              if (at !== null) update({ start: at })
            }}
          />
          <span className="timepair__dash" aria-hidden="true">
            —
          </span>
          <input
            className="textinput textinput--time"
            type="time"
            step={300}
            value={formatTime(draft.end)}
            aria-label="Кінець"
            onChange={(event) => {
              const at = parseTime(event.target.value)
              if (at !== null) update({ end: at })
            }}
          />
        </div>
        {draft.end <= draft.start && (
          <p className="field__hint">Кінець має бути пізніше за початок.</p>
        )}
      </fieldset>

      <fieldset className="field">
        <legend className="field__label">Де</legend>
        <input
          className="textinput"
          type="text"
          value={draft.place ?? ''}
          maxLength={80}
          placeholder="ДЮСШ, вул. Стрільців 15"
          aria-label="Місце"
          onChange={(event) => update({ place: event.target.value })}
        />
      </fieldset>

      <fieldset className="field">
        <legend className="field__label">Дорога</legend>
        <div className="options">
          {TRAVEL.map((minutes) => (
            <label className="option" key={minutes}>
              <input
                type="radio"
                className="visually-hidden"
                name="club-travel"
                aria-label={
                  minutes === 0 ? 'Дорога: не рахувати' : `Дорога: вийти за ${minutes} хвилин`
                }
                checked={(draft.travel ?? 0) === minutes}
                onChange={() => update({ travel: minutes === 0 ? undefined : minutes })}
              />
              <span>{minutes === 0 ? 'Не рахувати' : `${minutes} хв`}</span>
            </label>
          ))}
        </div>
        <p className="field__hint">
          {draft.travel
            ? `Вийти о ${formatTime(leaveAt(draft))}. Якщо в цей час ще йде урок — застосунок так і напише.`
            : 'Скільки хвилин на дорогу. З цього застосунок і бачить, що встигнути неможливо.'}
        </p>
      </fieldset>

      <fieldset className="field">
        <legend className="field__label">Нотатка</legend>
        <input
          className="textinput"
          type="text"
          value={draft.note ?? ''}
          maxLength={200}
          placeholder="Тренер, телефон, що взяти"
          aria-label="Нотатка"
          onChange={(event) => update({ note: event.target.value })}
        />
      </fieldset>

      <fieldset className="field">
        <legend className="field__label">Як часто</legend>
        <div className="options">
          {[
            { value: 0, label: 'Щотижня' },
            { value: 1, label: '1 тиждень' },
            { value: 2, label: '2 тиждень' },
          ].map((option) => (
            <label className="option" key={option.value}>
              <input
                type="radio"
                className="visually-hidden"
                name="club-week"
                aria-label={`Як часто: ${option.label}`}
                checked={(draft.week ?? 0) === option.value}
                onChange={() =>
                  update({ week: option.value === 0 ? undefined : (option.value as WeekParity) })
                }
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <p className="field__hint">
          Через тиждень — так само, як уроки: перший тиждень той, у якому починається навчальний рік.
        </p>
      </fieldset>

      <div className="sheet__actions">
        <button
          type="button"
          className="btn btn--wide"
          disabled={!ready}
          onClick={() =>
            onDone({
              ...draft,
              name: draft.name.trim(),
              place: draft.place?.trim() || undefined,
              note: draft.note?.trim() || undefined,
            })
          }
        >
          Зберегти
        </button>
        <button type="button" className="linkbtn" onClick={onCancel}>
          Скасувати
        </button>
      </div>
    </div>
  )
}

/**
 * Гуртки, секції, музична школа — усе, чого в шкільному розкладі немає,
 * але воно стоїть у тому самому дні дитини.
 *
 * Записане тут потрапляє просто у стрічку дня, за часом, разом з уроками:
 * другого списку, у який треба окремо заглядати, ми не заводимо.
 */
export function ClubsSheet({ profile, onSave, onClose }: Props) {
  const headingId = useId()
  const sheetRef = useModal(onClose)
  const backdrop = useBackdropClose(onClose)
  const [editing, setEditing] = useState<Club | null>(null)

  const clubs = profile.clubs

  const commit = (club: Club) => {
    const known = clubs.some((c) => c.id === club.id)
    onSave(known ? clubs.map((c) => (c.id === club.id ? club : c)) : [...clubs, club])
    setEditing(null)
  }

  return (
    <div
      className="sheet-backdrop"
      {...backdrop}
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
            Гуртки
          </h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити">
            <CloseIcon />
          </button>
        </div>

        <p className="sheet__intro">
          {profileName(profile)}
          {clubs.length > 0 &&
            ` · ${clubs.length} ${plural(clubs.length, ['гурток', 'гуртки', 'гуртків'])}`}
        </p>

        {editing ? (
          <ClubForm club={editing} onDone={commit} onCancel={() => setEditing(null)} />
        ) : (
          <>
            {clubs.length === 0 ? (
              <p className="empty">
                <StarIcon />
                <br />
                Футбол, музична школа, репетитор — усе, що поза уроками. Записане тут стане
                в стрічку дня разом з уроками, за часом.
              </p>
            ) : (
              <ul className="clubs">
                {clubs.map((club) => (
                  <li className="club" key={club.id}>
                    <button
                      type="button"
                      className="club__body"
                      onClick={() => setEditing(club)}
                      aria-label={`${club.name}, ${whenOf(club)} — змінити`}
                    >
                      <span className="club__name">{club.name}</span>
                      <span className="club__when">
                        {whenOf(club)}
                        {club.week && ` · ${club.week} тиждень`}
                      </span>
                      {(club.place || club.note || club.travel) && (
                        <span className="club__where">
                          {[
                            club.place,
                            club.travel ? `вийти о ${formatTime(leaveAt(club))}` : null,
                            club.note,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="iconbtn iconbtn--small"
                      onClick={() => {
                        // Кошик стоїть упритул до картки — питаємо, щоб
                        // невлучний дотик не стирав розклад секції.
                        if (window.confirm(`Прибрати «${club.name}»?`)) {
                          haptic('warning')
                          onSave(clubs.filter((c) => c.id !== club.id))
                        }
                      }}
                      aria-label={`Прибрати ${club.name}`}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="sheet__actions">
              <button
                type="button"
                className="btn btn--wide"
                onClick={() => setEditing(blankClub(clubs))}
              >
                <PlusIcon />
                Додати гурток
              </button>
              <button type="button" className="linkbtn" onClick={onClose}>
                Закрити
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
