/**
 * Підручники по класах.
 *
 * ЩОБ ДОДАТИ ФАЙЛ — впишіть `url` до потрібної книжки. Доки його немає,
 * книжка показується в списку, але без кнопки завантаження: так видно,
 * чого ще бракує, і ніхто не тисне на порожнє посилання.
 *
 * `url` — або повне посилання (https://…), або шлях до файлу в public/,
 * напр. `books/9/ukr-mova-1.pdf`. Куди краще класти файли, див. README.
 */

/**
 * Де лежать файли підручників.
 *
 * Це власний домен бакета R2 — щоб адреси книжок не залежали від
 * випадкового імені сховища і не мінялися, якщо сховище колись переїде.
 * Міняти тут в одному місці.
 */
const BOOKS_HOST = 'https://books.vell1414.site'

export type Book = {
  title: string
  /** Уточнення: «Частина 1», «Зошит з друкованою основою», «Атлас». */
  note?: string
  authors?: string
  /** Пряме посилання на PDF. Немає — кнопки завантаження теж немає. */
  url?: string
  /**
   * Скільки сторінок у файлі — показуємо, щоб було видно обсяг.
   */
  pages?: number
  /**
   * Чи це повний підручник на рік. `false` (за замовчуванням) — матеріали
   * поточних тижнів: «Інтелект України» викладає підручник частинами, і
   * нові тижні доливаються протягом року.
   */
  full?: boolean
}

export type BookGroup = {
  /**
   * Код предмета з `SUBJECTS` — щоб назва збігалася з розкладом.
   * Якщо предмета в розкладі немає, вкажіть `title`.
   */
  subject?: string
  title?: string
  books: Book[]
}

/** Ключ — паралель. 9а, 9б і 9в користуються одним списком. */
export const BOOKS: Record<string, BookGroup[]> = {
  '9': [
    {
      subject: 'ум',
      books: [
        {
          title: 'Українська мова',
          note: 'Тижні 1–4',
          authors: 'І. В. Гавриш, Н. В. Семихат, С. М. Дрофʼяк, Н. М. Новожилова',
          url: `${BOOKS_HOST}/9/um-1.pdf`,
          pages: 20,
        },
        {
          title: 'Українська мова · тренувальні вправи',
          note: 'Тижні 1–2 · довідкова інформація',
          authors: 'І. В. Гавриш, Н. В. Семихат, С. М. Дрофʼяк, Н. М. Новожилова',
          url: `${BOOKS_HOST}/9/um-reference.pdf`,
          pages: 16,
        },
        {
          title: 'Українська мова · карти знань та інтелект-карти',
          authors: 'І. В. Гавриш, Н. В. Семихат, С. М. Дрофʼяк, Н. М. Новожилова',
          url: `${BOOKS_HOST}/9/um-cards.pdf`,
          pages: 26,
          full: true,
        },
      ],
    },
    {
      subject: 'ул',
      books: [
        {
          title: 'Українська література',
          note: 'Тижні 1–2 · уроки 1–4',
          authors: 'І. В. Гавриш, О. В. Гученко',
          url: `${BOOKS_HOST}/9/ul-1.pdf`,
          pages: 37,
        },
        {
          title: 'Українська література · хрестоматія',
          note: 'Частина 1',
          url: `${BOOKS_HOST}/9/ul-anthology.pdf`,
          pages: 89,
          full: true,
        },
      ],
    },
    {
      subject: 'зл',
      books: [
        {
          title: 'Зарубіжна література і мистецтво',
          note: 'Тиждень 1',
          authors: 'І. В. Гавриш, О. В. Гученко',
          url: `${BOOKS_HOST}/9/zl-1.pdf`,
          pages: 17,
        },
        {
          title: 'Зарубіжна література · карти знань та алгоритми',
          url: `${BOOKS_HOST}/9/zl-cards.pdf`,
          pages: 7,
          full: true,
        },
      ],
    },
    {
      subject: 'М',
      books: [
        {
          title: 'Алгебра',
          note: 'Тиждень 1',
          authors: 'І. В. Гавриш, С. О. Доценко, О. А. Горьков, С. Б. Скиба',
          url: `${BOOKS_HOST}/9/algebra-1.pdf`,
          pages: 25,
        },
        {
          title: 'Геометрія',
          note: 'Тиждень 1',
          authors: 'І. В. Гавриш, С. О. Доценко, О. А. Горьков, С. Б. Скиба',
          url: `${BOOKS_HOST}/9/geometry-1.pdf`,
          pages: 27,
        },
        {
          title: 'Математика · карти знань',
          authors: 'І. В. Гавриш, С. О. Доценко, О. А. Горьков, С. Б. Скиба',
          url: `${BOOKS_HOST}/9/math-cards.pdf`,
          pages: 73,
          full: true,
        },
      ],
    },
    {
      subject: 'іст',
      books: [
        {
          title: 'Історія: Україна і світ · навчальні матеріали',
          note: 'Тижні 1–2',
          authors:
            'І. В. Гавриш, М. М. Мудрий, О. Г. Аркуша, М. С. Бааярь, О. С. Лихолай, Л. М. Хлипавка',
          url: `${BOOKS_HOST}/9/hist-materials.pdf`,
          pages: 24,
        },
        {
          title: 'Історія: Україна і світ · робочий зошит',
          note: 'Тижні 1–2',
          authors:
            'І. В. Гавриш, М. М. Мудрий, О. Г. Аркуша, М. С. Бааярь, О. С. Лихолай, Л. М. Хлипавка',
          url: `${BOOKS_HOST}/9/hist-workbook.pdf`,
          pages: 24,
        },
      ],
    },
    {
      subject: 'г',
      books: [
        {
          title: 'Географія',
          note: 'Тижні 1–2 · із домашніми завданнями',
          authors: 'І. В. Гавриш, В. І. Садкіна, Н. В. Свір',
          url: `${BOOKS_HOST}/9/geo-1.pdf`,
          pages: 24,
        },
        {
          title: 'Географія · інтелект-карти й карти знань',
          authors: 'І. В. Гавриш, В. І. Садкіна, Н. В. Свір',
          url: `${BOOKS_HOST}/9/geo-cards.pdf`,
          pages: 4,
          full: true,
        },
      ],
    },
    {
      subject: 'б',
      books: [
        {
          title: 'Біологія',
          note: 'Тиждень 1',
          authors: 'І. В. Гавриш, К. М. Задорожний, Г. О. Калиновська',
          url: `${BOOKS_HOST}/9/bio-1.pdf`,
          pages: 22,
        },
      ],
    },
    {
      subject: 'ф',
      books: [
        {
          title: 'Фізика',
          note: 'Тиждень 1',
          authors: 'М. В. Бондаренко, О. М. Євлахова',
          url: `${BOOKS_HOST}/9/physics-1.pdf`,
          pages: 29,
        },
      ],
    },
    {
      subject: 'х',
      books: [
        {
          title: 'Хімія',
          note: 'Тиждень 1',
          authors: 'І. В. Гавриш, Т. М. Гранкіна, С. Ю. Макєєв, Ю. В. Сизих',
          url: `${BOOKS_HOST}/9/chem-1.pdf`,
          pages: 27,
        },
      ],
    },
    {
      subject: 'ам',
      books: [
        {
          title: 'Focus 3 Second Edition · Student’s Book',
          note: 'BBC',
          authors:
            'Sue Kay, Vaughan Jones, Daniel Brayshaw, Izabela Michalak, Bartoz Michalowski, Beata Trapbell',
          url: `${BOOKS_HOST}/9/focus3-students-book.pdf`,
          pages: 159,
          full: true,
        },
        {
          title: 'Focus 3 Second Edition · Workbook',
          note: 'BBC',
          authors: 'Daniel Brayshaw, Dean Russel, Anna Osborn, Amanda Davies',
          url: `${BOOKS_HOST}/9/focus3-workbook.pdf`,
          pages: 180,
          full: true,
        },
        {
          title: 'Focus 3 Second Edition · Teacher’s Book',
          note: 'BBC · видання для вчителя',
          url: `${BOOKS_HOST}/9/focus3-teachers-book.pdf`,
          pages: 325,
          full: true,
        },
      ],
    },
    {
      subject: 'нр',
      books: [
        {
          title: 'Навчаємося разом',
          note: 'Частина 1 · тиждень 1',
          authors:
            'І. В. Гавриш, О. О. Щербакова, О. У. Холтобіна, О. Ф. Щербаков, Є. В. Луценко',
          url: `${BOOKS_HOST}/9/nr-1.pdf`,
          pages: 2,
        },
        {
          title: 'Навчаємося разом · вкладка',
          note: 'Частина 1',
          authors:
            'І. В. Гавриш, О. О. Щербакова, О. У. Холтобіна, О. Ф. Щербаков, Є. В. Луценко',
          url: `${BOOKS_HOST}/9/nr-1-insert.pdf`,
          pages: 4,
        },
      ],
    },
  ],
}

/** Паралель класу: «9б» → «9». */
export function gradeOf(classId: string): string {
  return String(parseInt(classId, 10))
}

export function booksForClass(classId: string): BookGroup[] {
  return BOOKS[gradeOf(classId)] ?? []
}
