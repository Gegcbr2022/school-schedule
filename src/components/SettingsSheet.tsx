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
import { haptic } from '../lib/haptics'
import { useBackdropClose, useModal } from '../lib/hooks'
import { classById, classesByGrade, dimensionsOf } from '../lib/lessons'
import type { Prefs, Profile, Role, Theme } from '../lib/prefs'
import {
  DEFAULT_CLASS_ID,
  DEFAULT_GROUPS,
  DEFAULT_NOTIFICATIONS,
  activeProfile,
  isMulti,
  keepStorage,
  nextProfileId,
  withProfile,
} from '../lib/prefs'
import {
  ROLE_ADD_LABEL,
  ROLE_LIST_TITLE,
  profileName,
  profileTag,
  profileTone,
} from '../lib/profiles'
import { formalName, scheduleName, scheduleTeachers, teacherOf } from '../lib/teachers'
import { CloseIcon, PlusIcon, StarIcon, TrashIcon } from './Icons'

type Props = {
  /** Перше знайомство показуємо без хрестика і з кнопкою «Готово». */
  mode: 'onboarding' | 'settings'
  prefs: Prefs
  theme: Theme
  onPrefs: (prefs: Prefs) => void
  onTheme: (theme: Theme) => void
  /** Відкрити гуртки цього профілю. */
  onClubs: () => void
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

const ROLE_OPTIONS: Option<Role>[] = [
  { value: 'student', label: 'Учня' },
  { value: 'teacher', label: 'Вчителя' },
  { value: 'parent', label: 'Батьків' },
  { value: 'head', label: 'Завуча' },
]

const ROLE_HINT: Record<Role, string> = {
  student: 'Свій клас і свої групи.',
  teacher: 'Уроки по всіх класах, з вікнами між ними.',
  parent: 'Кілька дітей, у кожної свій клас і свої гуртки. Перемикач — під шапкою.',
  head: 'Кілька вчителів і класів під оком, з переходом між ними в один дотик.',
}

const THEME_OPTIONS: Option<Theme>[] = [
  { value: 'system', label: 'Системна' },
  { value: 'light', label: 'Світла' },
  { value: 'dark', label: 'Темна' },
]

const CLASS_OPTIONS: Option<Profile['classGroup']>[] = CLASS_GROUPS.map((g) => ({
  value: g,
  label: GROUP_LABEL[g],
}))

const LANGUAGE_OPTIONS: Option<Profile['language']>[] = LANGUAGE_GROUPS.map((g) => ({
  value: g,
  label: LANGUAGE_LABEL[g],
}))

const GENDER_OPTIONS: Option<string>[] = [
  ...GENDER_GROUPS.map((g) => ({ value: g as string, label: GENDER_LABEL[g] })),
  { value: 'none', label: 'Не вказувати' },
]

const KIND_OPTIONS: Option<'class' | 'teacher'>[] = [
  { value: 'class', label: 'Клас' },
  { value: 'teacher', label: 'Вчитель' },
]

const START_LEAD_OPTIONS = [0, 5, 10, 15, 30]
const END_LEAD_OPTIONS = [0, 5, 10, 15]
const HOMEWORK_LEAD_OPTIONS = [15, 30, 60, 120, 180]

function leadLabel(minutes: number): string {
  if (minutes === 0) return 'У момент дзвінка'
  if (minutes < 60) return `За ${minutes} хв`
  return `За ${minutes / 60} год`
}

/** Клас і групи одного профілю — те саме поле для учня, дитини й завуча. */
function ClassFields({
  profile,
  onChange,
}: {
  profile: Profile
  onChange: (patch: Partial<Profile>) => void
}) {
  const cls = classById(profile.classId)
  // Питаємо лише про ті поділи, які в цьому класі справді є.
  const dims: Set<Dim> = cls ? dimensionsOf(cls) : new Set()

  // Підгрупи англійської підписуємо вчителем, якщо він відомий.
  const englishOptions: Option<Profile['english']>[] = ENGLISH_GROUPS.map((g) => {
    const code = cls?.days
      .flat()
      .flatMap((l) => l.c)
      .find((c) => c.g === g)?.t
    const who = code ? teacherOf(code, 'ам', profile.classId) : undefined
    return { value: g, label: g.toUpperCase(), sub: who ? scheduleName(who) : code }
  })

  return (
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
                    checked={profile.classId === item.id}
                    onChange={() => onChange({ classId: item.id })}
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
          value={profile.classGroup}
          onChange={(classGroup) => onChange({ classGroup })}
          hint="Ділить клас на спарених уроках — українській, інформатиці, технологіях."
        />
      )}

      {dims.has('language') && (
        <Radios
          name="language"
          legend="Друга іноземна"
          options={LANGUAGE_OPTIONS}
          value={profile.language}
          onChange={(language) => onChange({ language })}
        />
      )}

      {dims.has('english') && (
        <Radios
          name="english"
          legend="Англійська підгрупа"
          options={englishOptions}
          value={profile.english}
          onChange={(english) => onChange({ english })}
        />
      )}

      {dims.has('gender') && (
        <Radios
          name="gender"
          legend="Фізкультура"
          options={GENDER_OPTIONS}
          value={profile.gender ?? 'none'}
          onChange={(value) =>
            onChange({ gender: value === 'none' ? null : (value as Profile['gender']) })
          }
          hint="Предмет однаковий для всіх — від цього залежить лише номер залу."
        />
      )}
    </>
  )
}

export function SettingsSheet({
  mode,
  prefs,
  theme,
  onPrefs,
  onTheme,
  onClubs,
  onClose,
  onReset,
}: Props) {
  const [draft, setDraft] = useState<Prefs>(prefs)
  const headingId = useId()
  const onboarding = mode === 'onboarding'
  // Під час знайомства Escape не закриває — клас треба обрати обов'язково.
  const sheetRef = useModal(onboarding ? () => {} : onClose)
  const backdrop = useBackdropClose(onboarding ? () => {} : onClose)

  // Під час знайомства зміни ще не збережені — чекаємо на «Готово».
  const commit = (next: Prefs) => {
    setDraft(next)
    if (!onboarding) onPrefs(next)
  }

  const profile = activeProfile(draft)
  const update = (patch: Partial<Profile>) => commit(withProfile(draft, { ...profile, ...patch }))

  /*
   * Список профілів показуємо не лише в «багатопрофільних» ролях, а й
   * усюди, де профілів справді кілька: інакше той, хто повернув роль
   * назад на «Учня», більше не дістанеться до заведених профілів.
   */
  const multi = isMulti(draft.role) || draft.profiles.length > 1
  const teacherMode = profile.teacherId !== null
  const notifications = draft.notifications ?? DEFAULT_NOTIFICATIONS
  /*
   * Ким саме є профіль, питаємо там, де профілів кілька: учителька з
   * двома дітьми в цій же школі має тримати поруч і свій розклад, і
   * їхній, а не перемикати роль по колу десять разів на день.
   */
  const askKind = multi

  const setRole = (role: Role) => {
    // Роль не переписує чужі профілі — лише той, що зараз відкрито, і лише
    // тоді, коли в новій ролі він інакше не має сенсу.
    let fixed = profile
    if (role === 'teacher' && profile.teacherId === null) {
      fixed = { ...profile, teacherId: TEACHER_LIST[0].id }
    } else if (role === 'student' && profile.teacherId !== null) {
      fixed = { ...profile, teacherId: null }
    }
    commit({ ...withProfile(draft, fixed), role })
  }

  const addProfile = () => {
    const added: Profile = {
      ...DEFAULT_GROUPS,
      id: nextProfileId(draft),
      name: '',
      classId: DEFAULT_CLASS_ID,
      teacherId: null,
      clubs: [],
    }
    // Друга дитина — це вже вкладена праця; просимо браузер берегти сховище.
    keepStorage()
    commit({ ...draft, profiles: [...draft.profiles, added], activeId: added.id })
  }

  const setNotifications = (patch: Partial<typeof notifications>) => {
    commit({ ...draft, notifications: { ...notifications, ...patch } })
  }

  const removeProfile = (victim: Profile) => {
    if (draft.profiles.length < 2) return
    if (!window.confirm(`Прибрати ${profileName(victim)}? Гуртки цього профілю зникнуть.`)) return
    haptic('warning')
    const rest = draft.profiles.filter((p) => p.id !== victim.id)
    commit({
      ...draft,
      profiles: rest,
      activeId: draft.activeId === victim.id ? rest[0].id : draft.activeId,
    })
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
        {/* Під час знайомства аркуш не закривається, тож і тягнути нема куди. */}
        {!onboarding && <div className="sheet__grip" aria-hidden="true" />}

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
            ? 'Оберіть свій клас — і побачите саме свій розклад. Учителі, батьки й завучі можуть увімкнути свій режим. Змінити можна будь-коли.'
            : 'Налаштування зберігаються лише на цьому пристрої.'}
        </p>

        <Radios
          name="role"
          legend="Чий розклад показувати"
          options={ROLE_OPTIONS}
          value={draft.role}
          onChange={setRole}
          hint={ROLE_HINT[draft.role]}
        />

        {multi && (
          <fieldset className="field">
            <legend className="field__label">{ROLE_LIST_TITLE[draft.role]}</legend>
            <ul className="plist">
              {draft.profiles.map((item) => (
                <li className="plist__item" key={item.id}>
                  <button
                    type="button"
                    className={`plist__pick plist__pick--t${profileTone(item)}`}
                    aria-pressed={item.id === draft.activeId}
                    onClick={() => commit({ ...draft, activeId: item.id })}
                  >
                    <span className="plist__dot" aria-hidden="true" />
                    <span className="plist__name">{profileName(item)}</span>
                    <span className="plist__sub">{profileTag(item)}</span>
                  </button>
                  {draft.profiles.length > 1 && (
                    <button
                      type="button"
                      className="iconbtn iconbtn--small"
                      onClick={() => removeProfile(item)}
                      aria-label={`Прибрати ${profileName(item)}`}
                    >
                      <TrashIcon />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn--quiet btn--wide" onClick={addProfile}>
              <PlusIcon />
              {ROLE_ADD_LABEL[draft.role]}
            </button>
            <p className="field__hint">
              Нижче — налаштування того, кого обрано. Перемикати на головному екрані можна
              смугою під шапкою.
            </p>
          </fieldset>
        )}

        {multi && (
          <fieldset className="field">
            <legend className="field__label">Як звати</legend>
            <input
              className="textinput"
              type="text"
              value={profile.name}
              maxLength={40}
              placeholder={profileName(profile)}
              aria-label="Ім'я профілю"
              onChange={(event) => update({ name: event.target.value })}
            />
            <p className="field__hint">
              Можна лишити порожнім — тоді профіль підписаний назвою класу.
            </p>
          </fieldset>
        )}

        {askKind && (
          <Radios
            name="kind"
            legend="Це розклад"
            options={KIND_OPTIONS}
            value={teacherMode ? 'teacher' : 'class'}
            onChange={(kind) =>
              update({
                teacherId: kind === 'teacher' ? (profile.teacherId ?? TEACHER_LIST[0].id) : null,
              })
            }
          />
        )}

        {teacherMode ? (
          <fieldset className="field">
            <legend className="field__label">Вчитель</legend>
            <select
              className="select"
              value={profile.teacherId ?? ''}
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
          <ClassFields profile={profile} onChange={update} />
        )}

        {!onboarding && (
          <fieldset className="field">
            <legend className="field__label">Поза уроками</legend>
            <button type="button" className="btn btn--quiet btn--wide" onClick={onClubs}>
              <StarIcon />
              Гуртки {profile.clubs.length > 0 && `(${profile.clubs.length})`}
            </button>
            <p className="field__hint">
              Секції, музична школа, репетитор — стануть у стрічку дня разом з уроками.
            </p>
          </fieldset>
        )}

        {!onboarding && (
          <fieldset className="field">
            <legend className="field__label">Сповіщення</legend>
            <div className="checks">
              <label className="check">
                <input
                  type="checkbox"
                  checked={notifications.enabled}
                  onChange={(event) => setNotifications({ enabled: event.target.checked })}
                />
                <span>
                  <span className="check__label">Увімкнути нагадування</span>
                  <span className="check__hint">iPhone попросить дозвіл під час першої синхронізації.</span>
                </span>
              </label>

              <label className="check">
                <input
                  type="checkbox"
                  checked={notifications.lessonStart}
                  disabled={!notifications.enabled}
                  onChange={(event) => setNotifications({ lessonStart: event.target.checked })}
                />
                <span className="check__label">Перед початком уроку або гуртка</span>
              </label>
              <select
                className="select select--compact"
                value={notifications.lessonStartLead}
                disabled={!notifications.enabled || !notifications.lessonStart}
                aria-label="Коли нагадувати перед початком"
                onChange={(event) => setNotifications({ lessonStartLead: Number(event.target.value) })}
              >
                {START_LEAD_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {leadLabel(value)}
                  </option>
                ))}
              </select>

              <label className="check">
                <input
                  type="checkbox"
                  checked={notifications.lessonEnd}
                  disabled={!notifications.enabled}
                  onChange={(event) => setNotifications({ lessonEnd: event.target.checked })}
                />
                <span className="check__label">Перед кінцем уроку</span>
              </label>
              <select
                className="select select--compact"
                value={notifications.lessonEndLead}
                disabled={!notifications.enabled || !notifications.lessonEnd}
                aria-label="Коли нагадувати перед кінцем уроку"
                onChange={(event) => setNotifications({ lessonEndLead: Number(event.target.value) })}
              >
                {END_LEAD_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {leadLabel(value)}
                  </option>
                ))}
              </select>

              <label className="check">
                <input
                  type="checkbox"
                  checked={notifications.homework}
                  disabled={!notifications.enabled}
                  onChange={(event) => setNotifications({ homework: event.target.checked })}
                />
                <span className="check__label">Про домашку й нотатки до уроків</span>
              </label>
              <select
                className="select select--compact"
                value={notifications.homeworkLead}
                disabled={!notifications.enabled || !notifications.homework}
                aria-label="Коли нагадувати про домашку"
                onChange={(event) => setNotifications({ homeworkLead: Number(event.target.value) })}
              >
                {HOMEWORK_LEAD_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {leadLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <p className="field__hint">
              Нагадування ставляться на найближчі чотири тижні й оновлюються після змін у розкладі, профілях або ДЗ.
            </p>
          </fieldset>
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
