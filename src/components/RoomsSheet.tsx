import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Period, WeekParity } from '../data/schedule'
import { BELLS, PERIODS } from '../data/schedule'
import { DAY_NAME } from '../lib/clock'
import { useModal } from '../lib/hooks'
import { DAY_SHORT } from '../lib/lessons'
import { periodAfter, periodAt, roomsAt } from '../lib/rooms'
import { CloseIcon, InfoIcon } from './Icons'

type Props = {
  /** День, з якого відкриваємось (ISO 1…7). */
  iso: number
  week: WeekParity
  /** Київські хвилини від півночі — щоб відкритись на поточному уроці. */
  minutes: number
  /** Чи дивимось саме сьогодні: тільки тоді «зараз» щось означає. */
  isToday: boolean
  onClose: () => void
}

const hhmm = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Кабінети: хто де сидить на цьому уроці й що лишається вільним. */
export function RoomsSheet({ iso, week, minutes, isToday, onClose }: Props) {
  const headingId = useId()
  const sheetRef = useModal(onClose)

  // На вихідних показувати «зараз» нічого — відкриваємось на понеділку.
  const weekday = iso >= 1 && iso <= 5 ? iso : null
  const [day, setDay] = useState(weekday ?? 1)
  const running = isToday && weekday ? periodAt(minutes) : null
  const [period, setPeriod] = useState<Period>(
    () => (isToday && weekday ? (running ?? periodAfter(minutes)) : null) ?? 1,
  )

  // Уроків дванадцять, у смугу влазить шість — підвозимо вибраний до ока.
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bar.current
      ?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' })
    // Тільки на відкритті: далі користувач гортає смугу сам.
  }, [])

  const rooms = useMemo(() => roomsAt(day - 1, period, week), [day, period, week])
  const busy = rooms.filter((r) => r.busy.length > 0)
  const free = rooms.filter((r) => r.busy.length === 0)
  const now = running !== null && day === weekday && running === period

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
          <h2 className="sheet__title" id={headingId}>
            Кабінети <span className="beta">бета</span>
          </h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити">
            <CloseIcon />
          </button>
        </div>

        <p className="sheet__intro">
          Хто де сидить за розкладом. Про заміни, перенесення й те, що клас пішов на захід, ми
          не знаємо — тож «вільний» тут означає лише «на цей урок ніхто не записаний».
        </p>

        <div className="modeswitch modeswitch--days" role="group" aria-label="День тижня">
          {DAY_SHORT.map((short, index) => (
            <button
              key={short}
              type="button"
              aria-pressed={day === index + 1}
              aria-label={DAY_NAME[index + 1]}
              onClick={() => setDay(index + 1)}
            >
              {short}
            </button>
          ))}
        </div>

        <div className="periodbar" role="group" aria-label="Урок" ref={bar}>
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              className="periodbar__item"
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
            >
              <span className="periodbar__n">{p}</span>
              <span className="periodbar__time">{hhmm(BELLS[p].start)}</span>
            </button>
          ))}
        </div>

        <p className="rooms__summary">
          {now ? 'Зараз' : `${DAY_NAME[day]}, ${period}-й урок`} · {hhmm(BELLS[period].start)}—
          {hhmm(BELLS[period].end)} · вільних {free.length} з {rooms.length}
        </p>

        {busy.length > 0 && (
          <>
            <h3 className="rooms__head">Зайняті</h3>
            <ul className="rooms">
              {busy.map((room) => (
                <li className="room" key={room.room}>
                  <span className="room__label">{room.label}</span>
                  <span className="room__who">
                    {room.busy.map((use, i) => (
                      <span className="room__use" key={`${use.cls}-${use.subject}-${i}`}>
                        <b>{use.cls}</b> {use.subject}
                        {use.group && <span className="room__group"> · {use.group}</span>}
                        {use.who && <span className="room__teacher"> · {use.who}</span>}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="rooms__head">Вільні за розкладом</h3>
        {free.length > 0 ? (
          <div className="rooms__free">
            {free.map((room) => (
              <span className="chip" key={room.room}>
                {room.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="empty">На цей урок зайняті всі.</p>
        )}

        <p className="hint">
          <InfoIcon />
          <span>
            Функція нова й неточна. Кабінети беруться з паперового розкладу зі стенду, а він
            стоїть лише на середу, четвер і п&apos;ятницю — у понеділок і вівторок їх менше. І
            1–3 класів у застосунку немає взагалі, тож їхні кабінети завжди здаються вільними.
          </span>
        </p>

        <div className="sheet__actions">
          <button type="button" className="btn btn--wide" onClick={onClose}>
            Закрити
          </button>
        </div>
      </div>
    </div>
  )
}
