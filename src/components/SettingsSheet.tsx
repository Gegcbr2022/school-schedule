import { useEffect, useId, useRef, useState } from 'react'
import {
  CLASS_GROUPS,
  ENGLISH_GROUPS,
  ENGLISH_TEACHERS,
  GENDER_GROUPS,
  LANGUAGE_GROUPS,
  UKRAINIAN_TEACHERS,
} from '../data/schedule'
import type { Prefs, Theme } from '../lib/prefs'
import { CLASS_GROUP_LABEL, GENDER_LABEL, LANGUAGE_LABEL } from '../lib/prefs'
import { CloseIcon } from './Icons'

type Props = {
  /** Перше знайомство показуємо без хрестика і з кнопкою «Готово». */
  mode: 'onboarding' | 'settings'
  prefs: Prefs
  theme: Theme
  onPrefs: (prefs: Prefs) => void
  onTheme: (theme: Theme) => void
  onClose: () => void
  onReset: () => void
}

/** `sub` — дрібний другий рядок під назвою, напр. прізвище вчителя. */
type Option<T> = { value: T; label: string; sub?: string }

/** Група перемикачів на справжніх radio — заради клавіатури й читалок екрана. */
function Radios<T extends string>({
  name,
  legend,
  hint,
  options,
  value,
  onChange,
}: {
  name: string
  legend: string
  hint?: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="field">
      <legend className="field__label">{legend}</legend>
      <div className="options">
        {options.map((option) => (
          <label className="option" key={option.value}>
            <input
              type="radio"
              className="visually-hidden"
              name={name}
              value={option.value}
              aria-label={`${legend}: ${option.label}${option.sub ? `, ${option.sub}` : ''}`}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
            {option.sub && <span className="option__sub">{option.sub}</span>}
          </label>
        ))}
      </div>
      {hint && <p className="field__hint">{hint}</p>}
    </fieldset>
  )
}

const THEME_OPTIONS: Option<Theme>[] = [
  { value: 'system', label: 'Системна' },
  { value: 'light', label: 'Світла' },
  { value: 'dark', label: 'Темна' },
]

const CLASS_OPTIONS: Option<Prefs['classGroup']>[] = CLASS_GROUPS.map((g) => ({
  value: g,
  label: CLASS_GROUP_LABEL[g],
  sub: UKRAINIAN_TEACHERS[g],
}))

const LANGUAGE_OPTIONS: Option<Prefs['language']>[] = LANGUAGE_GROUPS.map((g) => ({
  value: g,
  label: LANGUAGE_LABEL[g],
}))

const ENGLISH_OPTIONS: Option<Prefs['english']>[] = ENGLISH_GROUPS.map((g) => ({
  value: g,
  label: g,
  sub: ENGLISH_TEACHERS[g],
}))

const GENDER_OPTIONS: Option<string>[] = [
  ...GENDER_GROUPS.map((g) => ({ value: g as string, label: GENDER_LABEL[g] })),
  { value: 'none', label: 'Не вказувати' },
]

export function SettingsSheet({
  mode,
  prefs,
  theme,
  onPrefs,
  onTheme,
  onClose,
  onReset,
}: Props) {
  const [draft, setDraft] = useState<Prefs>(prefs)
  const headingId = useId()
  const sheetRef = useRef<HTMLDivElement>(null)
  const onboarding = mode === 'onboarding'

  // Під час знайомства зміни ще не збережені — чекаємо на «Готово».
  const update = (patch: Partial<Prefs>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (!onboarding) onPrefs(next)
  }

  useEffect(() => {
    sheetRef.current?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !onboarding) onClose()
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
    }
  }, [onboarding, onClose])

  return (
    <div
      className="sheet-backdrop"
      onPointerDown={(event) => {
        if (!onboarding && event.target === event.currentTarget) onClose()
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
        <div className="sheet__head">
          <h2 className="sheet__title" id={headingId}>
            {onboarding ? 'Ваші групи' : 'Налаштування'}
          </h2>
          {!onboarding && (
            <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити">
              <CloseIcon />
            </button>
          )}
        </div>

        <p className="sheet__intro">
          {onboarding
            ? 'Деякі уроки різні для різних груп. Оберіть свої — і розклад покаже саме ваші предмети. Змінити можна будь-коли.'
            : 'Налаштування зберігаються лише на цьому пристрої.'}
        </p>

        <Radios
          name="classGroup"
          legend="Навчальна група"
          options={CLASS_OPTIONS}
          value={draft.classGroup}
          onChange={(classGroup) => update({ classGroup })}
          hint="Під номером — вчитель української мови. Ця сама група ділить інформатику, технології, країнознавство та хімію."
        />

        <Radios
          name="language"
          legend="Друга іноземна"
          options={LANGUAGE_OPTIONS}
          value={draft.language}
          onChange={(language) => update({ language })}
        />

        <Radios
          name="english"
          legend="Англійська підгрупа"
          options={ENGLISH_OPTIONS}
          value={draft.english}
          onChange={(english) => update({ english })}
        />

        <Radios
          name="gender"
          legend="Фізкультура"
          options={GENDER_OPTIONS}
          value={draft.gender ?? 'none'}
          onChange={(value) =>
            update({ gender: value === 'none' ? null : (value as Prefs['gender']) })
          }
          hint="Предмет однаковий для всіх — від цього залежить лише номер залу."
        />

        {!onboarding && (
          <Radios
            name="theme"
            legend="Тема"
            options={THEME_OPTIONS}
            value={theme}
            onChange={onTheme}
          />
        )}

        <div className="sheet__actions">
          <button
            type="button"
            className="btn btn--wide"
            onClick={() => {
              if (onboarding) onPrefs(draft)
              onClose()
            }}
          >
            {onboarding ? 'Готово' : 'Закрити'}
          </button>

          {!onboarding && (
            <button type="button" className="linkbtn" onClick={onReset}>
              Скинути налаштування
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
