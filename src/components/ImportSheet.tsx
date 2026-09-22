import { useId } from 'react'
import { SCHOOL_NAME } from '../data/schedule'
import { SCHOOL } from '../data/seed/config'
import { plural } from '../lib/clock'
import { haptic } from '../lib/haptics'
import { useBackdropClose, useModal } from '../lib/hooks'
import { classById } from '../lib/lessons'
import type { SharePack } from '../lib/share'
import { CheckIcon, CloseIcon, PlusIcon, StarIcon } from './Icons'

type Props = {
  pack: SharePack
  /** Куди додавати гуртки, якщо обрати «до цього профілю». */
  currentName: string
  onAddProfile: () => void
  onMergeClubs: () => void
  onClose: () => void
}

/**
 * Що робити з тим, що прийшло.
 *
 * Вантаж приходить із чату або через AirDrop, тобто ззовні, — і мовчки
 * підміняти ним чиїсь налаштування не можна. Тому спершу видно, що саме
 * прийшло, і лише потім людина обирає, куди це покласти.
 */
export function ImportSheet({ pack, currentName, onAddProfile, onMergeClubs, onClose }: Props) {
  const headingId = useId()
  const sheetRef = useModal(onClose)
  const backdrop = useBackdropClose(onClose)

  const cls = pack.cls ? classById(pack.cls.id) : undefined
  const clubs = pack.clubs ?? []
  // Чужа школа — це чужий розклад, якого в цьому застосунку просто немає.
  const alien = pack.school !== SCHOOL.id
  const empty = !cls && clubs.length === 0

  return (
    <div className="sheet-backdrop" {...backdrop}>
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
            Прийшов розклад
          </h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити">
            <CloseIcon />
          </button>
        </div>

        {alien ? (
          <>
            <p className="empty">
              Це розклад іншої школи. У застосунку зараз {SCHOOL_NAME} — уроків тієї
              школи в ньому немає, і показати їх нема з чого.
            </p>
            <div className="sheet__actions">
              <button type="button" className="btn btn--wide" onClick={onClose}>
                Зрозуміло
              </button>
            </div>
          </>
        ) : empty ? (
          <>
            <p className="empty">У вантажі нічого немає — можливо, посилання обрізалось.</p>
            <div className="sheet__actions">
              <button type="button" className="btn btn--wide" onClick={onClose}>
                Закрити
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="sheet__intro">
              {pack.name ? `${pack.name} · ` : ''}
              {cls ? cls.name : 'без класу'}
              {clubs.length > 0 &&
                ` · ${clubs.length} ${plural(clubs.length, ['гурток', 'гуртки', 'гуртків'])}`}
            </p>

            <ul className="shared">
              {cls && (
                <li>
                  <CheckIcon />
                  {cls.name}
                  {cls.homeroom && <span className="shared__who"> · {cls.homeroom}</span>}
                </li>
              )}
              {clubs.map((club) => (
                <li key={club.id}>
                  <StarIcon />
                  {club.name}
                  {club.teacher && <span className="shared__who"> · {club.teacher}</span>}
                </li>
              ))}
            </ul>

            <div className="sheet__actions">
              <button
                type="button"
                className="btn btn--wide"
                onClick={() => {
                  haptic('success')
                  onAddProfile()
                }}
              >
                <PlusIcon />
                Додати окремим профілем
              </button>

              {clubs.length > 0 && (
                <button
                  type="button"
                  className="btn btn--quiet btn--wide"
                  onClick={() => {
                    haptic('success')
                    onMergeClubs()
                  }}
                >
                  Додати лише гуртки до «{currentName}»
                </button>
              )}

              <p className="field__hint">
                Нічого з того, що вже налаштовано, не зникне: окремий профіль стає
                поруч, а гуртки додаються до наявних.
              </p>

              <button type="button" className="linkbtn" onClick={onClose}>
                Не треба
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
