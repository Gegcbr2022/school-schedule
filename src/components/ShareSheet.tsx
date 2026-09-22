import { useId, useRef, useState } from 'react'
import { haptic } from '../lib/haptics'
import { useBackdropClose, useModal } from '../lib/hooks'
import type { Profile } from '../lib/prefs'
import { profileName, profileSub } from '../lib/profiles'
import type { ShareOptions } from '../lib/share'
import { LINK_LIMIT, buildPack, canShareFile, packFile, packLink } from '../lib/share'
import { CheckIcon, CloseIcon, ShareIcon } from './Icons'

type Props = {
  profile: Profile
  onClose: () => void
}

/**
 * Поділитися налаштованим розкладом.
 *
 * Найдовше в застосунку — не встановити його, а налаштувати: клас,
 * своя підгрупа англійської, усі гуртки з часом і дорогою. Один раз це
 * робить хтось один, а потім те саме вручну повторюють на телефоні
 * дитини й у двох однокласників. Тут з цього лишається один дотик.
 */
export function ShareSheet({ profile, onClose }: Props) {
  const headingId = useId()
  const sheetRef = useModal(onClose)
  const backdrop = useBackdropClose(onClose)

  const [options, setOptions] = useState<ShareOptions>({
    schedule: true,
    clubs: profile.clubs.length > 0,
    // За замовчуванням чужих даних не віддаємо: телефон тренера в чаті
    // класу — це те, про що потім шкодують.
    clean: true,
  })
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  /**
   * Показати саме посилання.
   *
   * Запасний шлях на випадок, коли буфер обміну недоступний, — а він
   * недоступний частіше, ніж здається: браузер може не вважати
   * походження захищеним, а всередині застосунку своя схема адрес.
   * Тоді лишається найпростіше: показати рядок і дати його виділити.
   */
  const [showLink, setShowLink] = useState(false)
  const linkRef = useRef<HTMLInputElement>(null)

  const set = (patch: Partial<ShareOptions>) => setOptions((o) => ({ ...o, ...patch }))

  const pack = buildPack(profile, options)
  const link = packLink(pack)
  const nothing = !options.schedule && !options.clubs
  const tooLong = link.length > LINK_LIMIT
  const hasPrivate = profile.clubs.some((c) => c.phone || c.note)

  const share = async () => {
    setFailed(null)
    try {
      if (canShareFile(pack)) {
        await navigator.share({ files: [packFile(pack)], title: profileName(profile) })
        haptic('success')
        return
      }
      await navigator.share({ url: link, title: profileName(profile) })
      haptic('success')
    } catch (error) {
      // Передумали — це не помилка, і говорити про неї не треба.
      if (error instanceof DOMException && error.name === 'AbortError') return
      setFailed('Не вдалося відкрити «Поділитися». Скопіюйте посилання.')
    }
  }

  const copy = async () => {
    setFailed(null)

    try {
      await navigator.clipboard.writeText(link)
      haptic('success')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
      return
    } catch {
      /* Буфер недоступний — пробуємо по-старому. */
    }

    // Старий спосіб: виділити текст у прихованому полі й скопіювати
    // виділення. Він працює там, де сучасного буфера немає, — а саме
    // це й буває у вебʼю з власною схемою адрес.
    try {
      const field = document.createElement('textarea')
      field.value = link
      field.setAttribute('readonly', '')
      field.style.position = 'fixed'
      field.style.opacity = '0'
      document.body.appendChild(field)
      field.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(field)
      if (ok) {
        haptic('success')
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2500)
        return
      }
    } catch {
      /* І цей не вийшов. */
    }

    // Нічого не вийшло — показуємо саме посилання. Виділити й
    // скопіювати руками завжди можна.
    setShowLink(true)
    window.setTimeout(() => linkRef.current?.select(), 0)
  }

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
            Поділитися
          </h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити">
            <CloseIcon />
          </button>
        </div>

        <p className="sheet__intro">
          {profileName(profile)} · {profileSub(profile)}
        </p>

        <fieldset className="field">
          <legend className="field__label">Що віддати</legend>
          <div className="checks">
            <label className="check">
              <input
                type="checkbox"
                checked={options.schedule}
                onChange={(event) => set({ schedule: event.target.checked })}
              />
              <span>
                <span className="check__label">Клас і групи</span>
                <span className="check__hint">
                  Той, хто відкриє, одразу побачить саме ваш розклад — без вибору
                  підгрупи англійської навпомацки.
                </span>
              </span>
            </label>

            <label className="check">
              <input
                type="checkbox"
                checked={options.clubs}
                disabled={profile.clubs.length === 0}
                onChange={(event) => set({ clubs: event.target.checked })}
              />
              <span>
                <span className="check__label">
                  Гуртки
                  {profile.clubs.length > 0 && ` (${profile.clubs.length})`}
                </span>
                <span className="check__hint">
                  {profile.clubs.length === 0
                    ? 'У цьому профілі гуртків немає.'
                    : 'З днями, часом і дорогою — так, як налаштовано.'}
                </span>
              </span>
            </label>

            {options.clubs && hasPrivate && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={options.clean}
                  onChange={(event) => set({ clean: event.target.checked })}
                />
                <span>
                  <span className="check__label">Без телефонів і нотаток</span>
                  <span className="check__hint">
                    У нотатках і телефонах бувають чужі дані. Імена тренерів лишаються.
                  </span>
                </span>
              </label>
            )}
          </div>
        </fieldset>

        {/*
          Видно, що саме поїде. Без цього «поділитися» — це кнопка, яка
          відправляє невідомо що, і натискати її страшно.
        */}
        <fieldset className="field">
          <legend className="field__label">Поїде</legend>
          {nothing ? (
            <p className="field__hint">Нічого не обрано.</p>
          ) : (
            <ul className="shared">
              {pack.cls && (
                <li>
                  <CheckIcon />
                  {profileSub(profile)}
                </li>
              )}
              {pack.clubs?.map((club) => (
                <li key={club.id}>
                  <CheckIcon />
                  {club.name}
                  {club.teacher && <span className="shared__who"> · {club.teacher}</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="field__hint">
            Ані нотаток до уроків, ані домашки, ані збережених книжок тут немає —
            тільки те, що в списку.
          </p>
        </fieldset>

        {showLink && (
          <fieldset className="field">
            <legend className="field__label">Посилання</legend>
            <input
              ref={linkRef}
              className="textinput"
              type="text"
              readOnly
              value={link}
              aria-label="Посилання на розклад"
              onFocus={(event) => event.currentTarget.select()}
            />
            <p className="field__hint">Скопіювати автоматично не вийшло — виділіть і скопіюйте.</p>
          </fieldset>
        )}

        {failed && (
          <p className="book__error" role="alert">
            {failed}
          </p>
        )}

        <div className="sheet__actions">
          <button type="button" className="btn btn--wide" disabled={nothing} onClick={() => void share()}>
            <ShareIcon />
            Поділитися
          </button>
          <button
            type="button"
            className="btn btn--quiet btn--wide"
            disabled={nothing || tooLong}
            onClick={() => void copy()}
          >
            {copied ? 'Скопійовано' : 'Скопіювати посилання'}
          </button>
          <p className="field__hint">
            {tooLong
              ? 'Гуртків забагато для посилання — віддайте файлом через «Поділитися».'
              : 'Файлом — через AirDrop чи повідомлення, він відкриється одразу в застосунку. Посиланням — у будь-який чат, воно працює й без застосунку.'}
          </p>
          <button type="button" className="linkbtn" onClick={onClose}>
            Закрити
          </button>
        </div>
      </div>
    </div>
  )
}
