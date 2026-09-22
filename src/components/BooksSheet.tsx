import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Book, BookGroup } from '../data/books'
import { booksForClass, booksForGrade, gradeOf } from '../data/books'
import { subjectName } from '../data/schedule'
import { plural } from '../lib/clock'
import { useBackdropClose, useModal } from '../lib/hooks'
import { removeBook, saveBook, savedUrls } from '../lib/library'
import type { Material } from '../lib/shelf'
import {
  MAX_FILE_MB,
  addFile,
  addLink,
  formatSize,
  isImage,
  materialUrl,
  materials,
  removeMaterial,
  shelfBytes,
} from '../lib/shelf'
import { teacherGrades } from '../lib/teacherSchedule'
import type { Teacher } from '../lib/teachers'
import { politeName } from '../lib/teachers'
import { BookViewer } from './BookViewer'
import { ErrorBoundary } from './ErrorBoundary'
import { ImageViewer } from './ImageViewer'
import { CheckIcon, ClipIcon, CloseIcon, DownloadIcon, LinkIcon, PlusIcon, TrashIcon } from './Icons'

type Props = {
  classId: string
  className: string
  /**
   * Учитель — тоді показуємо не підручники класу, а його предмет у
   * кожній паралелі, де він викладає.
   */
  teacher?: Teacher
  onClose: () => void
}

/** Полиця підручників: у класі вона одна, у вчителя — по одній на паралель. */
type Shelf = {
  key: string
  /** Заголовок полиці; у класу його немає — полиця одна. */
  title?: string
  groups: BookGroup[]
}

/**
 * Заголовок групи. `title` головніший за назву предмета: алгебра й
 * геометрія стоять у розкладі одним кодом «М», а книжки різні.
 */
function groupTitle(group: BookGroup): string {
  return group.title ?? (group.subject ? subjectName(group.subject) : 'Інше')
}

/** Паралелі вчителя, у яких для його предметів справді є книжки. */
function teacherShelves(teacher: Teacher): Shelf[] {
  return teacherGrades(teacher)
    .map(({ grade, subjects }) => ({
      key: grade,
      title: `${grade} класи`,
      groups: booksForGrade(grade, subjects),
    }))
    .filter((shelf) => shelf.groups.length > 0)
}

/**
 * Посилання може бути як зовнішнє (R2, диск), так і на файл поруч
 * із застосунком — тоді воно рахується від базового шляху, бо на
 * GitHub Pages сайт живе в підпапці.
 *
 * Повертаємо саме абсолютну адресу: під нею книжка лежить у Cache Storage,
 * і за нею ж ми потім упізнаємо, що вона вже збережена.
 */
function hrefOf(url: string): string {
  const base = new URL(import.meta.env.BASE_URL, window.location.href)
  return new URL(url, base).href
}

export function BooksSheet({ classId, className, teacher, onClose }: Props) {
  const headingId = useId()
  const sheetRef = useModal(onClose)
  const backdrop = useBackdropClose(onClose)

  const shelves = useMemo<Shelf[]>(
    () =>
      teacher
        ? teacherShelves(teacher)
        : [{ key: classId, groups: booksForClass(classId) }],
    [teacher, classId],
  )

  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [reading, setReading] = useState<{ title: string; url: string } | null>(null)
  const [looking, setLooking] = useState<Material | null>(null)

  /* ── Своя полиця ───────────────────────────────────────────────────── */
  const fileRef = useRef<HTMLInputElement>(null)
  const [mine, setMine] = useState<Material[]>(materials)
  const [adding, setAdding] = useState(false)
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [shelfError, setShelfError] = useState<string | null>(null)

  const takeFiles = async (list: FileList | null) => {
    setShelfError(null)
    for (const file of Array.from(list ?? [])) {
      const result = await addFile(file)
      if (!result.ok) {
        setShelfError(result.why)
        break
      }
    }
    setMine(materials())
  }

  const takeLink = () => {
    const result = addLink(linkTitle, linkUrl)
    if (!result.ok) {
      setShelfError(result.why)
      return
    }
    setShelfError(null)
    setLinkTitle('')
    setLinkUrl('')
    setAdding(false)
    setMine(materials())
  }

  const openMine = (item: Material) => {
    if (item.link) {
      window.open(item.link, '_blank', 'noopener')
      return
    }
    if (isImage(item)) {
      setLooking(item)
      return
    }
    setReading({ title: item.title, url: materialUrl(item.id) })
  }

  const refresh = useCallback(() => {
    void savedUrls().then(setSaved)
  }, [])

  useEffect(refresh, [refresh])

  const toggleSave = async (href: string) => {
    setFailed(null)
    if (saved.has(href)) {
      await removeBook(href)
      refresh()
      return
    }
    setBusy(href)
    const ok = await saveBook(href)
    setBusy(null)
    if (ok) refresh()
    else setFailed(href)
  }

  const all = shelves.flatMap((shelf) => shelf.groups).flatMap((group) => group.books)
  const total = all.length
  const withFiles = all.filter((book) => book.url).length

  const renderBook = (book: Book) => {
    const href = book.url ? hrefOf(book.url) : null
    const isSaved = href !== null && saved.has(href)

    return (
      <li className="book" key={book.title + (book.note ?? '')}>
        <div className="book__text">
          <p className="book__title">
            {book.title}
            {book.note && <span className="book__note">{book.note}</span>}
          </p>
          <p className="book__facts">
            {book.pages && (
              <span>
                {book.pages} {book.pages === 1 ? 'сторінка' : book.pages < 5 ? 'сторінки' : 'сторінок'}
              </span>
            )}
            {book.url &&
              (book.full ? (
                <span className="book__tag book__tag--full">повний</span>
              ) : (
                <span className="book__tag">оновлюється щотижня</span>
              ))}
          </p>
          {book.authors && <p className="book__authors">{book.authors}</p>}
          {failed === href && (
            <p className="book__error" role="alert">
              Не вдалося зберегти. Файл має віддаватись із дозволом на завантаження
              (CORS) — або покладіть його поруч із застосунком.
            </p>
          )}
        </div>

        {href ? (
          <div className="book__actions">
            <button
              type="button"
              className="btn book__read"
              onClick={() => setReading({ title: book.title, url: href })}
            >
              Читати
            </button>
            <button
              type="button"
              className={isSaved ? 'iconbtn iconbtn--on' : 'iconbtn'}
              onClick={() => void toggleSave(href)}
              disabled={busy === href}
              aria-label={
                isSaved
                  ? `Прибрати з пристрою: ${book.title}`
                  : `Зберегти на пристрій: ${book.title}`
              }
            >
              {busy === href ? (
                <span className="book__spinner" aria-hidden="true" />
              ) : isSaved ? (
                <CheckIcon />
              ) : (
                <DownloadIcon />
              )}
            </button>
          </div>
        ) : (
          <span className="book__soon">ще немає</span>
        )}
      </li>
    )
  }

  return (
    <>
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
              Підручники
            </h2>
            <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити">
              <CloseIcon />
            </button>
          </div>

          {total === 0 ? (
            <p className="empty">
              {teacher
                ? 'Для ваших предметів підручників ще не додано.'
                : `Для ${gradeOf(classId)} класу підручників ще не додано.`}
            </p>
          ) : (
            <>
              <p className="sheet__intro">
                {teacher
                  ? `${politeName(teacher)} · ${shelves.length} ${plural(shelves.length, ['паралель', 'паралелі', 'паралелей'])}`
                  : className}{' '}
                · {withFiles} з {total} книжок доступні для читання.
                {saved.size > 0 && ` Збережено на пристрій: ${saved.size}.`}
                <br />
                «Інтелект України» викладає підручники частинами — файли з
                позначкою «оновлюється щотижня» доростають протягом року.
              </p>

              {shelves.map((shelf) => {
                // Поличка з назвою паралелі старша за предмет — тоді предмет
                // на рівень нижче. У класу полиця одна, заголовка в неї немає.
                const Subject = shelf.title ? 'h4' : 'h3'
                return (
                  <Fragment key={shelf.key}>
                    {shelf.title && <h3 className="books__grade">{shelf.title}</h3>}
                    {shelf.groups.map((group) => (
                      <section className="books" key={groupTitle(group)}>
                        <Subject className="books__subject">{groupTitle(group)}</Subject>
                        <ul className="books__list">{group.books.map(renderBook)}</ul>
                      </section>
                    ))}
                  </Fragment>
                )
              })}
            </>
          )}

          {/*
            Своя полиця. Підручники класу застосунок знає, а конспект,
            зошит чи сфотографовану сторінку — ні; вони живуть у чаті, в
            «Файлах» і в галереї, тобто в трьох різних місцях. Тут вони
            лежать поряд із підручниками, відкриваються тією самою
            читалкою й нікуди з телефона не йдуть.
          */}
          <section className="books shelf">
            <h3 className="books__subject">
              <ClipIcon />
              Мої матеріали
            </h3>

            {mine.length === 0 ? (
              <p className="shelf__empty">
                Конспект, робочий зошит, методичка, фото сторінки — усе, чого немає
                в переліку класу. Зберігається на цьому пристрої й відкривається без
                інтернету.
              </p>
            ) : (
              <ul className="books__list">
                {mine.map((item) => (
                  <li className="book" key={item.id}>
                    <button type="button" className="book__text book__text--tap" onClick={() => openMine(item)}>
                      <p className="book__title">
                        {item.title}
                        {item.note && <span className="book__note">{item.note}</span>}
                      </p>
                      <p className="book__facts">
                        {item.link ? (
                          <span className="book__tag">
                            <LinkIcon />
                            посилання
                          </span>
                        ) : (
                          <span>
                            {isImage(item) ? 'знімок' : 'PDF'} · {formatSize(item.size)}
                          </span>
                        )}
                      </p>
                    </button>
                    <button
                      type="button"
                      className="iconbtn iconbtn--small"
                      aria-label={`Прибрати ${item.title}`}
                      onClick={() => {
                        if (!window.confirm(`Прибрати «${item.title}»?`)) return
                        void removeMaterial(item.id).then(() => setMine(materials()))
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {shelfError && (
              <p className="book__error" role="alert">
                {shelfError}
              </p>
            )}

            {adding ? (
              <div className="shelf__link">
                <input
                  className="textinput"
                  type="text"
                  value={linkTitle}
                  maxLength={80}
                  placeholder="Як підписати"
                  aria-label="Назва посилання"
                  onChange={(event) => setLinkTitle(event.target.value)}
                />
                <input
                  className="textinput"
                  type="url"
                  inputMode="url"
                  value={linkUrl}
                  maxLength={500}
                  placeholder="https://…"
                  aria-label="Адреса"
                  // Без цього iOS робить велику літеру на початку адреси
                  // й підкреслює її як помилку.
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(event) => setLinkUrl(event.target.value)}
                />
                <div className="shelf__add">
                  <button type="button" className="btn" onClick={takeLink}>
                    Додати
                  </button>
                  <button type="button" className="linkbtn" onClick={() => setAdding(false)}>
                    Скасувати
                  </button>
                </div>
              </div>
            ) : (
              <div className="shelf__add">
                <input
                  ref={fileRef}
                  className="visually-hidden"
                  type="file"
                  multiple
                  accept="application/pdf,image/*"
                  aria-label="Файл із пристрою"
                  onChange={(event) => {
                    void takeFiles(event.target.files)
                    // Той самий файл мають дати додати ще раз — інакше
                    // повторний вибір мовчки нічого не робить.
                    event.target.value = ''
                  }}
                />
                <button type="button" className="btn btn--quiet" onClick={() => fileRef.current?.click()}>
                  <PlusIcon />
                  Файл
                </button>
                <button type="button" className="btn btn--quiet" onClick={() => setAdding(true)}>
                  <LinkIcon />
                  Посилання
                </button>
              </div>
            )}

            <p className="shelf__note">
              До {MAX_FILE_MB} МБ на файл
              {mine.some((item) => item.size > 0) && ` · зайнято ${formatSize(shelfBytes())}`}. Нічого нікуди
              не надсилається: файли лишаються на цьому пристрої.
            </p>
          </section>

          <div className="sheet__actions">
            <button type="button" className="btn btn--wide" onClick={onClose}>
              Закрити
            </button>
          </div>
        </div>
      </div>

      {looking && (
        <ImageViewer
          title={looking.title}
          url={materialUrl(looking.id)}
          mime={looking.mime}
          onClose={() => setLooking(null)}
        />
      )}

      {reading && (
        // Збій у читалці не має валити весь розклад — просто закриваємо книжку.
        <ErrorBoundary
          fallback={() => {
            setReading(null)
            return null
          }}
        >
          <BookViewer
            title={reading.title}
            url={reading.url}
            onClose={() => setReading(null)}
          />
        </ErrorBoundary>
      )}
    </>
  )
}
