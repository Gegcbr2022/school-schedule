import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { bookBytes } from '../lib/library'
import { CloseIcon } from './Icons'

type Props = {
  title: string
  /** Адреса в полиці (`shelf.invalid/…`) або звичайна. */
  url: string
  mime: string
  onClose: () => void
}

/**
 * Показ картинки на весь екран.
 *
 * Сфотографована сторінка зошита — це не PDF, і тягти заради неї читалку
 * з рендером сторінок безглуздо. Тут вистачає `img`: масштабує палець,
 * а більше з картинкою нічого й не роблять.
 */
export function ImageViewer({ title, url, mime, onClose }: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    let made: string | null = null

    void (async () => {
      const bytes = await bookBytes(url)
      if (!alive) return
      if (!bytes) {
        setFailed(true)
        return
      }
      made = URL.createObjectURL(new Blob([bytes], { type: mime || 'image/jpeg' }))
      setSrc(made)
    })()

    return () => {
      alive = false
      // Звільняємо не одразу: Safari інколи ще малює кадр із цієї адреси.
      const done = made
      if (done) setTimeout(() => URL.revokeObjectURL(done), 1000)
    }
  }, [url, mime])

  useEffect(() => {
    frameRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="viewer__bar">
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити">
          <CloseIcon />
        </button>
        <div className="viewer__meta">
          <p className="viewer__title">{title}</p>
        </div>
      </div>
      <div className="viewer__scroll" ref={frameRef} tabIndex={-1}>
        {failed ? (
          <p className="viewer__loading">Файл не знайшовся на пристрої.</p>
        ) : src ? (
          <img className="viewer__image" src={src} alt={title} />
        ) : (
          <p className="viewer__loading">Відкриваємо…</p>
        )}
      </div>
    </div>,
    document.body,
  )
}
