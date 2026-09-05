/**
 * Імпорт офіційного розкладу ліцею (PDF з aSc Розклад) у src/data/timetable.ts.
 *
 *   npm i -D pdfjs-dist
 *   node scripts/import-timetable.mjs "шлях/до/Розклад класи.pdf"
 *
 * Верстка комірки в aSc:
 *   предмет      — по центру, великим кеглем
 *   кабінет      — знизу ліворуч, дрібним
 *   вчитель      — знизу праворуч, дрібним
 *   назва групи  — рядком вище предмета, дрібним
 *
 * Ручні уточнення, яких у PDF не видно, живуть в OVERRIDES і
 * CLASS_FIXES — повторний імпорт їх не загубить. Далі накладаються два
 * зовнішні джерела: `vchyteli.mjs` (учительський вивантаж aSc — домашні
 * кабінети, коди вчителів, чергування по тижнях) і `kabinety.mjs`
 * (паперовий розклад зі школи, він же й останнє слово).
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { ROOMS } from './kabinety.mjs'
import { FROM_TEACHERS } from './vchyteli.mjs'

const SRC = process.argv[2]
if (!SRC) {
  console.error('Вкажіть шлях до PDF: node scripts/import-timetable.mjs <файл.pdf>')
  process.exit(1)
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src', 'data', 'timetable.ts')

/** Беремо класи з цієї паралелі й старші. */
const FROM_GRADE = 4

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт']
const HALF_COLUMN = 73.75
/** Заголовок дня надрукований від лівого краю тексту; центр колонки правіше. */
const HEADER_TO_CENTRE = 10

/** Підпис групи в PDF → короткий ключ у даних. */
const GROUP_KEY = {
  '1 група': '1',
  '2 група': '2',
  Хлопці: 'х',
  Дівчата: 'д',
  а: 'а',
  б: 'б',
  в: 'в',
  н: 'н',
  ф: 'ф',
}

const GROUP_LABELS = new Set(Object.keys(GROUP_KEY))

/**
 * Ключ: `клас Дн період`. Правки однієї комірки, яких у PDF не видно.
 *
 * Хімія 10-Б у середу 8-м уроком колись жила тут; тепер її, як і решту
 * уроків «через тиждень», розпізнає сам розбір — див. `halfOnly`.
 */
const OVERRIDES = {}

/* ── Уточнення за паперовим розкладом із кабінетами ───────────────────── */

/**
 * Школа видала розклад із кабінетами вже після цього PDF. Предметну сітку
 * він майже не змінює (697 уроків із 702 стоять там само), але в кількох
 * класах порядок уроків інший — і ці правки живуть тут, бо в PDF їх немає.
 *
 * Функція отримує п'ять днів класу «сирими», ще до розмітки груп, і
 * повертає їх виправленими. Дні — масиви `{ n, cells }`, `n` — глобальний
 * період за BELLS.
 */
const CLASS_FIXES = {
  /*
   * У 6-А PDF розійшовся з папером двічі, і в обидві сторони.
   *
   * Понеділок зібраний в іншому порядку, і математики в PDF на сім уроків
   * лише шість. А в п'ятницю навпаки: нульового уроку немає (це видно на
   * фото стенду), а PDF ставить математику двічі підряд — зайве.
   *
   * Порядок понеділка — з паперу, і починається він не з нульового уроку, а
   * на урок раніше: математика стоїть «мінус першим», о 11:55 (підтверджено
   * у школі). Поки весь день стояв на урок пізніше, шість уроків 6-А
   * накладались на інші класи — та сама Наталія Овчар мала б водночас вести
   * математику в 5-В.
   */
  '6а': (days) => {
    const mon = days[0]
    const at = (subject) => mon.find((l) => l.cells[0].s === subject)
    const order = ['іст', 'зл', 'ам', 'мпЗ', 'ум', 'фк']
    const monday = [{ n: 5, cells: [{ s: 'М', t: 'НО' }] }]
    order.forEach((subject, i) => {
      const lesson = at(subject)
      if (lesson) monday.push({ n: 6 + i, cells: lesson.cells })
    })
    // Перебудовуємо лише тоді, коли знайшли всі шість уроків понеділка.
    if (monday.length !== 7) return days

    const friday = days[4].filter((l) => l.n !== 6)
    return [monday, days[1], days[2], days[3], friday]
  },

  /* У 7-А образотворче з музикою і математика стоять навпаки: */
  /* на папері обр/муз у вівторок 7-м, а математика в середу 4-м. */
  '7а': (days) => {
    const tue = days[1].find((l) => l.n === 7)
    const wed = days[2].find((l) => l.n === 4)
    if (!tue || !wed) return days
    const swap = tue.cells
    tue.cells = wed.cells
    wed.cells = swap
    return days
  },

}

/**
 * Одне скорочення в розкладі — різні предмети в різних учителів.
 *
 * «і» — це і Історія, і Інформатика. Розрізняємо за вчителем; перевірено
 * по всій школі: жоден із цих учителів не веде обидва предмети. Історію
 * слухає весь клас, інформатику завжди ділять на групи — тому комірки,
 * де вчителя не вказано, теж розрізняються однозначно.
 *
 * «п» у 9-х веде той самий історик у своєму кабінеті — це Правознавство.
 */
const HISTORY_TEACHERS = new Set(['ЛК', 'ЛЧ', 'ІХ', 'СВС'])
const LAW_TEACHERS = new Set(['ЛК'])

function resolveSubject(cell) {
  if (cell.s === 'і') {
    const history = cell.t ? HISTORY_TEACHERS.has(cell.t) : !cell.g
    return history ? 'іст' : 'і'
  }
  if (cell.s === 'п' && cell.t && LAW_TEACHERS.has(cell.t)) return 'прав'
  return cell.s
}

/** «5а», «11б» — це інший клас, з яким урок спільний, а не вчитель. */
const isClass = (t) => /^\d{1,2}[а-д]$/.test(t)
/** Кабінет — число або малими літерами («сз», «тз»). */
const isRoom = (t) => !isClass(t) && (/^\d{1,3}$/.test(t) || /^[а-яіїєґ]{1,3}$/.test(t))
/** Вчитель — дво- чи трилітерний код великими. */
const isTeacher = (t) => /^[А-ЯІЇЄҐ]{2,3}$/.test(t)

/* ── 1. Текст із координатами ─────────────────────────────────────────── */

async function readPages() {
  const data = new Uint8Array(await readFile(SRC))
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise

  const pages = []
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    pages.push({
      page: p,
      items: content.items
        .filter((i) => i.str && i.str.trim())
        .map((i) => ({
          s: i.str.trim(),
          x: Math.round(i.transform[4] * 10) / 10,
          y: Math.round((vp.height - i.transform[5]) * 10) / 10,
          w: Math.round(i.width * 10) / 10,
          h: Math.round(i.height * 10) / 10,
        })),
    })
  }
  return pages
}

/* ── 2. Розбір таблиці ────────────────────────────────────────────────── */

/** Групує елементи в рядки за координатою y. */
function rowsOf(items, eps = 3) {
  const rows = []
  for (const it of [...items].sort((a, b) => a.y - b.y)) {
    const row = rows.find((r) => Math.abs(r.y - it.y) <= eps)
    if (row) {
      row.items.push(it)
      row.y = (row.y * (row.items.length - 1) + it.y) / row.items.length
    } else {
      rows.push({ y: it.y, items: [it] })
    }
  }
  for (const r of rows) r.items.sort((a, b) => a.x - b.x)
  return rows
}

function parsePage(page) {
  const cls = page.items.find((i) => i.y < 50 && i.h > 20)?.s?.trim()
  const homeroom = page.items
    .find((i) => i.s.includes('керівник'))
    ?.s.replace(/^Кл\. керівник:\s*:?\s*/, '')
    .trim()

  const headers = DAYS.map((d) => page.items.find((i) => i.s === d && i.h > 12))
  if (headers.some((h) => !h)) throw new Error(`${cls}: не знайшов заголовки днів`)

  const columns = headers.map((h) => {
    const centre = h.x + HEADER_TO_CENTRE
    return { left: centre - HALF_COLUMN, right: centre + HALF_COLUMN, centre }
  })

  // Смуги уроків: якір — підпис часу ліворуч.
  const times = page.items
    .filter((i) => i.x < 60 && /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(i.s))
    .sort((a, b) => a.y - b.y)

  const days = DAYS.map(() => [])

  times.forEach((time, index) => {
    // Смуга починається одразу під попереднім рядком «кабінет/вчитель»,
    // інакше рядок із назвами груп лишається за її межами.
    const top = index === 0 ? time.y - 34 : times[index - 1].y + 3
    const band = page.items.filter((i) => i.y > top && i.y <= time.y + 2 && i.x >= 60)
    if (band.length === 0) return

    const rows = rowsOf(band)
    const subjectRow = rows.find((r) => r.items.some((i) => i.h > 6))
    if (!subjectRow) return

    const headerItems = rows.filter((r) => r.y < subjectRow.y - 2).flatMap((r) => r.items)
    const metaItems = rows.filter((r) => r.y > subjectRow.y + 2).flatMap((r) => r.items)

    columns.forEach((col, dayIndex) => {
      const inCol = (i) => i.x >= col.left && i.x < col.right
      const subjects = subjectRow.items.filter((i) => inCol(i) && i.h > 6)
      if (subjects.length === 0) return

      const labels = headerItems.filter((i) => inCol(i) && GROUP_LABELS.has(i.s))
      const meta = metaItems.filter(inCol)

      let parts = Math.max(subjects.length, labels.length, 1)
      /*
       * Один предмет, зміщений від центру — комірка поділена, зайнята одна
       * половина. Підпису групи немає, отже це не поділ класу, а чергування
       * по тижнях: урок буває раз на два тижні. На паперовому розкладі його
       * так і пишуть — «історія//» або «//хімія».
       */
      let halfOnly = false
      if (subjects.length === 1 && labels.length === 0) {
        if (Math.abs(subjects[0].x + subjects[0].w / 2 - col.centre) > 18) {
          parts = 2
          halfOnly = true
        }
      }

      const width = (col.right - col.left) / parts
      const slotOf = (x) => Math.min(parts - 1, Math.max(0, Math.floor((x - col.left) / width)))

      const cells = subjects.map((subject) => {
        const slot = slotOf(subject.x + subject.w / 2)
        const slotLeft = col.left + slot * width
        const slotRight = slotLeft + width
        const own = meta.filter((i) => i.x >= slotLeft && i.x < slotRight)
        const label = labels.find((i) => i.x >= slotLeft && i.x < slotRight)

        // Позиція каже, до якої комірки належить напис, а вигляд — що це таке.
        const cell = {
          s: subject.s,
          room: own.find((i) => isRoom(i.s))?.s,
          t: own.find((i) => isTeacher(i.s))?.s,
          g: label ? GROUP_KEY[label.s] : undefined,
          // Ліва половина — перший тиждень, права — другий.
          w: halfOnly ? (slot === 0 ? 1 : 2) : undefined,
        }
        return { ...cell, s: resolveSubject(cell) }
      })

      days[dayIndex].push({ n: index + 1, cells })
    })
  })

  return { cls, homeroom, days }
}

/**
 * Комірка поділена, але підпису групи немає — це чергування по тижнях
 * (перевірено на 10-Б, середа, 2 урок). Перша половина — перший тиждень.
 */
function markWeekAlternation(cells) {
  if (cells.length !== 2 || cells.some((c) => c.g)) return cells
  return cells.map((c, i) => ({ ...c, g: i === 0 ? 'т1' : 'т2' }))
}

/**
 * Накладає те, що видно лише в учительському розкладі (`vchyteli.mjs`):
 * домашні кабінети класів, коди вчителів, яких класний PDF не друкує, і
 * чергування по тижнях, якого в класному вигляді не розпізнати.
 */
function fromTeachers(key, cells) {
  const fixes = FROM_TEACHERS[key]
  if (!fixes) return cells
  return cells.map((c, i) => {
    const { r, ...rest } = fixes[i] ?? {}
    return r ? { ...c, ...rest, room: r } : { ...c, ...rest }
  })
}

/**
 * Ставить кабінети з паперового розкладу (див. `kabinety.mjs`) — там, де
 * він їх дає. Порожній рядок і відсутній номер лишають те, що в PDF.
 */
function withRooms(key, cells) {
  const rooms = ROOMS[key]
  if (!rooms) return cells
  return cells.map((c, i) => (rooms[i] ? { ...c, room: rooms[i] } : c))
}

/* ── 3. Генерація TypeScript ──────────────────────────────────────────── */

const esc = (s) => `'${String(s).replace(/'/g, "\\'")}'`

function cellLiteral(c) {
  const parts = [`s: ${esc(c.s)}`]
  if (c.room) parts.push(`r: ${esc(c.room)}`)
  if (c.t) parts.push(`t: ${esc(c.t)}`)
  if (c.g) parts.push(`g: ${esc(c.g)}`)
  if (c.w) parts.push(`w: ${c.w}`)
  return `{ ${parts.join(', ')} }`
}

const parsed = (await readPages())
  .map(parsePage)
  .filter((p) => parseInt(p.cls, 10) >= FROM_GRADE)
  .sort((a, b) => parseInt(a.cls, 10) - parseInt(b.cls, 10) || a.cls.localeCompare(b.cls, 'uk'))

const blocks = []
const stats = { lessons: 0, cells: 0, unnamed: [] }

for (const p of parsed) {
  const days = CLASS_FIXES[p.cls] ? CLASS_FIXES[p.cls](p.days) : p.days
  const dayBlocks = days.map((day, di) => {
    const lines = day.map((lesson) => {
      const key = `${p.cls} ${DAYS[di]}${lesson.n}`
      const cells = withRooms(
        key,
        fromTeachers(
          key,
          OVERRIDES[key] ? OVERRIDES[key](lesson.cells) : markWeekAlternation(lesson.cells),
        ),
      )

      if (cells.length > 1 && cells.every((c) => !c.g)) stats.unnamed.push(key)
      stats.lessons += 1
      stats.cells += cells.length

      return `      { p: ${lesson.n}, c: [${cells.map(cellLiteral).join(', ')}] },`
    })
    return `    [\n${lines.join('\n')}\n    ],`
  })

  blocks.push(
    `  {\n` +
      `    id: ${esc(p.cls)},\n` +
      `    name: ${esc(p.cls.replace(/^(\d+)/, '$1-').toUpperCase())},\n` +
      `    homeroom: ${esc(p.homeroom)},\n` +
      `    days: [\n${dayBlocks.join('\n')}\n    ],\n` +
      `  },`,
  )
}

const header = `/**
 * Розклад усієї школи, ${FROM_GRADE}–11 класи.
 *
 * ЗГЕНЕРОВАНО з офіційного PDF ліцею скриптом
 * \`scripts/import-timetable.mjs\`. Правити руками можна, але при
 * повторному імпорті правки треба перенести в OVERRIDES того скрипта.
 *
 * Поля комірки:
 *   s — предмет (ключ у SUBJECTS)
 *   r — кабінет, як він стоїть у розкладі; немає — значить, немає
 *   t — код учителя, як у розкладі
 *   g — кому цей варіант: '1'/'2' навчальна група, 'а'/'б'/'в' англійська,
 *       'н'/'ф' друга іноземна, 'х'/'д' поділ на фізкультурі,
 *       'т1'/'т2' чергування по тижнях
 *   w — урок буває лише на тижнях цієї парності
 *
 * p — номер періоду за загальношкільним розкладом дзвінків (див. BELLS).
 */

import type { ClassTimetable } from './schedule'

export const TIMETABLE: ClassTimetable[] = [
`

await writeFile(OUT, header + blocks.join('\n') + '\n]\n', 'utf8')

console.log(
  `класів: ${parsed.length} | уроків: ${stats.lessons} | комірок: ${stats.cells}`,
)
if (stats.unnamed.length) console.log('поділ без підпису групи:', stats.unnamed.join(', '))
console.log('записано', OUT)
