import { useEffect, useRef } from 'react'
import type { CalendarDate } from '../lib/clock'
import { addDays, dateKey, isoOf } from '../lib/clock'

/** Короткі назви днів за ISO-номером (1 = понеділок). */
const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

type Props = {
  today: CalendarDate
  selected: CalendarDate
  onSelect: (date: CalendarDate) => void
}

/**
 * Горизонтальна смуга днів: цей тиждень і наступний, з числами й вихідними.
 * Вибраний день підсвічено, сьогоднішній має крапку, смуга сама доводить
 * вибраний день у видиму зону.
 */
export function DateStrip({ today, selected, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  // Від понеділка поточного тижня — два тижні поспіль (14 днів).
  const start = addDays(today, 1 - isoOf(today))
  const days = Array.from({ length: 14 }, (_, i) => addDays(start, i))

  const todayKey = dateKey(today)
  const selectedKey = dateKey(selected)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [selectedKey])

  return (
    <div className="datestrip" ref={scrollRef} role="group" aria-label="Дні">
      {days.map((date) => {
        const iso = isoOf(date)
        const key = dateKey(date)
        const isToday = key === todayKey
        const isSelected = key === selectedKey
        const weekend = iso > 5

        return (
          <button
            key={key}
            ref={isSelected ? selectedRef : undefined}
            type="button"
            className={`daycol${weekend ? ' daycol--weekend' : ''}`}
            aria-pressed={isSelected}
            aria-label={`${WEEKDAY_SHORT[iso - 1]} ${date.day}${isToday ? ', сьогодні' : ''}`}
            onClick={() => onSelect(date)}
          >
            <span className="daycol__wd">{WEEKDAY_SHORT[iso - 1]}</span>
            <span className="daycol__num">{date.day}</span>
            {isToday && <span className="daycol__today" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
