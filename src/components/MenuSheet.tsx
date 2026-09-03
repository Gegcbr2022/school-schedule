import { useId, useState } from 'react'
import type { Dish } from '../data/menu'
import {
  MENU_FOR,
  MENU_FROM,
  MENU_TITLE,
  MENU_TO,
  menuCovers,
  menuFor,
  portion,
} from '../data/menu'
import { DAY_NAME, formatDateUk, parseDateKey } from '../lib/clock'
import { useModal } from '../lib/hooks'
import { DAY_SHORT } from '../lib/lessons'
import { CloseIcon } from './Icons'

type Props = {
  /** День тижня, з якого починаємо показ (ISO 1…7). */
  iso: number
  /** Дата відкритого дня, `рррр-мм-дд` — щоб сказати, чи меню ще діє. */
  date: string
  onClose: () => void
}

function Meal({ title, dishes }: { title: string; dishes: Dish[] }) {
  return (
    <section className="menu">
      <h3 className="menu__meal">{title}</h3>
      <ul className="menu__list">
        {dishes.map((dish) => (
          <li className="dish" key={dish.name}>
            <span className="dish__name">{dish.name}</span>
            <span className="dish__out">{portion(dish.out)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Що дають у їдальні: сніданок і обід на кожен день тижня. */
export function MenuSheet({ iso, date, onClose }: Props) {
  const headingId = useId()
  const sheetRef = useModal(onClose)
  // На вихідних меню немає — відкриваємо понеділок.
  const [day, setDay] = useState(() => (iso >= 1 && iso <= 5 ? iso : 1))

  const menu = menuFor(day)
  const stale = !menuCovers(date)

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
            Меню
          </h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити">
            <CloseIcon />
          </button>
        </div>

        <p className="sheet__intro">
          {MENU_TITLE}: {MENU_FOR}.
          <br />
          Затверджене з {formatDateUk(parseDateKey(MENU_FROM))} по{' '}
          {formatDateUk(parseDateKey(MENU_TO))}.
          {stale && ' Свіжішого в їдальні ще не давали — страви можуть відрізнятись.'}
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

        {menu ? (
          <>
            <Meal title="Сніданок" dishes={menu.breakfast} />
            <Meal title="Обід · ГПД" dishes={menu.lunch} />
          </>
        ) : (
          <p className="empty">Цього дня їдальня не працює.</p>
        )}

        <div className="sheet__actions">
          <button type="button" className="btn btn--wide" onClick={onClose}>
            Закрити
          </button>
        </div>
      </div>
    </div>
  )
}
