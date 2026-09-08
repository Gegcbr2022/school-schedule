import { useEffect, useRef } from 'react'
import { centerInStrip } from '../lib/hooks'
import type { Profile, Role } from '../lib/prefs'
import { ROLE_ADD_LABEL, ROLE_LIST_TITLE, profileName, profileTone } from '../lib/profiles'
import { PlusIcon } from './Icons'

type Props = {
  role: Role
  profiles: Profile[]
  activeId: string
  onPick: (id: string) => void
  /** Відкрити налаштування — там профілі додають, перейменовують і прибирають. */
  onManage: () => void
}

/**
 * Перемикач профілів під шапкою: один дотик — і на екрані розклад іншої
 * дитини, а день, який переглядали, лишається той самий.
 *
 * Смуга з'являється тільки тоді, коли профілів справді кілька: учневі
 * перемикатись нема між чим, і зайвий рядок йому ні до чого.
 */
export function ProfileBar({ role, profiles, activeId, onPick, onManage }: Props) {
  const barRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  // У завуча профілів буває більше, ніж влазить у рядок. Смуга гортається,
  // і активний чип має лишатись видимим — інакше зникає єдина відповідь на
  // питання «чий це зараз екран».
  useEffect(() => {
    centerInStrip(barRef.current, activeRef.current)
  }, [activeId])

  if (profiles.length < 2) return null

  return (
    <div className="pbar" role="group" aria-label={ROLE_LIST_TITLE[role]} ref={barRef}>
      {profiles.map((profile) => (
        <button
          key={profile.id}
          ref={profile.id === activeId ? activeRef : undefined}
          type="button"
          className={`pchip pchip--t${profileTone(profile)}`}
          aria-pressed={profile.id === activeId}
          onClick={() => onPick(profile.id)}
        >
          <span className="pchip__dot" aria-hidden="true" />
          <span className="pchip__name">{profileName(profile)}</span>
        </button>
      ))}

      <button
        type="button"
        className="pchip pchip--add"
        onClick={onManage}
        aria-label={ROLE_ADD_LABEL[role]}
      >
        <PlusIcon />
      </button>
    </div>
  )
}
