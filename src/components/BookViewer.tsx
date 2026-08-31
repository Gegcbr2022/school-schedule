import { useCallback, useEffect, useRef, useState } from 'react'
import { bookBytes } from '../lib/library'
import { CloseIcon, DownloadIcon } from './Icons'

type Props = {
  title: string
  /** Звичайна адреса книжки (не blob). */
  url: string
  onClose: () => void
}

/** Скільки намальованих сторінок тримаємо в пам'яті одночасно. */
const KEEP_RENDERED = 6
/** Наскільки заздалегідь малюємо сторінку, що наближається. */
const LOOKAHEAD = '150% 0px'

type Doc = {
  numPages: number
  getPage: (n: number) => Promise<PdfPage>
  destroy: () => Promise<void>
}
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number }
  render: (o: object) => { promise: Promise<void>; cancel: () => void }
}

/**
 * Читалка PDF.
 *
 * Малюємо сторінки самі, на canvas. Через <iframe> не можна: iOS Safari
 * показує в ньому лише першу сторінку без прокрутки — і так уже багато років.
 * Свій рендер поводиться однаково скрізь, працює з файлу в пам'яті (тобто
 * офлайн) і, головне, нікуди не веде зі сторінки: кнопка «закрити» — наша
 * власна, з неї не можна «випасти» у застосунку без адресного рядка.
 */
export function BookViewer({ title, url, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<Doc | null>(null)
  const renderedRef = useRef<number[]>([])

  const [pages, setPages] = useState(0)
  const [ratio, setRatio] = useState(1.414)
  const [current, setCurrent] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  /** Малює одну сторінку в її canvas; звільняє найдавніші. */
  const renderPage = useCallback(async (n: number) => {
    const doc = docRef.current
    const holder = scrollRef.current?.querySelector<HTMLElement>(`[data-page="${n}"]`)
    if (!doc || !holder || holder.querySelector('canvas')) return

    const page = await doc.getPage(n)
    const cssWidth = holder.clientWidth
    const base = page.getViewport({ scale: 1 })
    // Дрібний шкільний текст доводиться збільшувати пальцями, тож малюємо
    // з запасом — але не більше подвійного, щоб не з'їсти пам'ять телефона.
    const density = Math.min(window.devicePixelRatio || 1, 2)
    const viewport = page.getViewport({ scale: (cssWidth / base.width) * density })

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.style.width = '100%'
    const context = canvas.getContext('2d')
    if (!context) return

    holder.replaceChildren(canvas)
    await page.render({ canvasContext: context, viewport }).promise

    renderedRef.current = [...renderedRef.current.filter((p) => p !== n), n]
    while (renderedRef.current.length > KEEP_RENDERED) {
      const old = renderedRef.current.shift()
      const stale = scrollRef.current?.querySelector<HTMLElement>(`[data-page="${old}"]`)
      stale?.replaceChildren()
    }
  }, [])

  // Завантаження документа
  useEffect(() => {
    let alive = true
    let doc: Doc | null = null

    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default

        // Збережена книжка читається з пам'яті — інтернет не потрібен.
        const bytes = await bookBytes(url)
        const source = bytes ? { data: bytes } : { url }
        doc = (await pdfjs.getDocument(source).promise) as unknown as Doc
        if (!alive) {
          void doc.destroy()
          return
        }

        docRef.current = doc
        const first = await doc.getPage(1)
        const view = first.getViewport({ scale: 1 })
        setRatio(view.height / view.width)
        setPages(doc.numPages)
        setLoading(false)
      } catch {
        if (alive) {
          setError('Не вдалося відкрити файл. Перевірте зʼєднання або збережіть книжку.')
          setLoading(false)
        }
      }
    })()

    return () => {
      alive = false
      docRef.current = null
      renderedRef.current = []
      void doc?.destroy()
    }
  }, [url])

  // Малюємо тільки те, що близько до екрана.
  useEffect(() => {
    if (!pages || !scrollRef.current) return

    // Видимих сторінок буває кілька — номером вважаємо найвищу з них,
    // інакше лічильник показував би останню з видимих.
    const visible = new Set<number>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const n = Number((entry.target as HTMLElement).dataset.page)
          if (entry.isIntersecting) void renderPage(n)
          if (entry.isIntersecting && entry.intersectionRatio > 0.4) visible.add(n)
          else visible.delete(n)
        }
        if (visible.size > 0) setCurrent(Math.min(...visible))
      },
      { root: scrollRef.current, rootMargin: LOOKAHEAD, threshold: [0, 0.4] },
    )

    const holders = scrollRef.current.querySelectorAll('[data-page]')
    for (const holder of holders) observer.observe(holder)
    return () => observer.disconnect()
  }, [pages, renderPage])

  // Esc закриває — і на десктопі, і з клавіатури планшета.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  /**
   * Віддає файл системі: на телефоні це «Поділитися» → «Зберегти у Файли».
   * Навмисно не робимо звичайне посилання — у встановленому застосунку
   * немає адресного рядка, і з відкритого PDF не було б як повернутися.
   */
  const share = async () => {
    const bytes = await bookBytes(url)
    const blob = bytes
      ? new Blob([bytes], { type: 'application/pdf' })
      : await fetch(url).then((r) => r.blob())
    const file = new File([blob], `${title}.pdf`, { type: 'application/pdf' })

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title })
        return
      } catch {
        /* користувач передумав — це не помилка */
      }
    }

    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `${title}.pdf`
    link.click()
    URL.revokeObjectURL(href)
  }

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="viewer__bar">
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити книжку">
          <CloseIcon />
        </button>

        <div className="viewer__meta">
          <p className="viewer__title">{title}</p>
          {pages > 0 && (
            <p className="viewer__pages">
              {current} з {pages}
            </p>
          )}
        </div>

        <button
          type="button"
          className="iconbtn"
          onClick={() => void share()}
          aria-label="Зберегти файл на пристрій"
        >
          <DownloadIcon />
        </button>
      </div>

      <div className="viewer__scroll" ref={scrollRef}>
        {loading && <p className="viewer__loading">Відкриваємо…</p>}
        {error && <p className="viewer__loading">{error}</p>}

        {Array.from({ length: pages }, (_, i) => (
          <div
            className="viewer__page"
            key={i + 1}
            data-page={i + 1}
            style={{ aspectRatio: `1 / ${ratio}` }}
          />
        ))}
      </div>
    </div>
  )
}
