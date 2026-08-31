import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { bookBytes } from '../lib/library'
import { CloseIcon, DownloadIcon } from './Icons'

type Props = {
  title: string
  /** Звичайна адреса книжки (не blob). */
  url: string
  onClose: () => void
}

/** Скільки намальованих сторінок тримаємо в пам'яті одночасно. */
const KEEP_RENDERED = 14
/** Наскільки заздалегідь малюємо сторінку, що наближається. */
const LOOKAHEAD = '150% 0px'

type Doc = {
  numPages: number
  getPage: (n: number) => Promise<PdfPage>
}
/** Закривати документ уміє саме задача завантаження, а не сам документ. */
type LoadingTask = { promise: Promise<Doc>; destroy: () => Promise<void> }
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
  const frameRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<Doc | null>(null)
  const renderedRef = useRef<number[]>([])
  /** Сторінки, які саме зараз малюються — щоб не запускати вдруге. */
  const renderingRef = useRef<Set<number>>(new Set())
  /** Сторінки, що зараз на екрані — їх не звільняємо, інакше побіліють. */
  const visibleRef = useRef<Set<number>>(new Set())

  const [pages, setPages] = useState(0)
  const [ratio, setRatio] = useState(1.414)
  const [current, setCurrent] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)

  /** Малює одну сторінку в її canvas; звільняє найдавніші невидимі. */
  const renderPage = useCallback(async (n: number) => {
    const doc = docRef.current
    const holder = scrollRef.current?.querySelector<HTMLElement>(`[data-page="${n}"]`)
    // Уже намальована або малюється просто зараз — не чіпаємо.
    if (!doc || !holder || holder.querySelector('canvas') || renderingRef.current.has(n)) return

    renderingRef.current.add(n)
    try {
      const page = await doc.getPage(n)
      const cssWidth = holder.clientWidth || holder.offsetWidth || 1
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

      await page.render({ canvasContext: context, viewport }).promise

      // Полотно додаємо ЛИШЕ після успішного малювання: якщо рендер
      // скасували (прогорнули далі), не лишиться порожнього білого аркуша,
      // який назавжди блокував би перемалювання.
      holder.replaceChildren(canvas)
      renderedRef.current = [...renderedRef.current.filter((p) => p !== n), n]

      // Звільняємо найдавніші, але ніколи — ті, що зараз на екрані.
      while (renderedRef.current.length > KEEP_RENDERED) {
        const idx = renderedRef.current.findIndex((p) => !visibleRef.current.has(p))
        if (idx === -1) break
        const [old] = renderedRef.current.splice(idx, 1)
        scrollRef.current?.querySelector<HTMLElement>(`[data-page="${old}"]`)?.replaceChildren()
      }
    } catch {
      // Скасування рендеру (прогорнули далі, закрили книжку) — не помилка.
    } finally {
      renderingRef.current.delete(n)
    }
  }, [])

  // Завантаження документа
  useEffect(() => {
    let alive = true
    let task: LoadingTask | null = null

    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default

        // Збережена книжка читається з пам'яті — інтернет не потрібен.
        const bytes = await bookBytes(url)
        const source = bytes ? { data: bytes } : { url }
        task = pdfjs.getDocument(source) as unknown as LoadingTask

        const doc = await task.promise
        if (!alive) return

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
      // Закриття може перервати малювання сторінки — це очікувано, не помилка.
      void task?.destroy().catch(() => {})
    }
  }, [url])

  // Малюємо тільки те, що близько до екрана.
  useEffect(() => {
    if (!pages || !scrollRef.current) return

    const visible = visibleRef.current
    // Для лічильника: помітно видимі сторінки (номером беремо найвищу).
    const prominent = new Set<number>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const n = Number((entry.target as HTMLElement).dataset.page)
          // Будь-який дотик до зони (з запасом) — сторінку тримаємо й малюємо.
          if (entry.isIntersecting) {
            visible.add(n)
            void renderPage(n)
          } else {
            visible.delete(n)
          }
          if (entry.isIntersecting && entry.intersectionRatio > 0.4) prominent.add(n)
          else prominent.delete(n)
        }
        if (prominent.size > 0) setCurrent(Math.min(...prominent))
      },
      { root: scrollRef.current, rootMargin: LOOKAHEAD, threshold: [0, 0.4] },
    )

    const holders = scrollRef.current.querySelectorAll('[data-page]')
    for (const holder of holders) observer.observe(holder)
    return () => {
      observer.disconnect()
      visible.clear()
    }
  }, [pages, renderPage])

  // Esc закриває, а сам переглядач при відкритті забирає фокус на себе —
  // інакше він завис би на кнопці «Читати» під низом.
  useEffect(() => {
    frameRef.current?.focus()
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
    setSaveError(null)
    try {
      const bytes = await bookBytes(url)
      let blob: Blob
      if (bytes) {
        blob = new Blob([bytes], { type: 'application/pdf' })
      } else {
        const resp = await fetch(url)
        if (!resp.ok) throw new Error('network')
        blob = await resp.blob()
      }
      const file = new File([blob], `${title}.pdf`, { type: 'application/pdf' })

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title })
          return
        } catch {
          /* користувач передумав — це не помилка, тихо переходимо до завантаження */
        }
      }

      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = `${title}.pdf`
      link.click()
      // Звільняємо не в тому ж такті: інакше Firefox/Safari скасовують завантаження.
      setTimeout(() => URL.revokeObjectURL(href), 4000)
    } catch {
      setSaveError('Не вдалося зберегти. Спробуйте онлайн або збережіть книжку заздалегідь.')
    }
  }

  // Рендеримо поза .app: там заборонено зум сайту, а тут він потрібен.
  return createPortal(
    <div
      className="viewer"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      ref={frameRef}
      tabIndex={-1}
    >
      <div className="viewer__bar">
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрити книжку">
          <CloseIcon />
        </button>

        <div className="viewer__meta">
          <p className="viewer__title">{title}</p>
          {pages > 0 && (
            <p className="viewer__pages" aria-live="polite">
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

      {saveError && (
        <p className="viewer__toast" role="alert">
          {saveError}
        </p>
      )}

      <div className="viewer__scroll" ref={scrollRef}>
        {loading && (
          <p className="viewer__loading" role="status">
            Відкриваємо…
          </p>
        )}
        {error && (
          <p className="viewer__loading" role="alert">
            {error}
          </p>
        )}

        {Array.from({ length: pages }, (_, i) => (
          <div
            className="viewer__page"
            key={i + 1}
            data-page={i + 1}
            style={{ aspectRatio: `1 / ${ratio}` }}
          />
        ))}
      </div>
    </div>,
    document.body,
  )
}
