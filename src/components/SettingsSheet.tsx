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
import { OBLASTS, oblastOfKey } from '../data/regions'
import { alertsAvailable } from '../lib/alerts'
import { haptic } from '../lib/haptics'
import { liveWorks } from '../lib/live'
import { notificationsWork } from '../lib/notifications'
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
import { CloseIcon, PlusIcon, ShareIcon, StarIcon, TrashIcon } from './Icons'

type Props = {
  /** Перше знайомство показуємо без хрестика і з кнопкою «Готово». */
  mode: 'onboarding' | 'settings'
  prefs: Prefs
  theme: Theme
  onPrefs: (prefs: Prefs) => void
  onTheme: (theme: Theme) => void
  /** Відкрити гуртки цього профілю. */
  onClubs: () => void
  /** Поділитися налаштованим розкладом. */
  onShare: () => void
  onClose: () => void
  onReset: () => void
}

/** `sub` — дрібний другий рядок під назвою, напр. прізвище вчителя. */
type Option<T> = { value: T; label: string; sub?: string }

/** Група перемикачів на справжніх radio — заради клавіатури й читалок екрана. */
/** Вкладки аркуша налаштувань — рівно стільки, щоб жодна не прокручувалась. */
const ALL_TABS = ['клас', 'групи', 'профіль', 'ще', 'тривога'] as const
type Tab = (typeof ALL_TABS)[number]
const TAB_LABEL: Record<Tab, string> = {
  'клас': 'Клас',
  'групи': 'Групи',
  'профіль': 'Профіль',
  // Не «Ще»: на цій вкладці лише нагадування, і краще сказати це прямо,
  // ніж лишати людину гадати, що там сховано.
  'ще': 'Нагадування',
  'тривога': 'Тривога',
}

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
type FieldsProps = {
  profile: Profile
  onChange: (patch: Partial<Profile>) => void
}

/** Вибір класу — окремо від поділів, бо вони живуть на різних вкладках. */
function ClassPicker({ profile, onChange }: FieldsProps) {
  const cls = classById(profile.classId)
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
    </>
  )
}

/**
 * Поділи класу: навчальна група, друга іноземна, англійська підгрупа,
 * фізкультура. Питаємо лише про ті, які в цьому класі справді є.
 */
function GroupFields({ profile, onChange }: FieldsProps) {
  const cls = classById(profile.classId)
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

  if (dims.size === 0) {
    return <p className="field__hint">Цей клас ні на що не ділиться — налаштовувати нічого.</p>
  }

  return (
    <>
      {dims.has('classGroup') && (
        <Radios
          name="classGroup"
          legend="Навчальна група"
          options={CLASS_OPTIONS}
          value={profile.classGroup}
          onChange={(classGroup) => onChange({ classGroup })}
          hint="Ділить клас навпіл на уроках, де групи вчаться окремо."
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
  onShare,
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
   * Аркуш налаштувань не прокручується: усе, що в ньому є, розкладено по
   * вкладках, і видно рівно одну. Інакше на телефоні це сувій на три
   * екрани, у якому «Тема» захована десь під сповіщеннями.
   */
  const [tab, setTab] = useState<Tab>('клас')

  /*
   * Нагадування ставить операційна система телефона. У браузері й у PWA
   * містка до неї немає, тож вкладки теж немає: показувати перемикачі,
   * які нічого не вмикають, — обіцяти те, чого застосунок не зробить.
   */
  const TABS = ALL_TABS.filter((name) => {
    if (name === 'ще') return notificationsWork()
    // Вкладки тривоги немає там, де застосунок зібрали без адреси
    // джерела: обіцяти стеження, якого не буде, гірше, ніж мовчати.
    if (name === 'тривога') return alertsAvailable()
    return true
  })
  const shown = TABS.includes(tab) ? tab : 'клас'

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

  const setAlerts = (patch: Partial<typeof draft.alerts>) => {
    commit({ ...draft, alerts: { ...draft.alerts, ...patch } })
  }

  /*
   * Область обраного місця. Обраним може бути і сама область, і район у
   * ній — у налаштуваннях зберігається один ключ, а списків два: другий
   * просто показує райони тієї області, яку видно в першому.
   */
  const pickedOblast = oblastOfKey(draft.alerts.region)

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
        className={onboarding ? 'sheet sheet--tight' : 'sheet sheet--tight sheet--fixed'}
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

        {onboarding && (
          <p className="sheet__intro">
            Оберіть свій клас — і побачите саме свій розклад. Учителі, батьки й завучі
            можуть увімкнути свій режим. Змінити можна будь-коли.
          </p>
        )}

        {!onboarding && (
          <div className="sheet__tabs" role="tablist" aria-label="Розділи налаштувань">
            {TABS.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={shown === name}
                onClick={() => setTab(name)}
              >
                {TAB_LABEL[name]}
              </button>
            ))}
          </div>
        )}

        <div className={onboarding ? undefined : 'sheet__pane'}>

        {(onboarding || shown === 'профіль') && (
        <Radios
          name="role"
          legend="Чий розклад показувати"
          options={ROLE_OPTIONS}
          value={draft.role}
          onChange={setRole}
          hint={ROLE_HINT[draft.role]}
        />
        )}

        {(onboarding || shown === 'профіль') && multi && (
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

        {(onboarding || shown === 'клас') && askKind && (
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

        {(onboarding || shown === 'клас') && teacherMode ? (
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
        ) : null}

        {(onboarding || shown === 'клас') && !teacherMode && (
          <ClassPicker profile={profile} onChange={update} />
        )}

        {!onboarding && shown === 'групи' && !teacherMode && (
          <GroupFields profile={profile} onChange={update} />
        )}

        {!onboarding && shown === 'профіль' && (
          <fieldset className="field">
            <legend className="field__label">Поза уроками</legend>
            <button type="button" className="btn btn--quiet btn--wide" onClick={onClubs}>
              <StarIcon />
              Гуртки {profile.clubs.length > 0 && `(${profile.clubs.length})`}
            </button>
            <p className="field__hint">
              Секції, музична школа, репетитор — стануть у стрічку дня разом з уроками.
            </p>

            <button type="button" className="btn btn--quiet btn--wide" onClick={onShare}>
              <ShareIcon />
              Поділитися розкладом
            </button>
            <p className="field__hint">
              Клас, групи й гуртки одним файлом або посиланням — щоб не налаштовувати
              те саме вдруге на іншому телефоні.
            </p>
          </fieldset>
        )}

        {!onboarding && shown === 'ще' && (
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

              <label className="check">
                <input
                  type="checkbox"
                  checked={notifications.clubLeave}
                  disabled={!notifications.enabled}
                  onChange={(event) => setNotifications({ clubLeave: event.target.checked })}
                />
                <span>
                  <span className="check__label">Що час виходити на гурток</span>
                  <span className="check__hint">
                    За дорогою, яку вказали в гуртку, — а не тоді, коли заняття вже почалось.
                  </span>
                </span>
              </label>

              <label className="check">
                <input
                  type="checkbox"
                  checked={notifications.clubPayment}
                  disabled={!notifications.enabled}
                  onChange={(event) => setNotifications({ clubPayment: event.target.checked })}
                />
                <span>
                  <span className="check__label">Про оплату гуртка</span>
                  <span className="check__hint">За три дні до дати «оплачено до» і в сам день.</span>
                </span>
              </label>
            </div>
            <p className="field__hint">
              Нагадування ставляться на найближчі чотири тижні й оновлюються після змін у розкладі, профілях або ДЗ.
            </p>
          </fieldset>
        )}

        {!onboarding && shown === 'ще' && liveWorks() && (
          <fieldset className="field">
            <legend className="field__label">Екран блокування</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={draft.live}
                onChange={(event) => commit({ ...draft, live: event.target.checked })}
              />
              <span>
                <span className="check__label">Показувати урок на екрані блокування</span>
                <span className="check__hint">
                  Поточний урок і відлік до дзвінка — на екрані блокування й у динамічному
                  острові. З'являється в навчальний день і зникає після останнього уроку.
                </span>
              </span>
            </label>
          </fieldset>
        )}

        {!onboarding && shown === 'тривога' && (
          <>
            <fieldset className="field">
              <legend className="field__label">Повітряна тривога</legend>
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.alerts.enabled}
                  onChange={(event) => setAlerts({ enabled: event.target.checked })}
                />
                <span>
                  <span className="check__label">Стежити за тривогою</span>
                  <span className="check__hint">
                    Показувати стан над розкладом і підказувати, на який урок повертатись
                    після відбою.
                  </span>
                </span>
              </label>
            </fieldset>

            <fieldset className="field">
              <legend className="field__label">Де ви</legend>
              <select
                className="select"
                value={String(pickedOblast?.uid ?? '')}
                disabled={!draft.alerts.enabled}
                aria-label="Область, за якою стежити"
                onChange={(event) => setAlerts({ region: event.target.value })}
              >
                {OBLASTS.map((oblast) => (
                  <option key={oblast.uid} value={String(oblast.uid)}>
                    {oblast.name}
                  </option>
                ))}
              </select>

              {pickedOblast && pickedOblast.raions.length > 0 && (
                <select
                  className="select select--second"
                  value={draft.alerts.region}
                  disabled={!draft.alerts.enabled}
                  aria-label="Район, за яким стежити"
                  onChange={(event) => setAlerts({ region: event.target.value })}
                >
                  <option value={String(pickedOblast.uid)}>Уся область</option>
                  {pickedOblast.raions.map((raion) => (
                    <option key={raion.uid} value={String(raion.uid)}>
                      {raion.name}
                    </option>
                  ))}
                </select>
              )}

              <p className="field__hint">
                {/*
                  Сама лише область не годиться там, де вона найпотрібніша:
                  у прифронтових областях тривога майже завжди є хоч десь, і
                  цілодобово червона картка швидко перестає щось означати.
                */}
                Район вужчий за область: тривога в іншому її кінці вас не смикатиме.
                Коли оголошують по всій області, вона доходить до кожного району
                однаково.
              </p>
            </fieldset>

            {notificationsWork() && (
              <fieldset className="field">
                <legend className="field__label">Сповіщення</legend>
                <div className="checks">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={draft.alerts.onStart}
                      disabled={!draft.alerts.enabled}
                      onChange={(event) => setAlerts({ onStart: event.target.checked })}
                    />
                    <span>
                      <span className="check__label">Коли тривога почалась</span>
                      <span className="check__hint">
                        І коли жовтий рівень змінюється на червоний — це вже інші дії.
                      </span>
                    </span>
                  </label>

                  <label className="check">
                    <input
                      type="checkbox"
                      checked={draft.alerts.onEnd}
                      disabled={!draft.alerts.enabled}
                      onChange={(event) => setAlerts({ onEnd: event.target.checked })}
                    />
                    <span>
                      <span className="check__label">Про відбій</span>
                      <span className="check__hint">
                        Сирена на відбій більше не звучить — з вересня 2026 вона є лише на
                        початок.
                      </span>
                    </span>
                  </label>

                  <label className="check">
                    <input
                      type="checkbox"
                      checked={draft.alerts.live}
                      disabled={!draft.alerts.enabled}
                      onChange={(event) => setAlerts({ live: event.target.checked })}
                    />
                    <span>
                      <span className="check__label">Тривога на екрані блокування</span>
                      <span className="check__hint">
                        І в динамічному острові — для iPhone це одна й та сама жива
                        активність, окремо їх не вимкнути.
                      </span>
                    </span>
                  </label>

                  <label className="check">
                    <input
                      type="checkbox"
                      checked={draft.alerts.backToClass}
                      disabled={!draft.alerts.enabled}
                      onChange={(event) => setAlerts({ backToClass: event.target.checked })}
                    />
                    <span>
                      <span className="check__label">Коли час повертатись на урок</span>
                      <span className="check__hint">
                        Відбій посеред уроку означає, що йти треба вже на наступний.
                        Застосунок порахує, на який саме, і нагадає перед ним.
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>
            )}

            <p className="field__hint">
              Дані беруться з офіційного alerts.in.ua через власний посередник. Поки
              застосунок відкритий, він питає раз на хвилину; коли закритий — тоді, коли
              iPhone дасть фоновий час. Це підстраховка, а не сирена: рішення приймайте
              за офіційним оповіщенням.
            </p>
          </>
        )}

        {!onboarding && shown === 'профіль' && (
          <>
            <Radios
              name="theme"
              legend="Тема"
              options={THEME_OPTIONS}
              value={theme}
              onChange={onTheme}
            />
            <p className="field__hint">Налаштування зберігаються лише на цьому пристрої.</p>
          </>
        )}

        </div>

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
