import { useCallback, useEffect, useId, useState } from 'react'
import type { Book, BookGroup } from '../data/books'
import { booksForClass, gradeOf } from '../data/books'
import { subjectName } from '../data/schedule'
import { useModal } from '../lib/hooks'
import { removeBook, saveBook, savedUrls } from '../lib/library'
import { BookViewer } from './BookViewer'
import { ErrorBoundary } from './ErrorBoundary'
import { CheckIcon, CloseIcon, DownloadIcon } from './Icons'

type Props = {
  classId: string
  className: string
  onClose: () => void
}

function groupTitle(group: BookGroup): string {
  return group.subject ? subjectName(group.subject) : (group.title ?? 'Інше')
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

export function BooksSheet({ classId, className, onClose }: Props) {
  const headingId = useId()
  const sheetRef = useModal(onClose)
  const groups = booksForClass(classId)

  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [reading, setReading] = useState<{ title: string; url: string } | null>(null)

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

  const total = groups.reduce((n, g) => n + g.books.length, 0)
  const withFiles = groups.reduce((n, g) => n + g.books.filter((b) => b.url).length, 0)

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
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onClose()
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
              Підручники
            </h2>
            <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити">
              <CloseIcon />
            </button>
          </div>

          {total === 0 ? (
            <p className="empty">Для {gradeOf(classId)} класу підручників ще не додано.</p>
          ) : (
            <>
              <p className="sheet__intro">
                {className} · {withFiles} з {total} книжок доступні для читання.
                {saved.size > 0 && ` Збережено на пристрій: ${saved.size}.`}
                <br />
                «Інтелект України» викладає підручники частинами — файли з
                позначкою «оновлюється щотижня» доростають протягом року.
              </p>

              {groups.map((group) => (
                <section className="books" key={groupTitle(group)}>
                  <h3 className="books__subject">{groupTitle(group)}</h3>
                  <ul className="books__list">{group.books.map(renderBook)}</ul>
                </section>
              ))}
            </>
          )}

          <div className="sheet__actions">
            <button type="button" className="btn btn--wide" onClick={onClose}>
              Закрити
            </button>
          </div>
        </div>
      </div>

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
