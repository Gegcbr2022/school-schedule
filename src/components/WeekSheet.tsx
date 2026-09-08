import { useId, useMemo, useState } from 'react'
import type { WeekParity } from '../data/schedule'
import { plural } from '../lib/clock'
import { useBackdropClose, useModal } from '../lib/hooks'
import type { ViewMode } from '../lib/lessons'
import type { Profile } from '../lib/prefs'
import { clubsOn, profileDay, profileName, profileTeacher, withClubs } from '../lib/profiles'
import { weekFrom } from '../lib/teacherSchedule'
import { CloseIcon } from './Icons'
import { WeekGrid } from './WeekGrid'

type Props = {
  profile: Profile
  mode: ViewMode
  /** Парність поточного тижня — з неї й починаємо. */
  currentWeek: WeekParity
  /** Сьогоднішній день (ISO 1…5), щоб підсвітити; вихідні — не передавати. */
  todayIso?: number
  /** Парність сьогоднішнього тижня: підсвічуємо день лише в ній. */
  todayWeek: WeekParity
  onClose: () => void
}

const DAYS = [0, 1, 2, 3, 4]

/**
 * Увесь тиждень одним екраном — те, чого в застосунку бракувало найбільше:
 * у стрічці днів видно лише один день за раз, а планують тиждень.
 */
export function WeekSheet({ profile, mode, currentWeek, todayIso, todayWeek, onClose }: Props) {
  const headingId = useId()
  const sheetRef = useModal(onClose)
  const backdrop = useBackdropClose(onClose)
  const [week, setWeek] = useState<WeekParity>(currentWeek)

  const days = useMemo(
    () =>
      weekFrom(
        DAYS.map((day) =>
          withClubs(profileDay(profile, day, week, mode), clubsOn(profile, day + 1, week)),
        ),
      ),
    [profile, mode, week],
  )

  const lessons = days.reduce((n, day) => n + day.count, 0)
  const windows = days.reduce((n, day) => n + day.windows, 0)
  const clubs = days.reduce((n, day) => n + day.clubs, 0)
  const teacher = profileTeacher(profile)

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
            Тиждень
          </h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити">
            <CloseIcon />
          </button>
        </div>

        <p className="sheet__intro">
          {profileName(profile)}
          {!teacher && mode === 'full' && ' · усі групи'} · {lessons}{' '}
          {plural(lessons, ['урок', 'уроки', 'уроків'])}
          {windows > 0 && (
            <>
              {' '}
              · {windows} {plural(windows, ['вікно', 'вікна', 'вікон'])}
            </>
          )}
          {clubs > 0 && (
            <>
              {' '}
              · {clubs} {plural(clubs, ['гурток', 'гуртки', 'гуртків'])}
            </>
          )}
        </p>

        <div className="modeswitch" role="group" aria-label="Тиждень">
          <button type="button" aria-pressed={week === 1} onClick={() => setWeek(1)}>
            1 тиждень
          </button>
          <button type="button" aria-pressed={week === 2} onClick={() => setWeek(2)}>
            2 тиждень
          </button>
        </div>

        {/* Сьогодні підсвічуємо лише тоді, коли на екрані саме його тиждень. */}
        <WeekGrid days={days} todayIso={week === todayWeek ? todayIso : undefined} />

        <div className="sheet__actions">
          <button type="button" className="btn btn--wide" onClick={onClose}>
            Закрити
          </button>
        </div>
      </div>
    </div>
  )
}
