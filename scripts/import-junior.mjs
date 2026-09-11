/**
 * Імпорт розкладу молодшої школи (1–4 класи) у src/data/junior.ts.
 *
 *   node scripts/import-junior.mjs "Розклад.docx"
 *
 * Молодша школа живе окремо від решти не з примхи: 5–11 класи ліцей
 * друкує з aSc у PDF (див. `import-timetable.mjs`), а 1–4 — руками у
 * Word, і в тому Word немає ні кабінетів, ні кодів учителів. Є лише
 * предмет, і той — як його написали: «фізкульт.», «фізк.» та «ф-ра» це
 * той самий урок. Тому весь розбір тут — це нормалізація написань.
 *
 * Комірка «А/Б» — це поділ класу: ліворуч перша група, праворуч друга.
 * Видно з самої таблиці: у 1-Б у понеділок другим уроком «англ/укр», а
 * третім «укр/англ» — групи міняються місцями. Виняток один — пара
 * «муз/образ.»: це не поділ, а чергування по тижнях, як і в старших
 * класах (див. `ом`/`мм` у timetable.ts). Клас або має окремі уроки
 * музики й образотворчого, або одну спільну комірку — ніколи і те, і те.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'

const SRC = process.argv[2]
if (!SRC) {
  console.error('Вкажіть шлях до Word: node scripts/import-junior.mjs <файл.docx>')
  process.exit(1)
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src', 'data', 'junior.ts')

/** Беремо класи молодші за цю паралель — 5–11 приходять із PDF. */
const UPTO_GRADE = 4

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт']

/**
 * Класні керівники — як у Word → як підписуємо в даних.
 *
 * У Word стоять самі ініціали, а решта розкладу підписана «Ім'я
 * Прізвище», тож імена звірені з `учителя.json`: усі дев'ятеро там є, по
 * одній людині на прізвище, ініціали збіглися. Це не косметика — картка
 * вчителя впізнає класного керівника саме за парою ім'я+прізвище, і
 * Наталія Луцька, яка вже веде українську в 4-х, інакше не отримає
 * підпису «класний керівник 2-В».
 */
const HOMEROOMS = {
  'Притуляк Т.В.': 'Тетяна Притуляк',
  'Римик О.В.': 'Олена Римик',
  'Ремська І.Б.': 'Іванна Ремська',
  "Карпаш М.Б.": "Мар'яна Карпаш",
  'Худобяк Н.Р.': 'Наталія Худобяк',
  'Луцька Н.І.': 'Наталія Луцька',
  'Мельник І.Р.': 'Ірина Мельник',
  'Запорожцева Г.М.': 'Галина Запорожцева',
  "Петруцяк М.Б.": "Мар'яна Петруцяк",
  // 4-і жили в PDF — звідти ж і їхні імена, щоб підпис не змінився.
  'Братина Х.С.': 'Христина Братина',
  'Лотоцька М.В.': 'Марія Лотоцька',
  'Федорук Л.В.': 'Людмила Федорук',
}

/**
 * Написання предмета в Word → ключ у SUBJECTS. Ключі нормалізовані:
 * малими літерами й без крапки в кінці.
 */
const SUBJECTS = {
  'укр.м': 'ум',
  'укр мова': 'ум',
  укр: 'ум',
  матем: 'М',
  англ: 'ам',
  анг: 'ам',
  фізкульт: 'фк',
  фізк: 'фк',
  'ф-ра': 'фк',
  япс: 'япс',
  ядс: 'ядс',
  хе: 'хе',
  дизайн: 'діт',
  хореогр: 'хор',
  музика: 'мм',
  муз: 'мм',
  образотв: 'ом',
  образ: 'ом',
  'обр.м-во': 'ом',
  інформ: 'і',
  інф: 'і',
  чит: 'чит',
}


/**
 * Початок уроку в Word → період за BELLS. Номер у таблиці не годиться:
 * у 1–3 уроки нумерують з першого, а в 4-х — з нульового, і той нульовий
 * це вже шоста година загальношкільних дзвінків. Час — єдиний спільний
 * якір, і незнайомий час краще хай зупинить імпорт, ніж мовчки зсуне день.
 */
const PERIOD_AT = {
  '8.00': 1,
  '8.55': 2,
  '9.55': 3,
  '10.55': 4,
  '11.55': 5,
  '12.45': 6,
  '13.40': 7,
  '14.40': 8,
  '15.40': 9,
  '16.30': 10,
  '17.20': 11,
  '18.05': 12,
}

/**
 * Кабінети й учителі 4-х класів. У Word їх немає, але вони є в PDF, з
 * якого 4-і жили раніше, — і це властивість не години, а пари
 * «предмет + група»: українську в 4-А другій групі однаково веде НЛ у
 * 29-му, на якому б уроці вона не стояла. Тому нову сітку з Word беремо
 * як є, а кабінет із учителем підставляємо сюди звідси. Ключ без групи —
 * запасний: він спрацьовує там, де Word ділить клас інакше, ніж ділив PDF.
 * Предмета, якого в PDF у цього класу не було (музика в 4-А), тут немає —
 * і не буде ні кабінету, ні вчителя, поки школа їх не назве.
 */
const FOURTH = {
  '4а': {
    'ам/1': { r: '26', t: 'НА' },
    'ам/2': { r: '26', t: 'ОБ' },
    діт: { r: '3', t: 'ГС' },
    'і/1': { t: 'ІЗ' },
    'і/2': { r: '15', t: 'ІЗ' },
    М: { r: '21', t: 'ХБ' },
    ом: { r: '26', t: 'ГС' },
    'ум/1': { r: '21', t: 'ХБ' },
    'ум/2': { r: '29', t: 'НЛ' },
    фк: { r: 'сз', t: 'ДФ' },
    ядс: { r: '21', t: 'ХБ' },
  },
  '4б': {
    'ам/1': { r: '24', t: 'НА' },
    'ам/2': { r: '24', t: 'ОК' },
    і: { r: '22', t: 'МЛ' },
    М: { r: '24', t: 'МЛ' },
    мм: { r: '24', t: 'ОП' },
    ум: { r: '24', t: 'МЛ' },
    фк: { t: 'ДФ' },
    япс: { r: '24', t: 'МЛ' },
  },
  '4в': {
    'ам/1': { r: '27', t: 'ОК' },
    'ам/2': { r: '27', t: 'ОБ' },
    'і/1': { r: '2', t: 'МХ' },
    'і/2': { r: '5', t: 'МХ' },
    М: { r: '27', t: 'ЛФ' },
    мм: { r: '27', t: 'ОП' },
    ом: { r: '27', t: 'ГС' },
    ум: { r: '27', t: 'ЛФ' },
    фк: { t: 'ДФ' },
    япс: { r: '27', t: 'ЛФ' },
  },
}

/* ── 1. Word ─────────────────────────────────────────────────────────── */

/**
 * Дістає один файл із docx. Docx — це zip, а розпакувати deflate вміє
 * `zlib`, тож окрема залежність заради одного файлу тут ні до чого.
 */
function unzip(buf, want) {
  // Кінець центрального каталогу шукаємо з хвоста: коментаря в docx немає,
  // але шукати сигнатуру все одно надійніше, ніж рахувати від кінця.
  let eocd = buf.length - 22
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1
  if (eocd < 0) throw new Error(`${want}: файл не схожий на zip`)

  let at = buf.readUInt32LE(eocd + 16)
  for (let i = buf.readUInt16LE(eocd + 10); i > 0; i -= 1) {
    const nameLen = buf.readUInt16LE(at + 28)
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen)
    if (name === want) {
      const method = buf.readUInt16LE(at + 10)
      const size = buf.readUInt32LE(at + 20)
      // Довжини імені й «extra» в локальному заголовку свої, не з каталогу.
      const local = buf.readUInt32LE(at + 42)
      const from = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
      const raw = buf.subarray(from, from + size)
      return method === 0 ? raw.toString('utf8') : inflateRawSync(raw).toString('utf8')
    }
    at += 46 + nameLen + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32)
  }
  throw new Error(`${want}: немає в архіві`)
}

const unescape = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

/** Текст комірки: абзаци через пробіл, як їх і читають на папері. */
function cellText(tc) {
  return tc
    .split(/<w:p[ >]/)
    .slice(1)
    .map((p) =>
      unescape([...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')).trim(),
    )
    .filter(Boolean)
    .join(' ')
    .trim()
}

/** Усі таблиці документа як масиви рядків із текстом комірок. */
function tablesOf(xml) {
  return xml
    .split('<w:tbl>')
    .slice(1)
    .map((t) =>
      t
        .split('</w:tbl>')[0]
        .split(/<w:tr[ >]/)
        .slice(1)
        .map((tr) =>
          tr
            .split('</w:tr>')[0]
            .split(/<w:tc[ >]/)
            .slice(1)
            .map((tc) => cellText(tc.split('</w:tc>')[0])),
        ),
    )
}

/* ── 2. Розбір комірки ───────────────────────────────────────────────── */

/** «Фізкульт.» і «фізк.» — те саме слово; крапка в кінці нічого не значить. */
const normalize = (s) => s.trim().toLowerCase().replace(/\.+$/, '').replace(/\s+/g, ' ')

const unknown = new Set()
/** Комірки, де частина половин із номером групи, а частина без. */
const mixed = new Set()

/** Одна половина комірки: «анг.(1,2)» → предмет «ам» і групи ['1','2']. */
function part(text) {
  const groups = /\(([\d\s,]+)\)\s*$/.exec(text)
  const name = normalize(groups ? text.slice(0, groups.index) : text)
  if (!name) return null
  const s = SUBJECTS[name]
  if (!s) unknown.add(name)
  return { s: s ?? name, g: groups ? groups[1].split(',').map((n) => n.trim()) : [] }
}

/**
 * Комірка розкладу → комірки даних.
 *
 * Група проставляється лише там, де вона є на папері: явним номером у
 * дужках або самим поділом навпіл. Урок на весь клас лишається без `g` —
 * а «муз/образ.» стає чергуванням по тижнях.
 */
function cellsOf(text) {
  const parts = text.split('/').map(part).filter(Boolean)
  if (parts.length === 0) return []

  // Номер групи проставлений явно — він і головний, поділ навпіл тут ні до чого.
  if (parts.some((p) => p.g.length > 0)) {
    // Половина з номером, половина без — на папері таке рівно раз
    // («анг.(1,2)/ХЕ» в 1-А), і що воно означає, з паперу не видно.
    // Показуємо обидва предмети: зайвий рядок у розкладі гірший за
    // урок, якого дитина не побачила. Мовчки вгадувати не можна.
    if (parts.some((p) => p.g.length === 0)) mixed.add(text)
    return parts.flatMap((p) =>
      // «(1,2)» — обидві групи, тобто весь клас: підписувати нічого.
      p.g.length === 1 ? [{ s: p.s, g: p.g[0] }] : [{ s: p.s }],
    )
  }

  if (parts.length === 1) return [{ s: parts[0].s }]

  const art = parts.every((p) => p.s === 'мм' || p.s === 'ом')
  return parts.map((p, i) => ({ s: p.s, g: art ? `т${i + 1}` : `${i + 1}` }))
}


/** Кабінет і вчитель для 4-х — із PDF, за парою «предмет + група». */
function withMeta(id, cells) {
  const known = FOURTH[id]
  if (!known) return cells
  return cells.map((c) => ({ ...c, ...(known[c.g ? `${c.s}/${c.g}` : c.s] ?? known[c.s] ?? {}) }))
}

/* ── 3. Розбір таблиці ───────────────────────────────────────────────── */

/** «1-А Притуляк Т.В., 22» → id, назва, керівник. */
function classOf(head) {
  const m = /^(\d+)\s*-\s*([А-ЯІЇЄҐ])\s+(.*?),?\s*(\d+)?\s*$/.exec(head)
  if (!m) throw new Error(`не розібрав заголовок класу: «${head}»`)
  const [, grade, letter, teacher] = m
  return {
    grade: Number(grade),
    id: `${grade}${letter.toLowerCase()}`,
    name: `${grade}-${letter}`,
    homeroom: HOMEROOMS[teacher.replace(/,$/, '')] ?? teacher.replace(/,$/, ''),
  }
}

function parseTable(rows) {
  const classes = rows[0].slice(3).map(classOf)
  const days = classes.map(() => DAYS.map(() => []))
  const seen = []

  for (const row of rows.slice(1)) {
    const label = row[0].trim()
    const number = row[1].trim()
    // Заголовок дня стоїть лише в першому рядку блоку; порожній рядок між
    // днями пропускаємо — номера уроку в ньому немає.
    if (label && label !== seen[seen.length - 1]) seen.push(label)
    if (!/^\d+$/.test(number)) continue

    const day = seen.length - 1
    const p = PERIOD_AT[row[2].trim().split('-')[0].trim()]
    if (!p) throw new Error(`невідомий час уроку: «${row[2]}»`)
    classes.forEach((cls, ci) => {
      const cells = withMeta(cls.id, cellsOf(row[3 + ci] ?? ''))
      if (cells.length > 0) days[ci][day].push({ p, c: cells })
    })
  }

  if (seen.length !== 5) throw new Error(`днів у таблиці ${seen.length}, а не 5: ${seen}`)
  // У шапці стоять «Пд» і «Пн» — на папері описка, дні йдуть підряд.
  return classes.map((cls, ci) => ({ ...cls, days: days[ci] }))
}

/* ── 4. Генерація TypeScript ─────────────────────────────────────────── */

const esc = (s) => (String(s).includes("'") ? `"${s}"` : `'${s}'`)

const cellLiteral = (c) => {
  const parts = [`s: ${esc(c.s)}`]
  if (c.r) parts.push(`r: ${esc(c.r)}`)
  if (c.t) parts.push(`t: ${esc(c.t)}`)
  if (c.g) parts.push(`g: ${esc(c.g)}`)
  return `{ ${parts.join(', ')} }`
}

const xml = unzip(readFileSync(SRC), 'word/document.xml')
const parsed = tablesOf(xml)
  .flatMap((rows) => parseTable(rows))
  .filter((cls) => cls.grade <= UPTO_GRADE)
  .sort((a, b) => a.grade - b.grade || a.id.localeCompare(b.id, 'uk'))

if (parsed.length === 0) throw new Error('жодного класу молодшої школи не знайшов')
if (unknown.size > 0) console.warn('Невідомі скорочення:', [...unknown].join(', '))
if (mixed.size > 0) console.warn('Половина з номером групи, половина без:', [...mixed].join(', '))

const last = Math.max(...parsed.flatMap((c) => c.days.flat().map((l) => l.p)))

const blocks = parsed.map((cls) => {
  const days = cls.days.map((day) => {
    const lines = day.map((l) => `      { p: ${l.p}, c: [${l.c.map(cellLiteral).join(', ')}] },`)
    return `    [\n${lines.join('\n')}\n    ],`
  })
  return (
    `  {\n` +
    `    id: ${esc(cls.id)},\n` +
    `    name: ${esc(cls.name)},\n` +
    `    homeroom: ${esc(cls.homeroom)},\n` +
    `    days: [\n${days.join('\n')}\n    ],\n` +
    `  },`
  )
})

const out = `/**
 * Розклад молодшої школи, 1–${UPTO_GRADE} класи.
 *
 * ЗГЕНЕРОВАНО з Word-файлу школи скриптом \`scripts/import-junior.mjs\`.
 * Правити руками можна, але при повторному імпорті правки треба
 * перенести в той скрипт.
 *
 * Кабінетів і кодів учителів тут немає: у Word їх не друкують. Є лише
 * предмет і, де клас ділиться, номер групи. Поля комірки — ті самі, що
 * й у \`timetable.ts\`.
 *
 * Дзвінки в молодшій школі загальношкільні: уроки 1–${last} за BELLS.
 */

import type { ClassTimetable } from './schedule'

export const JUNIOR: ClassTimetable[] = [
${blocks.join('\n')}
]
`

writeFileSync(OUT, out)

const lessons = parsed.reduce((n, c) => n + c.days.flat().length, 0)
console.log(`${OUT}: ${parsed.length} класів, ${lessons} уроків`)
