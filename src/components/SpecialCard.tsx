import type { SpecialDay } from '../data/special'
import { formatDuration, parseTime } from '../lib/clock'

/**
 * Події особливого дня в основній колонці — замість списку уроків.
 * Без відліку: відлік живе в бічній картці.
 */
export function SpecialDayAgenda({ day }: { day: SpecialDay }) {
  const events = day.events ?? []
  return (
    <div className="agenda">
      <p className="agenda__lead">
        {day.emoji && <span aria-hidden="true">{day.emoji} </span>}
        Уроків немає — {day.title.toLowerCase()}
      </p>
      {events.length > 0 && (
        <ol className="events events--main">
          {events.map((event) => (
            <li className="event" key={event.title + (event.time ?? '')}>
              {event.time && <span className="event__time">{event.time}</span>}
              <span className="event__body">
                <span className="event__title">{event.title}</span>
                {event.where && <span className="event__where">{event.where}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

type Props = {
  day: SpecialDay
  /** Поточний київський час у хвилинах — лише коли це сьогодні. */
  nowMin: number | null
}

/**
 * Картка особливого дня: свято чи лінійка замість звичайного «що зараз».
 * Для сьогоднішнього дня показує зворотний відлік до найближчої події.
 */
export function SpecialCard({ day, nowMin }: Props) {
  const events = day.events ?? []

  // Найближча подія, що ще не почалась, — для відліку.
  const upcoming =
    nowMin === null
      ? null
      : events
          .map((e) => ({ e, at: e.time ? parseTime(e.time) : null }))
          .filter((x): x is { e: (typeof events)[number]; at: number } => x.at !== null && x.at > nowMin)
          .sort((a, b) => a.at - b.at)[0] ?? null

  return (
    <section className="status status--event" aria-label="Сьогодні">
      <p className="status__label">{day.note ? 'Особливий день' : 'Сьогодні'}</p>
      <h2 className="status__subject">
        {day.emoji && <span aria-hidden="true">{day.emoji} </span>}
        {day.title}
      </h2>
      {day.note && <p className="status__range">{day.note}</p>}

      {upcoming && (
        <p className="status__count">
          {upcoming.e.title} через <b>{formatDuration(upcoming.at - nowMin!)}</b>
        </p>
      )}

      {events.length > 0 && (
        <ul className="events">
          {events.map((event) => {
            const at = event.time ? parseTime(event.time) : null
            const past = nowMin !== null && at !== null && nowMin >= at
            return (
              <li className={past ? 'event event--past' : 'event'} key={event.title + (event.time ?? '')}>
                {event.time && <span className="event__time">{event.time}</span>}
                <span className="event__body">
                  <span className="event__title">{event.title}</span>
                  {event.where && <span className="event__where">{event.where}</span>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
