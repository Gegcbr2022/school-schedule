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
   * Код предмета з `SUBJECTS` — щоб група знайшлась за розкладом
   * (напр. у підручниках учителя). Якщо предмета в розкладі немає,
   * досить самого `title`.
   */
  subject?: string
  /**
   * Заголовок групи, коли він точніший за назву предмета: алгебра й
   * геометрія в розкладі стоять одним кодом «М», а підручники різні.
   */
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
  '5': [
    {
      subject: 'ум',
      books: [
        {
          title: 'Українська мова',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/5/um-1.pdf`,
          pages: 43,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · алгоритми перевірки ДЗ',
          url: `${BOOKS_HOST}/5/um-2.pdf`,
          pages: 1,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · додаткова інформація',
          url: `${BOOKS_HOST}/5/um-3.pdf`,
          pages: 3,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · ЗНО',
          url: `${BOOKS_HOST}/5/um-4.pdf`,
          pages: 3,
        },
        {
          title: 'Українська мова',
          note: 'На рік · карти знань інтелект-карти',
          url: `${BOOKS_HOST}/5/um-5.pdf`,
          pages: 19,
          full: true,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · комунікативно-творча сторінка',
          url: `${BOOKS_HOST}/5/um-6.pdf`,
          pages: 4,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · лінгвістичні ігри (коди)',
          url: `${BOOKS_HOST}/5/um-7.pdf`,
          pages: 1,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · складаємо інтелект-карти',
          url: `${BOOKS_HOST}/5/um-8.pdf`,
          pages: 3,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · складаємо інфографіку',
          url: `${BOOKS_HOST}/5/um-9.pdf`,
          pages: 2,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · сторінка знавців',
          url: `${BOOKS_HOST}/5/um-10.pdf`,
          pages: 1,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · тренувальні вправи',
          url: `${BOOKS_HOST}/5/um-11.pdf`,
          pages: 4,
        },
      ],
    },
    {
      subject: 'ул',
      books: [
        {
          title: 'Українська література',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/5/ul-1.pdf`,
          pages: 8,
        },
        {
          title: 'Українська література',
          note: 'На місяць · алгоритми',
          url: `${BOOKS_HOST}/5/ul-2.pdf`,
          pages: 2,
        },
        {
          title: 'Українська література',
          note: 'На місяць · карти',
          url: `${BOOKS_HOST}/5/ul-3.pdf`,
          pages: 4,
        },
        {
          title: 'Українська література',
          note: 'На рік · хрестоматія',
          url: `${BOOKS_HOST}/5/ul-4.pdf`,
          pages: 112,
          full: true,
        },
      ],
    },
    {
      subject: 'зл',
      books: [
        {
          title: 'Зарубіжна література',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/5/zl-1.pdf`,
          pages: 11,
        },
        {
          title: 'Зарубіжна література',
          note: 'На місяць · Карта знань',
          url: `${BOOKS_HOST}/5/zl-2.pdf`,
          pages: 6,
        },
        {
          title: 'Зарубіжна література',
          note: 'На рік · хрестоматія',
          url: `${BOOKS_HOST}/5/zl-3.pdf`,
          pages: 34,
          full: true,
        },
      ],
    },
    {
      subject: 'іст',
      books: [
        {
          title: 'Історія',
          note: 'Тиждень 1 · 35 год · Робочий зошит',
          url: `${BOOKS_HOST}/5/hist35-1.pdf`,
          pages: 5,
        },
        {
          title: 'Історія',
          note: 'Тиждень 1 · 52 год · Робочий зошит',
          url: `${BOOKS_HOST}/5/hist52-1.pdf`,
          pages: 15,
        },
      ],
    },
    {
      subject: 'М',
      books: [
        {
          title: 'Математика',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/5/math-1.pdf`,
          pages: 30,
        },
        {
          title: 'Математика',
          note: 'На рік · карти знань',
          url: `${BOOKS_HOST}/5/math-2.pdf`,
          pages: 65,
          full: true,
        },
      ],
    },
    {
      subject: 'мпЗ',
      books: [
        {
          title: 'Моя планета Земля',
          note: 'Тиждень 1 · ДЗ',
          url: `${BOOKS_HOST}/5/mpz-1.pdf`,
          pages: 24,
        },
      ],
    },
    {
      subject: 'тфв',
      books: [
        {
          title: 'Твої фізичні відкриття',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/5/tfv-1.pdf`,
          pages: 15,
        },
        {
          title: 'Твої фізичні відкриття',
          note: 'Тиждень 1 · ДЗ1',
          url: `${BOOKS_HOST}/5/tfv-2.pdf`,
          pages: 5,
        },
      ],
    },
    {
      subject: 'нр',
      books: [
        {
          title: 'Навчаємось разом',
          note: 'На рік',
          url: `${BOOKS_HOST}/5/nr-1.pdf`,
          pages: 5,
          full: true,
        },
        {
          title: 'Навчаємось разом',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/5/nr-2.pdf`,
          pages: 4,
        },
      ],
    },
    {
      subject: 'еврика',
      books: [
        {
          title: 'Еврика',
          note: 'На місяць',
          url: `${BOOKS_HOST}/5/evrika-1.pdf`,
          pages: 34,
        },
      ],
    },
  ],
  '6': [
    {
      subject: 'ум',
      books: [
        {
          title: 'Українська мова',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/6/um-1.pdf`,
          pages: 45,
        },
        {
          title: 'Українська мова',
          note: 'Тиждень 3',
          url: `${BOOKS_HOST}/6/um-2.pdf`,
          pages: 25,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · алгоритми перевірки ДЗ тощо',
          url: `${BOOKS_HOST}/6/um-3.pdf`,
          pages: 1,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · ЗНО',
          url: `${BOOKS_HOST}/6/um-4.pdf`,
          pages: 5,
        },
        {
          title: 'Українська мова',
          note: 'На рік · карти знань та інтелект-карти',
          url: `${BOOKS_HOST}/6/um-5.pdf`,
          pages: 19,
          full: true,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · комунікативно-творча сторінкаор',
          url: `${BOOKS_HOST}/6/um-6.pdf`,
          pages: 9,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · лінгвістичні ігри (коди)',
          url: `${BOOKS_HOST}/6/um-7.pdf`,
          pages: 1,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · тренувальні вправи',
          url: `${BOOKS_HOST}/6/um-8.pdf`,
          pages: 1,
        },
      ],
    },
    {
      subject: 'ул',
      books: [
        {
          title: 'Українська література',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/6/ul-1.pdf`,
          pages: 14,
        },
        {
          title: 'Українська література',
          note: 'Тиждень 3',
          url: `${BOOKS_HOST}/6/ul-2.pdf`,
          pages: 7,
        },
        {
          title: 'Українська література',
          note: 'На місяць · алгоритми',
          url: `${BOOKS_HOST}/6/ul-3.pdf`,
          pages: 2,
        },
        {
          title: 'Українська література',
          note: 'На місяць · карти',
          url: `${BOOKS_HOST}/6/ul-4.pdf`,
          pages: 6,
        },
      ],
    },
    {
      subject: 'зл',
      books: [
        {
          title: 'Зарубіжна література',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/6/zl-1.pdf`,
          pages: 15,
        },
        {
          title: 'Зарубіжна література',
          note: 'Тиждень 3',
          url: `${BOOKS_HOST}/6/zl-2.pdf`,
          pages: 36,
        },
        {
          title: 'Зарубіжна література',
          note: 'На місяць · Карта знань',
          url: `${BOOKS_HOST}/6/zl-3.pdf`,
          pages: 7,
        },
        {
          title: 'Зарубіжна література',
          note: 'На рік · хрестоматія',
          url: `${BOOKS_HOST}/6/zl-4.pdf`,
          pages: 89,
          full: true,
        },
      ],
    },
    {
      subject: 'іст',
      books: [
        {
          title: 'Історія',
          note: 'Тиждень 1 · 70 год · Навчальні матеріали',
          url: `${BOOKS_HOST}/6/hist70-1.pdf`,
          pages: 9,
        },
        {
          title: 'Історія',
          note: 'Тиждень 1 · 70 год · Робочий зошит',
          url: `${BOOKS_HOST}/6/hist70-2.pdf`,
          pages: 11,
        },
        {
          title: 'Історія',
          note: 'Тиждень 3 · 70 год · Робочий зошит',
          url: `${BOOKS_HOST}/6/hist70-3.pdf`,
          pages: 10,
        },
        {
          title: 'Історія',
          note: 'Тиждень 1–2 · 87 год · Навчальні матеріали',
          url: `${BOOKS_HOST}/6/hist87-1.pdf`,
          pages: 14,
        },
        {
          title: 'Історія',
          note: 'Тиждень 1–2 · 87 год · Робочий зошит',
          url: `${BOOKS_HOST}/6/hist87-2.pdf`,
          pages: 22,
        },
        {
          title: 'Історія',
          note: 'Тиждень 3–4 · 87 год · Робочий зошит',
          url: `${BOOKS_HOST}/6/hist87-3.pdf`,
          pages: 22,
        },
      ],
    },
    {
      subject: 'М',
      books: [
        {
          title: 'Математика',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/6/math-1.pdf`,
          pages: 28,
        },
        {
          title: 'Математика',
          note: 'Тиждень 3',
          url: `${BOOKS_HOST}/6/math-2.pdf`,
          pages: 15,
        },
        {
          title: 'Математика',
          note: 'Тиждень 3',
          url: `${BOOKS_HOST}/6/math-3.pdf`,
          pages: 10,
        },
        {
          title: 'Математика',
          note: 'На рік · карти знань',
          url: `${BOOKS_HOST}/6/math-4.pdf`,
          pages: 65,
          full: true,
        },
      ],
    },
    {
      subject: 'г',
      books: [
        {
          title: 'Географія',
          note: 'Тиждень 1 · ДЗ',
          url: `${BOOKS_HOST}/6/geo-1.pdf`,
          pages: 25,
        },
        {
          title: 'Географія',
          note: 'Тиждень 3 · ДЗ',
          url: `${BOOKS_HOST}/6/geo-2.pdf`,
          pages: 31,
        },
      ],
    },
    {
      subject: 'мпЗ',
      books: [
        {
          title: 'Моя планета Земля',
          note: 'Тиждень 1 · пр4 Тижд',
          url: `${BOOKS_HOST}/6/mpz-1.pdf`,
          pages: 18,
        },
        {
          title: 'Моя планета Земля',
          note: 'Тиждень 3 · пр4 Тижд',
          url: `${BOOKS_HOST}/6/mpz-2.pdf`,
          pages: 17,
        },
      ],
    },
    {
      subject: 'тфв',
      books: [
        {
          title: 'Твої фізичні відкриття',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/6/tfv-1.pdf`,
          pages: 13,
        },
        {
          title: 'Твої фізичні відкриття',
          note: 'Тиждень 3',
          url: `${BOOKS_HOST}/6/tfv-2.pdf`,
          pages: 14,
        },
        {
          title: 'Твої фізичні відкриття',
          note: 'Тиждень 1 · ДЗ',
          url: `${BOOKS_HOST}/6/tfv-3.pdf`,
          pages: 4,
        },
        {
          title: 'Твої фізичні відкриття',
          note: 'Тиждень 3 · ДЗ',
          url: `${BOOKS_HOST}/6/tfv-4.pdf`,
          pages: 3,
        },
      ],
    },
    {
      subject: 'нр',
      books: [
        {
          title: 'Навчаємось разом',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/6/nr-1.pdf`,
          pages: 4,
        },
        {
          title: 'Навчаємось разом',
          note: 'Тиждень 3',
          url: `${BOOKS_HOST}/6/nr-2.pdf`,
          pages: 2,
        },
        {
          title: 'Навчаємось разом',
          note: 'На місяць · Вкладка',
          url: `${BOOKS_HOST}/6/nr-3.pdf`,
          pages: 2,
        },
      ],
    },
    {
      subject: 'еврика',
      books: [
        {
          title: 'Еврика',
          note: 'На місяць',
          url: `${BOOKS_HOST}/6/evrika-1.pdf`,
          pages: 58,
        },
        {
          title: 'Еврика',
          note: 'На місяць · вкладка',
          url: `${BOOKS_HOST}/6/evrika-2.pdf`,
          pages: 8,
        },
      ],
    },
  ],
  '7': [
    {
      subject: 'ум',
      books: [
        {
          title: 'Українська мова',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/7/um-1.pdf`,
          pages: 27,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · алгоритми виконання ДЗ тощо',
          url: `${BOOKS_HOST}/7/um-2.pdf`,
          pages: 1,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · додаткове завд. (діалектизми, професіоналізми)',
          url: `${BOOKS_HOST}/7/um-3.pdf`,
          pages: 1,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · ЗНО',
          url: `${BOOKS_HOST}/7/um-4.pdf`,
          pages: 6,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · зош для повтор',
          url: `${BOOKS_HOST}/7/um-5.pdf`,
          pages: 26,
        },
        {
          title: 'Українська мова',
          note: 'На рік · карти знань та інтелект-карти пр2',
          url: `${BOOKS_HOST}/7/um-6.pdf`,
          pages: 27,
          full: true,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · комунікативно-творча сторінкаор',
          url: `${BOOKS_HOST}/7/um-7.pdf`,
          pages: 4,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · лінгвістичні ігри (коди)',
          url: `${BOOKS_HOST}/7/um-8.pdf`,
          pages: 2,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · тренувальні впр',
          url: `${BOOKS_HOST}/7/um-9.pdf`,
          pages: 3,
        },
      ],
    },
    {
      subject: 'ул',
      books: [
        {
          title: 'Українська література',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/7/ul-1.pdf`,
          pages: 16,
        },
        {
          title: 'Українська література',
          note: 'На рік · хрестоматія',
          url: `${BOOKS_HOST}/7/ul-2.pdf`,
          pages: 113,
          full: true,
        },
      ],
    },
    {
      subject: 'зл',
      books: [
        {
          title: 'Зарубіжна література',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/7/zl-1.pdf`,
          pages: 13,
        },
        {
          title: 'Зарубіжна література',
          note: 'На місяць · Карта знань',
          url: `${BOOKS_HOST}/7/zl-2.pdf`,
          pages: 7,
        },
        {
          title: 'Зарубіжна література',
          note: 'На рік · хрестоматія',
          url: `${BOOKS_HOST}/7/zl-3.pdf`,
          pages: 72,
          full: true,
        },
      ],
    },
    {
      subject: 'іст',
      books: [
        {
          title: 'Історія',
          note: 'Тиждень 1 · Навчальні матеріали',
          url: `${BOOKS_HOST}/7/hist-1.pdf`,
          pages: 4,
        },
        {
          title: 'Історія',
          note: 'Тиждень 1 · Робочий зошит',
          url: `${BOOKS_HOST}/7/hist-2.pdf`,
          pages: 8,
        },
      ],
    },
    {
      subject: 'М',
      title: 'Алгебра',
      books: [
        {
          title: 'Алгебра',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/7/algebra-1.pdf`,
          pages: 32,
        },
        {
          title: 'Алгебра',
          note: 'На рік · карти знань',
          url: `${BOOKS_HOST}/7/algebra-2.pdf`,
          pages: 41,
          full: true,
        },
      ],
    },
    {
      subject: 'М',
      title: 'Геометрія',
      books: [
        {
          title: 'Геометрія',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/7/geometry-1.pdf`,
          pages: 22,
        },
        {
          title: 'Геометрія',
          note: 'На рік · карти знань',
          url: `${BOOKS_HOST}/7/geometry-2.pdf`,
          pages: 41,
          full: true,
        },
      ],
    },
    {
      subject: 'г',
      books: [
        {
          title: 'Географія',
          note: 'Тиждень 1 · ДЗ',
          url: `${BOOKS_HOST}/7/geo-1.pdf`,
          pages: 30,
        },
        {
          title: 'Географія',
          note: 'На місяць · Інтелект карти Карти знань',
          url: `${BOOKS_HOST}/7/geo-2.pdf`,
          pages: 5,
        },
      ],
    },
    {
      subject: 'б',
      books: [
        {
          title: 'Біологія',
          note: 'Тиждень 1 · пр5 Тижд',
          url: `${BOOKS_HOST}/7/bio-1.pdf`,
          pages: 25,
        },
      ],
    },
    {
      subject: 'ф',
      books: [
        {
          title: 'Фізика',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/7/phys-1.pdf`,
          pages: 27,
        },
      ],
    },
    {
      subject: 'х',
      books: [
        {
          title: 'Хімія',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/7/chem-1.pdf`,
          pages: 28,
        },
      ],
    },
    {
      subject: 'нр',
      books: [
        {
          title: 'Навчаємось разом',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/7/nr-1.pdf`,
          pages: 4,
        },
        {
          title: 'Навчаємось разом',
          note: 'На рік · вкладка',
          url: `${BOOKS_HOST}/7/nr-2.pdf`,
          pages: 4,
          full: true,
        },
      ],
    },
    {
      subject: 'еврика',
      books: [
        {
          title: 'Еврика',
          note: 'На місяць',
          url: `${BOOKS_HOST}/7/evrika-1.pdf`,
          pages: 65,
        },
        {
          title: 'Еврика',
          note: 'На місяць · вкладка',
          url: `${BOOKS_HOST}/7/evrika-2.pdf`,
          pages: 20,
        },
      ],
    },
  ],
  '8': [
    {
      subject: 'ум',
      books: [
        {
          title: 'Українська мова',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/8/um-1.pdf`,
          pages: 11,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · алгоритм виконання ДЗ тощо',
          url: `${BOOKS_HOST}/8/um-2.pdf`,
          pages: 1,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · довідк. інф',
          url: `${BOOKS_HOST}/8/um-3.pdf`,
          pages: 3,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · зошит для повтор',
          url: `${BOOKS_HOST}/8/um-4.pdf`,
          pages: 25,
        },
        {
          title: 'Українська мова',
          note: 'На рік · карти знань та інтелект-карти',
          url: `${BOOKS_HOST}/8/um-5.pdf`,
          pages: 25,
          full: true,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · комунікативно-творча сторінкаор',
          url: `${BOOKS_HOST}/8/um-6.pdf`,
          pages: 3,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · працюю з медіатекстом',
          url: `${BOOKS_HOST}/8/um-7.pdf`,
          pages: 2,
        },
        {
          title: 'Українська мова',
          note: 'На місяць · тренувальні вправи',
          url: `${BOOKS_HOST}/8/um-8.pdf`,
          pages: 10,
        },
      ],
    },
    {
      subject: 'ул',
      books: [
        {
          title: 'Українська література',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/8/ul-1.pdf`,
          pages: 43,
        },
      ],
    },
    {
      subject: 'зл',
      books: [
        {
          title: 'Зарубіжна література',
          note: 'Тиждень 1 · ЗЛМ 1 й',
          url: `${BOOKS_HOST}/8/zl-1.pdf`,
          pages: 11,
        },
        {
          title: 'Зарубіжна література',
          note: 'На місяць · ЗЛМ карти знань та алгоритми',
          url: `${BOOKS_HOST}/8/zl-2.pdf`,
          pages: 9,
        },
      ],
    },
    {
      subject: 'іст',
      books: [
        {
          title: 'Історія',
          note: 'Тиждень 1–2 · Навчальні матеріали',
          url: `${BOOKS_HOST}/8/hist-1.pdf`,
          pages: 26,
        },
        {
          title: 'Історія',
          note: 'Тиждень 1–2 · Робочий зошит',
          url: `${BOOKS_HOST}/8/hist-2.pdf`,
          pages: 21,
        },
      ],
    },
    {
      subject: 'М',
      title: 'Алгебра',
      books: [
        {
          title: 'Алгебра',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/8/algebra-1.pdf`,
          pages: 27,
        },
        {
          title: 'Алгебра',
          note: 'На рік · карти знань',
          url: `${BOOKS_HOST}/8/algebra-2.pdf`,
          pages: 41,
          full: true,
        },
      ],
    },
    {
      subject: 'М',
      title: 'Геометрія',
      books: [
        {
          title: 'Геометрія',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/8/geometry-1.pdf`,
          pages: 24,
        },
        {
          title: 'Геометрія',
          note: 'На рік · карти знань',
          url: `${BOOKS_HOST}/8/geometry-2.pdf`,
          pages: 41,
          full: true,
        },
      ],
    },
    {
      subject: 'г',
      books: [
        {
          title: 'Географія',
          note: 'Тиждень 1 · ДЗ',
          url: `${BOOKS_HOST}/8/geo-1.pdf`,
          pages: 23,
        },
      ],
    },
    {
      subject: 'б',
      books: [
        {
          title: 'Біологія',
          note: 'Тиждень 1 · пр3 Тижд',
          url: `${BOOKS_HOST}/8/bio-1.pdf`,
          pages: 26,
        },
      ],
    },
    {
      subject: 'ф',
      books: [
        {
          title: 'Фізика',
          note: 'Тиждень 1',
          url: `${BOOKS_HOST}/8/phys-1.pdf`,
          pages: 26,
        },
      ],
    },
    {
      subject: 'х',
      books: [
        {
          title: 'Хімія',
          note: 'Тиждень 1 · пр5',
          url: `${BOOKS_HOST}/8/chem-1.pdf`,
          pages: 17,
        },
      ],
    },
    {
      subject: 'нр',
      books: [
        {
          title: 'Навчаємось разом',
          note: 'На місяць · 2026 27 вкладка',
          url: `${BOOKS_HOST}/8/nr-1.pdf`,
          pages: 7,
        },
        {
          title: 'Навчаємось разом',
          note: 'Тиждень 1 · 2026 27 тиждень1',
          url: `${BOOKS_HOST}/8/nr-2.pdf`,
          pages: 2,
        },
      ],
    },
    {
      subject: 'еврика',
      books: [
        {
          title: 'Еврика',
          note: 'На місяць',
          url: `${BOOKS_HOST}/8/evrika-1.pdf`,
          pages: 57,
        },
        {
          title: 'Еврика',
          note: 'На місяць · вкладка',
          url: `${BOOKS_HOST}/8/evrika-2.pdf`,
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

/**
 * Підручники паралелі — лише з цих предметів (коди як у `SUBJECTS`).
 * Так учитель бачить свій предмет у кожній паралелі, де він викладає,
 * а не весь перелік класу.
 */
export function booksForGrade(grade: string, subjects: string[]): BookGroup[] {
  return (BOOKS[grade] ?? []).filter((g) => g.subject && subjects.includes(g.subject))
}
