import { useEffect, useId, useState } from 'react'
import type { WeekParity } from '../data/schedule'
import { formatDuration, formatTime, plural } from '../lib/clock'
import { useBackdropClose, useModal } from '../lib/hooks'
import type { DayStatus, DisplayLesson } from '../lib/lessons'
import { computeStatus, roomLabel } from '../lib/lessons'
import type { Profile, Role } from '../lib/prefs'
import {
  ROLE_ALL_TITLE,
  clubsOn,
  lessonsOnly,
  profileDay,
  profileName,
  profileTag,
  profileTone,
  withClubs,
} from '../lib/profiles'
import { CheckIcon, CloseIcon } from './Icons'

type Props = {
  role: Role
  profiles: Profile[]
  /** «Середа, 9 вересня» — який саме день зведено. */
  when: string
  /** День тижня за ISO, 1 (Пн) … 7 (Нд). */
  iso: number
  week: WeekParity
  /** Уроків цього дня немає ні в кого: вихідний або свято. */
  noLessons: boolean
  /** Київські хвилини — якщо зведено саме сьогодні; інакше `null`. */
  nowMin: number | null
  /** Відкрити розклад одного профілю. */
  onPick: (id: string) => void
  onClose: () => void
}

type Line = {
  profile: Profile
  rows: DisplayLesson[]
  lessons: DisplayLesson[]
  status: DayStatus | null
}

/** Уроки профілю на цей день; у вихідні їх немає ні в кого. */
function schoolDay(profile: Profile, iso: number, week: WeekParity): DisplayLesson[] {
  return iso > 5 ? [] : lessonsOnly(profileDay(profile, iso - 1, week, 'my'))
}

function subjectOf(lesson: DisplayLesson): string {
  return lesson.items.map((i) => i.subject).join(' / ')
}

/** Де саме — клас і кабінет; клас має сенс лише в розкладі вчителя. */
function whereOf(lesson: DisplayLesson): string {
  const cls = lesson.items.find((i) => i.cls)?.cls
  const room = roomLabel(lesson.items.find((i) => i.room)?.room)
  return [cls, room].filter(Boolean).join(', ')
}

/** Що з цим профілем просто зараз — одним рядком. */
function statusLine(status: DayStatus): string | null {
  if (status.kind === 'empty') return null
  if (status.kind === 'done') return 'На сьогодні все'

  if (status.kind === 'lesson') {
    const where = whereOf(status.current)
    const what = where ? `${subjectOf(status.current)} · ${where}` : subjectOf(status.current)
    return `Зараз: ${what} — до ${formatTime(status.current.end)}`
  }

  if (status.kind === 'before') {
    return `Починає о ${formatTime(status.next.start)} · ${subjectOf(status.next)}`
  }
  const when = `${subjectOf(status.next)} о ${formatTime(status.next.start)}`
  return status.free > 0 ? `Вікно · далі ${when}` : `Перерва · далі ${when}`
}

/** Найближче, що ще попереду, — по всіх профілях одразу. */
function nextUpAll(lines: Line[], nowMin: number): { who: Profile; row: DisplayLesson } | null {
  let best: { who: Profile; row: DisplayLesson } | null = null
  for (const line of lines) {
    const row = line.rows.find((r) => r.start > nowMin)
    if (row && (!best || row.start < best.row.start)) best = { who: line.profile, row }
  }
  return best
}

/**
 * Усі профілі на один день.
 *
 * Свідомо не сітка уроків у колонках: на телефоні три колонки — це десять
 * символів на предмет, і читати їх ніхто не буде. Зводимо не дані, а
 * відповіді: коли починає, коли закінчує, що зараз і чи не накладається
 * гурток. Завучу той самий екран відповідає «хто де зараз».
 */
export function AllDaySheet({
  role,
  profiles,
  when,
  iso,
  week,
  noLessons,
  nowMin,
  onPick,
  onClose,
}: Props) {
  const headingId = useId()
  const sheetRef = useModal(onClose)
  const backdrop = useBackdropClose(onClose)
  const [copied, setCopied] = useState<'idle' | 'done' | 'fail'>('idle')

  useEffect(() => {
    if (copied === 'idle') return
    const id = window.setTimeout(() => setCopied('idle'), 2500)
    return () => window.clearTimeout(id)
  }, [copied])

  const lines: Line[] = profiles.map((profile) => {
    const lessons = noLessons ? [] : schoolDay(profile, iso, week)
    const rows = withClubs(lessons, clubsOn(profile, iso, week))
    return {
      profile,
      rows,
      lessons,
      status: nowMin === null || rows.length === 0 ? null : computeStatus(rows, nowMin),
    }
  })

  const soon = nowMin === null ? null : nextUpAll(lines, nowMin)

  /**
   * Той самий день звичайним текстом. Розіслати ми нічого не можемо —
   * сервера немає, — але бабусі, няні чи у групу школи це відправляють
   * однаково: скопіювали й вставили.
   */
  const asText = () => {
    const out = [when]
    for (const { profile, rows } of lines) {
      const tag = profileTag(profile)
      out.push('', tag ? `${profileName(profile)} · ${tag}` : profileName(profile))
      if (rows.length === 0) {
        out.push(noLessons ? '  вихідний' : '  нічого немає')
        continue
      }
      for (const row of rows) {
        const where = whereOf(row)
        out.push(
          `  ${formatTime(row.start)} ${subjectOf(row)}${where ? `, ${where}` : ''}` +
            (row.club ? ` (гурток${row.note ? `, ${row.note.toLowerCase()}` : ''})` : ''),
        )
      }
    }
    return out.join('\n')
  }

  const copy = () => {
    // Без захищеного з'єднання буфера в браузері немає зовсім — тоді
    // кнопка має сказати про це, а не промовчати.
    if (!navigator.clipboard) {
      setCopied('fail')
      return
    }
    navigator.clipboard
      .writeText(asText())
      .then(() => setCopied('done'))
      .catch(() => setCopied('fail'))
  }

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
            {ROLE_ALL_TITLE[role]}
          </h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити">
            <CloseIcon />
          </button>
        </div>

        <p className="sheet__intro">
          {when}
          {nowMin !== null &&
            (soon
              ? ` · далі ${profileName(soon.who)}: ${subjectOf(soon.row)} о ${formatTime(
                  soon.row.start,
                )} (через ${formatDuration(soon.row.start - nowMin)})`
              : ' · на сьогодні все')}
        </p>

        <ul className="allday">
          {lines.map(({ profile, rows, lessons, status }) => {
            const clubs = rows.filter((row) => row.club)
            const first = rows[0]
            const last = rows[rows.length - 1]
            const now = status ? statusLine(status) : null

            return (
              <li key={profile.id}>
                <button
                  type="button"
                  className={`pcard pcard--t${profileTone(profile)}`}
                  onClick={() => onPick(profile.id)}
                  aria-label={`Відкрити розклад: ${profileName(profile)}`}
                >
                  <span className="pcard__head">
                    <span className="pcard__dot" aria-hidden="true" />
                    <span className="pcard__name">{profileName(profile)}</span>
                    <span className="pcard__sub">{profileTag(profile)}</span>
                  </span>

                  <span className="pcard__span">
                    {rows.length === 0 ? (
                      noLessons ? (
                        'Вихідний'
                      ) : (
                        'Цього дня нічого немає'
                      )
                    ) : (
                      <>
                        {formatTime(first.start)} → {formatTime(last.end)}
                        {lessons.length > 0 && (
                          <>
                            {' · '}
                            {lessons.length} {plural(lessons.length, ['урок', 'уроки', 'уроків'])}
                          </>
                        )}
                      </>
                    )}
                  </span>

                  {now && <span className="pcard__now">{now}</span>}

                  {clubs.map((club) => (
                    <span className="pcard__club" key={club.club}>
                      {subjectOf(club)} о {formatTime(club.start)}
                      {club.items[0]?.room && ` · ${club.items[0].room}`}
                      {club.note && <span className="pcard__warn">{club.note}</span>}
                    </span>
                  ))}
                </button>
              </li>
            )
          })}
        </ul>

        <p className="hint hint--muted">
          {role === 'head'
            ? 'Показуємо лише те, що стоїть у розкладі. Про заміни, лікарняні й позаурочні заходи застосунок не знає.'
            : 'Тут — межі дня й найближче, що буде. Повний розклад відкривається дотиком по картці.'}
        </p>

        <div className="sheet__actions">
          <button type="button" className="btn btn--quiet btn--wide" onClick={copy}>
            {copied === 'done' && <CheckIcon />}
            {copied === 'done'
              ? 'Скопійовано'
              : copied === 'fail'
                ? 'Не вдалося скопіювати'
                : 'Скопіювати як текст'}
          </button>
          <button type="button" className="btn btn--wide" onClick={onClose}>
            Закрити
          </button>
        </div>
      </div>
    </div>
  )
}
