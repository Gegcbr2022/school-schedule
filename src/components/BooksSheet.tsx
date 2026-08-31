import { useEffect, useId, useRef } from 'react'
import type { BookGroup } from '../data/books'
import { booksForClass, gradeOf } from '../data/books'
import { subjectName } from '../data/schedule'
import { CloseIcon, DownloadIcon } from './Icons'

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
 * із застосунком — тоді додаємо базовий шлях, бо на GitHub Pages
 * сайт живе в підпапці.
 */
function hrefOf(url: string): string {
  return /^https?:\/\//.test(url) ? url : import.meta.env.BASE_URL + url.replace(/^\//, '')
}

export function BooksSheet({ classId, className, onClose }: Props) {
  const headingId = useId()
  const sheetRef = useRef<HTMLDivElement>(null)
  const groups = booksForClass(classId)
  const total = groups.reduce((n, g) => n + g.books.length, 0)
  const ready = groups.reduce((n, g) => n + g.books.filter((b) => b.url).length, 0)

  useEffect(() => {
    sheetRef.current?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
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
          <p className="empty">
            Для {gradeOf(classId)} класу підручників ще не додано.
          </p>
        ) : (
          <>
            <p className="sheet__intro">
              {className} · {ready} з {total} файлів уже завантажено в застосунок.
            </p>

            {groups.map((group) => (
              <section className="books" key={groupTitle(group)}>
                <h3 className="books__subject">{groupTitle(group)}</h3>
                <ul className="books__list">
                  {group.books.map((book) => (
                    <li className="book" key={book.title + (book.note ?? '')}>
                      <div className="book__text">
                        <p className="book__title">
                          {book.title}
                          {book.note && <span className="book__note">{book.note}</span>}
                        </p>
                        {book.authors && <p className="book__authors">{book.authors}</p>}
                      </div>

                      {book.url ? (
                        <a
                          className="btn book__get"
                          href={hrefOf(book.url)}
                          download
                          target="_blank"
                          rel="noopener"
                          aria-label={`Завантажити: ${book.title}`}
                        >
                          <DownloadIcon />
                          PDF
                        </a>
                      ) : (
                        <span className="book__soon">ще немає</span>
                      )}
                    </li>
                  ))}
                </ul>
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
  )
}
