import { formatTime, plural } from '../lib/clock'
import { roomLabel } from '../lib/lessons'
import type { WeekDay } from '../lib/teacherSchedule'

const DAY_FULL = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця"]

type Props = {
  days: WeekDay[]
  /** Підсвітити цей день (ISO 1…5) — зазвичай сьогоднішній. */
  todayIso?: number
}

/**
 * Тиждень одним списком: п'ять днів, у кожному — уроки за часом і вікна
 * між ними. Однаковий і для учня, і для вчителя: різниця лише в тому,
 * хто зібрав дні.
 */
export function WeekGrid({ days, todayIso }: Props) {
  return (
    <div className="tweek">
      {days.map((day) => (
        <section className={day.iso === todayIso ? 'tday tday--today' : 'tday'} key={day.iso}>
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
                      {row.items.map((item, i) => (
                        <span className="tentry" key={i}>
                          {item.cls && <span className="tentry__class">{item.cls}</span>}
                          <span className="tentry__subject">{item.subject}</span>
                          {(roomLabel(item.room) || item.who || item.teacher) && (
                            <span className="tentry__meta">
                              {[roomLabel(item.room), item.who, item.teacher]
                                .filter(Boolean)
                                .join(' · ')}
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
  )
}
