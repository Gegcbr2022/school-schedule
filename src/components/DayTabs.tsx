import { DAY_NAME } from '../lib/clock'
import { DAY_SHORT } from '../lib/lessons'

type Props = {
  /** Індекс дня, який зараз показано (0 = понеділок). */
  active: number
  /** ISO-номер сьогоднішнього дня (6/7 — вихідні, тоді крапки не буде). */
  todayIso: number
  onSelect: (index: number) => void
}

export function DayTabs({ active, todayIso, onSelect }: Props) {
  return (
    <div className="daybar" role="group" aria-label="Дні тижня">
      {DAY_SHORT.map((short, index) => {
        const iso = index + 1
        const isToday = iso === todayIso
        return (
          <button
            key={short}
            type="button"
            className="daytab"
            aria-pressed={index === active}
            aria-label={isToday ? `${DAY_NAME[iso]}, сьогодні` : DAY_NAME[iso]}
            onClick={() => onSelect(index)}
          >
            {short}
            {isToday && <span className="daytab__today" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
