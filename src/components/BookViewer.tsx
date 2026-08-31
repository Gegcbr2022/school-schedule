import { useEffect, useState } from 'react'
import { bookSource, releaseBook } from '../lib/library'
import { CloseIcon, DownloadIcon } from './Icons'

type Props = {
  title: string
  /** Адреса книжки — звичайна, не blob. */
  url: string
  onClose: () => void
}

/**
 * Читалка на весь екран. Показує PDF вбудованим переглядачем браузера:
 * своєї бібліотеки для цього не тягнемо, бо вбудований і швидший, і вміє
 * пошук та масштаб.
 */
export function BookViewer({ title, url, onClose }: Props) {
  const [source, setSource] = useState<string | null>(null)

  useEffect(() => {
    let current: string | null = null
    let alive = true

    void bookSource(url).then((src) => {
      if (!alive) {
        releaseBook(src)
        return
      }
      current = src
      setSource(src)
    })

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    return () => {
      alive = false
      if (current) releaseBook(current)
      document.removeEventListener('keydown', onKey)
    }
  }, [url, onClose])

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="viewer__bar">
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити">
          <CloseIcon />
        </button>
        <p className="viewer__title">{title}</p>
        <a
          className="iconbtn"
          href={url}
          download
          target="_blank"
          rel="noopener"
          aria-label="Зберегти файл на пристрій"
        >
          <DownloadIcon />
        </a>
      </div>

      {source ? (
        <iframe className="viewer__frame" src={source} title={title} />
      ) : (
        <p className="viewer__loading">Відкриваємо…</p>
      )}
    </div>
  )
}
