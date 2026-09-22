import { useId, useState } from 'react'
import type { WeekParity } from '../data/schedule'
import { haptic } from '../lib/haptics'
import type { CalendarDate } from '../lib/clock'
import {
  DAY_SHORT_NAME,
  dateKey,
  formatDateUk,
  formatTime,
  parseDateKey,
  parseTime,
  plural,
} from '../lib/clock'
import { useBackdropClose, useModal } from '../lib/hooks'
import type { Club, Profile } from '../lib/prefs'
import { CLUB_LEADS, CLUB_TONES, nextClubId } from '../lib/prefs'
import { leaveAt, profileName } from '../lib/profiles'
import { CloseIcon, PhoneIcon, PlusIcon, StarIcon, TrashIcon } from './Icons'

type Props = {
  profile: Profile
  /** Сьогодні — для кнопки «скасувати сьогоднішнє заняття». */
  today: CalendarDate
  onSave: (clubs: Club[]) => void
  onClose: () => void
}

const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7]

/** Порожня заготовка: вівторок о 16:00 — просто щоб не починати з нуля. */
function blankClub(clubs: Club[]): Club {
  return {
    id: nextClubId(clubs),
    name: '',
    days: [],
    start: 16 * 60,
    end: 17 * 60,
    // Колір наступний по колу — щоб два гуртки поспіль не виявились однакові.
    tone: clubs.length % CLUB_TONES,
  }
}

/** «Пн, Ср · 17:00–18:30» — один рядок про те, коли гурток. */
function whenOf(club: Club): string {
  const days = club.days.map((d) => DAY_SHORT_NAME[d]).join(', ')
  return `${days} · ${formatTime(club.start)}–${formatTime(club.end)}`
}

/** «з 1 жовтня», «до 25 травня», «1 жовтня — 25 травня». */
function seasonOf(club: Club): string | null {
  if (club.from && club.to) {
    return `${formatDateUk(parseDateKey(club.from))} — ${formatDateUk(parseDateKey(club.to))}`
  }
  if (club.from) return `з ${formatDateUk(parseDateKey(club.from))}`
  if (club.to) return `до ${formatDateUk(parseDateKey(club.to))}`
  return null
}

/** Скільки закладати на дорогу. Нуль — «поруч, іти нікуди». */
const TRAVEL = [0, 10, 15, 30, 45]

function ClubForm({
  club,
  today,
  onDone,
  onCancel,
}: {
  club: Club
  today: CalendarDate
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

  const skip = draft.skip ?? []
  const addSkip = (key: string) => {
    if (!key || skip.includes(key)) return
    update({ skip: [...skip, key].sort() })
  }

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

      {draft.travel ? (
        <fieldset className="field">
          <legend className="field__label">Нагадати про вихід</legend>
          <label className="check">
            <input
              type="checkbox"
              checked={draft.leaveAlert !== false}
              onChange={(event) =>
                update({ leaveAlert: event.target.checked ? undefined : false })
              }
            />
            <span>
              <span className="check__label">
                Сповістити о {formatTime(leaveAt(draft))} — «час виходити»
              </span>
              <span className="check__hint">
                Окремо від нагадування про початок: на дорогу закладено {draft.travel} хв.
              </span>
            </span>
          </label>
        </fieldset>
      ) : null}

      <fieldset className="field">
        <legend className="field__label">Колір</legend>
        <div className="tonepick">
          {Array.from({ length: CLUB_TONES }, (_, tone) => (
            <button
              key={tone}
              type="button"
              className={`tonepick__dot tonepick__dot--t${tone}`}
              aria-pressed={(draft.tone ?? 0) === tone}
              aria-label={`Колір ${tone + 1}`}
              onClick={() => update({ tone })}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend className="field__label">Хто веде</legend>
        <input
          className="textinput"
          type="text"
          value={draft.teacher ?? ''}
          maxLength={60}
          placeholder="Іван Петрович"
          aria-label="Хто веде гурток"
          onChange={(event) => update({ teacher: event.target.value })}
        />
      </fieldset>

      <fieldset className="field">
        <legend className="field__label">Телефон</legend>
        <input
          className="textinput"
          type="tel"
          inputMode="tel"
          value={draft.phone ?? ''}
          maxLength={30}
          placeholder="+380 67 123 45 67"
          aria-label="Телефон тренера"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => update({ phone: event.target.value })}
        />
        <p className="field__hint">
          З'явиться кнопкою поруч із гуртком — щоб не шукати номер у переписці,
          коли дитину треба забрати раніше.
        </p>
      </fieldset>

      <fieldset className="field">
        <legend className="field__label">Нотатка</legend>
        <input
          className="textinput"
          type="text"
          value={draft.note ?? ''}
          maxLength={200}
          placeholder="Що взяти, який вхід, оплата"
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

      {/*
        Решта — те, що заповнюють один раз на рік або не заповнюють зовсім.
        Тримати це розгорнутим означає зробити форму вдвічі довшою заради
        полів, до яких доходять одиниці. `details` для цього й існує.
      */}
      <details className="more">
        <summary className="more__summary">Сезон, скасування, оплата</summary>

        <fieldset className="field">
          <legend className="field__label">Коли буває</legend>
          <div className="timepair">
            <input
              className="textinput textinput--time"
              type="date"
              value={draft.from ?? ''}
              aria-label="Початок сезону"
              onChange={(event) => update({ from: event.target.value || undefined })}
            />
            <span className="timepair__dash" aria-hidden="true">
              —
            </span>
            <input
              className="textinput textinput--time"
              type="date"
              value={draft.to ?? ''}
              aria-label="Кінець сезону"
              onChange={(event) => update({ to: event.target.value || undefined })}
            />
          </div>
          <p className="field__hint">
            Порожньо — гурток буває завжди. Секція з жовтня по травень інакше стоятиме
            в розкладі й посеред канікул.
          </p>
        </fieldset>

        <fieldset className="field">
          <legend className="field__label">Не буде</legend>
          <div className="timepair">
            <input
              className="textinput textinput--time"
              type="date"
              value=""
              aria-label="Додати дату без заняття"
              onChange={(event) => addSkip(event.target.value)}
            />
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => addSkip(dateKey(today))}
            >
              Сьогодні
            </button>
          </div>
          {skip.length > 0 && (
            <ul className="skips">
              {skip.map((key) => (
                <li key={key}>
                  <button
                    type="button"
                    className="chip chip--button"
                    aria-label={`Повернути заняття ${formatDateUk(parseDateKey(key))}`}
                    onClick={() => update({ skip: skip.filter((d) => d !== key) })}
                  >
                    {formatDateUk(parseDateKey(key))}
                    <CloseIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="field__hint">
            Тренер захворів — це не привід стирати секцію й заводити її заново
            в понеділок. Дотик по даті повертає заняття назад.
          </p>
        </fieldset>

        <fieldset className="field">
          <legend className="field__label">Нагадати за</legend>
          <select
            className="select select--compact"
            value={draft.lead ?? ''}
            aria-label="За скільки хвилин нагадати про цей гурток"
            onChange={(event) =>
              update({ lead: event.target.value === '' ? undefined : Number(event.target.value) })
            }
          >
            <option value="">Як у налаштуваннях</option>
            {CLUB_LEADS.map((value) => (
              <option key={value} value={value}>
                {value === 0 ? 'У момент початку' : `За ${value} хв`}
              </option>
            ))}
          </select>
          <p className="field__hint">
            Урок за стінкою й музична школа через місто не можуть мати однакове «за 10 хв».
          </p>
        </fieldset>

        <fieldset className="field">
          <legend className="field__label">Оплачено до</legend>
          <input
            className="textinput textinput--time"
            type="date"
            value={draft.paidUntil ?? ''}
            aria-label="Оплачено до"
            onChange={(event) => update({ paidUntil: event.target.value || undefined })}
          />
          <p className="field__hint">Нагадаємо за три дні й у сам день, о дев'ятій ранку.</p>
        </fieldset>
      </details>

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
              teacher: draft.teacher?.trim() || undefined,
              phone: draft.phone?.trim() || undefined,
              note: draft.note?.trim() || undefined,
              skip: draft.skip && draft.skip.length > 0 ? draft.skip : undefined,
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
export function ClubsSheet({ profile, today, onSave, onClose }: Props) {
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
          <ClubForm
            club={editing}
            today={today}
            onDone={commit}
            onCancel={() => setEditing(null)}
          />
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
                  <li className={`club club--t${club.tone ?? 0}`} key={club.id}>
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
                      {(club.place || club.note || club.travel || club.teacher) && (
                        <span className="club__where">
                          {[
                            club.teacher,
                            club.place,
                            club.travel ? `вийти о ${formatTime(leaveAt(club))}` : null,
                            club.note,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                      {(seasonOf(club) || club.paidUntil || club.skip?.length) && (
                        <span className="club__season">
                          {[
                            seasonOf(club),
                            club.paidUntil
                              ? `оплачено до ${formatDateUk(parseDateKey(club.paidUntil))}`
                              : null,
                            club.skip?.length
                              ? `${club.skip.length} ${plural(club.skip.length, ['скасування', 'скасування', 'скасувань'])}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </button>
                    {club.phone && (
                      /* Посилання, а не кнопка: набирати має телефон, а
                         не ми. Оболонка віддає `tel:` системі. */
                      <a
                        className="iconbtn iconbtn--small"
                        href={`tel:${club.phone.replace(/[^+\d]/g, '')}`}
                        aria-label={`Подзвонити: ${club.teacher || club.name}`}
                      >
                        <PhoneIcon />
                      </a>
                    )}
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
