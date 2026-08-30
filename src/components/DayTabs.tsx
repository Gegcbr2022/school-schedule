import type { DayId } from '../data/schedule'
import { WEEK } from '../data/schedule'
import { DAY_NAME } from '../lib/clock'

type Props = {
  /** Який день зараз показано. */
  active: DayId
  /** ISO-номер сьогоднішнього дня (6/7 — вихідні, тоді крапки не буде). */
  todayIso: number
  onSelect: (id: DayId) => void
}

export function DayTabs({ active, todayIso, onSelect }: Props) {
  return (
    <div className="daybar" role="group" aria-label="Дні тижня">
      {WEEK.map((day) => {
        const isToday = day.iso === todayIso
        return (
          <button
            key={day.id}
            type="button"
            className="daytab"
            aria-pressed={day.id === active}
            aria-label={isToday ? `${DAY_NAME[day.iso]}, сьогодні` : DAY_NAME[day.iso]}
            onClick={() => onSelect(day.id)}
          >
            {day.short}
            {isToday && <span className="daytab__today" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
