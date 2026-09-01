import { useId, useState } from 'react'
import type { Dim } from '../data/schedule'
import {
  CLASS_GROUPS,
  ENGLISH_GROUPS,
  GENDER_GROUPS,
  GENDER_LABEL,
  GROUP_LABEL,
  LANGUAGE_GROUPS,
  LANGUAGE_LABEL,
} from '../data/schedule'
import { useModal } from '../lib/hooks'
import { classById, classesByGrade, dimensionsOf } from '../lib/lessons'
import { formalName, scheduleTeachers, teacherOf } from '../lib/teachers'
import type { Prefs, Theme } from '../lib/prefs'
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

const TEACHER_LIST = scheduleTeachers()

const ROLE_OPTIONS: Option<'student' | 'teacher'>[] = [
  { value: 'student', label: 'Учня' },
  { value: 'teacher', label: 'Вчителя' },
]

const THEME_OPTIONS: Option<Theme>[] = [
  { value: 'system', label: 'Системна' },
  { value: 'light', label: 'Світла' },
  { value: 'dark', label: 'Темна' },
]

const CLASS_OPTIONS: Option<Prefs['classGroup']>[] = CLASS_GROUPS.map((g) => ({
  value: g,
  label: GROUP_LABEL[g],
}))

const LANGUAGE_OPTIONS: Option<Prefs['language']>[] = LANGUAGE_GROUPS.map((g) => ({
  value: g,
  label: LANGUAGE_LABEL[g],
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
  const onboarding = mode === 'onboarding'
  // Під час знайомства Escape не закриває — клас треба обрати обов'язково.
  const sheetRef = useModal(onboarding ? () => {} : onClose)

  // Під час знайомства зміни ще не збережені — чекаємо на «Готово».
  const update = (patch: Partial<Prefs>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (!onboarding) onPrefs(next)
  }

  const teacherMode = draft.teacherId !== null
  const cls = classById(draft.classId)
  // Питаємо лише про ті поділи, які в цьому класі справді є.
  const dims: Set<Dim> = cls ? dimensionsOf(cls) : new Set()

  // Підгрупи англійської підписуємо вчителем, якщо він відомий.
  const englishOptions: Option<Prefs['english']>[] = ENGLISH_GROUPS.map((g) => {
    const code = cls?.days
      .flat()
      .flatMap((l) => l.c)
      .find((c) => c.g === g)?.t
    const who = code ? teacherOf(code, 'ам', draft.classId) : undefined
    return { value: g, label: g.toUpperCase(), sub: who?.last ?? code }
  })

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
            {onboarding ? 'Ваш клас' : 'Налаштування'}
          </h2>
          {!onboarding && (
            <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити">
              <CloseIcon />
            </button>
          )}
        </div>

        <p className="sheet__intro">
          {onboarding
            ? 'Оберіть свій клас — і побачите саме свій розклад. Учителі можуть увімкнути свій. Змінити можна будь-коли.'
            : 'Налаштування зберігаються лише на цьому пристрої.'}
        </p>

        <Radios
          name="role"
          legend="Чий розклад показувати"
          options={ROLE_OPTIONS}
          value={teacherMode ? 'teacher' : 'student'}
          onChange={(role) =>
            update({
              teacherId: role === 'teacher' ? (draft.teacherId ?? TEACHER_LIST[0].id) : null,
            })
          }
        />

        {teacherMode ? (
          <fieldset className="field">
            <legend className="field__label">Вчитель</legend>
            <select
              className="select"
              value={draft.teacherId ?? ''}
              aria-label="Вчитель"
              onChange={(event) => update({ teacherId: Number(event.target.value) })}
            >
              {TEACHER_LIST.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {formalName(teacher)}
                </option>
              ))}
            </select>
            <p className="field__hint">
              Уроки по всіх класах, з вікнами між ними. Прізвища двох учителів у розкладі
              так і лишились нерозгаданими — їх у списку немає.
            </p>
          </fieldset>
        ) : (
          <>
        <fieldset className="field">
          <legend className="field__label">Клас</legend>
          {classesByGrade().map(({ grade, classes }) => (
            <div className="grade" key={grade}>
              <span className="grade__label">{grade}</span>
              <div className="grade__classes">
                {classes.map((item) => (
                  <label className="option option--tight" key={item.id}>
                    <input
                      type="radio"
                      className="visually-hidden"
                      name="classId"
                      value={item.id}
                      aria-label={`Клас ${item.name}`}
                      checked={draft.classId === item.id}
                      onChange={() => update({ classId: item.id })}
                    />
                    <span>{item.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {cls?.homeroom && <p className="field__hint">Класний керівник: {cls.homeroom}</p>}
        </fieldset>

        {dims.has('classGroup') && (
          <Radios
            name="classGroup"
            legend="Навчальна група"
            options={CLASS_OPTIONS}
            value={draft.classGroup}
            onChange={(classGroup) => update({ classGroup })}
            hint="Ділить клас на спарених уроках — українській, інформатиці, технологіях."
          />
        )}

        {dims.has('language') && (
          <Radios
            name="language"
            legend="Друга іноземна"
            options={LANGUAGE_OPTIONS}
            value={draft.language}
            onChange={(language) => update({ language })}
          />
        )}

        {dims.has('english') && (
          <Radios
            name="english"
            legend="Англійська підгрупа"
            options={englishOptions}
            value={draft.english}
            onChange={(english) => update({ english })}
          />
        )}

        {dims.has('gender') && (
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
        )}
          </>
        )}

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
