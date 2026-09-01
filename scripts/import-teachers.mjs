/**
 * Імпорт учительського складу зі шкільного журналу.
 *
 *   node scripts/import-teachers.mjs [учителя.json]
 *
 * Вхід — вивантаження `GET /v1/{school}/Teacher` з eschool-ua (той самий
 * файл, що лежить у корені проєкту). Звільнених не переносимо.
 *
 * На виході два файли:
 *   src/data/teachers.ts — прізвища й коди, їде у збірку;
 *   src/data/contacts.ts — телефони, у git не потрапляє (див. .gitignore).
 *
 * Коди з паперового розкладу (дволітерні, зрідка трилітерні) журнал не
 * знає — вони живуть у таблиці CODES нижче й правляться руками.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = process.argv[2] ?? join(ROOT, 'учителя.json')
const OUT = join(ROOT, 'src', 'data', 'teachers.ts')
const CONTACTS = join(ROOT, 'src', 'data', 'contacts.ts')
const TIMETABLE = join(ROOT, 'src', 'data', 'timetable.ts')

/**
 * Код у розкладі → хто це.
 *
 * Правило кодування в aSc просте: перша літера імені + перша літера
 * прізвища («ХБ» — Христина Братина). Трилітерний код розводить тезок:
 * «СВС» — Савчук Світлана Василівна, бо Савчук Світлан у школі дві.
 * Один код зібрано навпаки — «ВЮ», Варварук Юлія.
 *
 * Іноді під одним кодом ходять двоє різних людей — тоді уроки розводимо
 * предметом (`s`), а де й це не рятує — класом (`in`). Умови всередині
 * одного правила діють разом, правил може бути кілька — спрацьовує будь-яке.
 *
 * Коди, яких тут немає, показуємо як на папері — вигадувати не можна.
 * Станом на зараз нерозгаданих два, обидва див. у UNDECODED.
 */
const CODES = {
  НА: 'Андрішак Надія Володимирівна',
  // Єдиний код, складений навпаки — з прізвища та імені, а не з імені
  // та прізвища. Підтверджено у школі.
  ВЮ: 'Варварук Юлія Андріївна',
  АГ: 'Горін Анастасія Євгенівна',
  АК: 'Куневич Анна Романівна',
  ВМ: 'Микицей Віталій Богданович',
  ГГ: 'Гриш Галина Ярославівна',
  ГД: 'Дмитриченко Ганна Іванівна',
  ГЖ: 'Желяк Галина Богданівна',
  ГК: 'Колос Галина Василівна',
  ГЛ: 'Лялька Галина Ярославівна',
  ГС: 'Совтисік Галина Олегівна',
  ДД: 'Данилюк Діана Іванівна',
  ДР: 'Рабуцький Денис Васильович',
  ДФ: 'Фурик Дмитро Дмитрович',
  ІГ: 'Гарасим Іван Миколайович',
  ІЗ: 'Загаровська Ірина Василівна',
  ІХ: 'Хмелевська Інна Олексіївна',
  ЛБ: 'Білічак Любов Степанівна',
  ЛК: 'Кобута Лариса Петрівна',
  ЛФ: 'Федорук Людмила Василівна',
  МГ: "Галюк Мар'яна Ярославівна",
  МД: "Данилюк Мар'яна Григорівна",
  МК: "Канцак Мар'яна Миколаївна",
  МЛ: 'Лотоцька Марія Володимирівна',
  МТ: 'Теремко Марія Григорівна',
  МХ: 'Хемій Марія Михайлівна',
  НВ: 'Вороневич Надія Іванівна',
  НЗ: 'Запухляк Наталія Михайлівна',
  НЛ: 'Луцька Наталія Іванівна',
  НО: 'Овчар Наталія Богданівна',
  НП: 'Протас Наталія Володимирівна',
  НР: 'Романишин Наталія Йосипівна',
  НС: 'Сологуб Наталія Миколаївна',
  НФ: 'Федорак Неля Ігорівна',
  ОД: 'Дрогомирецька Оксана Василівна',
  ОП: 'Побідинська Оксана Богданівна',
  ОШ: 'Шевчук Олена Вікторівна',
  СВ: 'Володіна Світлана Павлівна',
  СВС: 'Савчук Світлана Василівна',
  СК: 'Король Світлана Іванівна',
  ТО: 'Остапенко Тетяна Миколаївна',
  ХБ: 'Братина Христина Степанівна',

  // ── Один код — двоє людей ──────────────────────────────────────────
  // Розводяться предметом: у школі кожен із них веде своє.
  НГ: [
    { who: 'Гащак Наталія Василівна', when: [{ s: ['ам'] }] },
    { who: 'Горічко Надія Іванівна', when: [{ s: ['фк'] }] },
  ],
  СМ: [
    { who: 'Матійчук Світлана Степанівна', when: [{ s: ['М'] }] },
    { who: 'Микитин Світлана Степанівна', when: [{ s: ['фк'] }] },
  ],
  ОК: [
    { who: 'Кравчишин Ольга Петрівна', when: [{ s: ['ам'] }] },
    { who: 'Козак Ольга Ігорівна', when: [{ s: ['ум'] }] },
  ],
  ОБ: [
    { who: 'Борковська Олена Вадимівна', when: [{ s: ['ам'] }] },
    { who: 'Боцюрко Оксана Мирославівна', when: [{ s: ['ум', 'ул'] }] },
  ],
  ГП: [
    { who: 'Пташник Галина Василівна', when: [{ s: ['ам'] }] },
    { who: 'Перцович Галина Ігорівна', when: [{ s: ['ум', 'ул'] }] },
  ],
  // Тут предмета мало: «Навчаємось разом» і технології обидві ведуть
  // у власному класі — Чорній у 7-В, Човган у 9-А, де вони класні керівниці.
  ЛЧ: [
    {
      who: 'Чорній Леся Юліянівна',
      when: [{ s: ['мм', 'хе'] }, { s: ['нр', 'т'], in: ['7в'] }],
    },
    {
      who: 'Човган Лариса Михайлівна',
      when: [{ s: ['іст'] }, { s: ['нр', 'т'], in: ['9а'] }],
    },
  ],
}

/**
 * Коди, під якими не змогли впізнати людину. Показуємо їх так, як на папері.
 *
 * ОГ — фізкультура в 5-Б, 5-В і 9-Б, 9 уроків. Серед учителів фізкультури
 *      на сайті ліцею (Фурик, Микитин, Рабуцький, Горічко) такого коду
 *      немає, а всі О.Г. зі списку ведуть інше: Олена Горбата — англійську.
 *      Лишається Ольга Галюк із журналу, але підтвердження цьому немає.
 */
const UNDECODED = { ОГ: 'фізична культура' }

/* ── Читання ──────────────────────────────────────────────────────────── */

const squeeze = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
const fullName = (t) => `${t.last} ${t.first} ${t.patronymic}`.trim()

async function readTeachers() {
  const raw = await readFile(SRC, 'utf8')
  // Файл із журналу інколи приїжджає з приміткою перед самим JSON.
  const body = raw.slice(raw.indexOf('{'))
  const items = JSON.parse(body).Items
  if (!Array.isArray(items)) throw new Error('У файлі немає масиву Items')

  return items
    .map((t) => ({
      id: t.Id,
      last: squeeze(t.LastName),
      first: squeeze(t.FirstName),
      patronymic: squeeze(t.SecondName),
      phone: squeeze(t.Phone),
      email: squeeze(t.Email),
      fired: Boolean(t.Fired),
    }))
    .filter((t) => t.last && t.first)
}

/** Коди, які справді трапляються в розкладі. */
async function codesInTimetable() {
  const src = await readFile(TIMETABLE, 'utf8')
  return new Set([...src.matchAll(/t: '([^']+)'/g)].map((m) => m[1]))
}

/* ── Зшивання ─────────────────────────────────────────────────────────── */

function findOne(people, name) {
  const hits = people.filter((t) => !t.fired && fullName(t) === name)
  if (hits.length === 1) return hits[0]
  throw new Error(
    hits.length === 0
      ? `У журналі немає працюючого вчителя «${name}»`
      : `«${name}» у журналі ${hits.length} — код доведеться уточнити`,
  )
}

function attachCodes(people) {
  for (const [code, value] of Object.entries(CODES)) {
    for (const entry of Array.isArray(value) ? value : [{ who: value }]) {
      const person = findOne(people, entry.who)
      if (person.code) throw new Error(`${entry.who} уже має код ${person.code}`)
      person.code = code
      person.when = entry.when
    }
  }
}

/* ── Запис ────────────────────────────────────────────────────────────── */

const q = (s) => (s.includes("'") ? `"${s}"` : `'${s}'`)

function serialise(t) {
  const parts = [
    `id: ${t.id}`,
    `code: ${q(t.code)}`,
    `last: ${q(t.last)}`,
    `first: ${q(t.first)}`,
  ]
  if (t.patronymic) parts.push(`patronymic: ${q(t.patronymic)}`)
  if (t.when)
    parts.push(
      `when: ${JSON.stringify(t.when)
        .replace(/"(\w+)":/g, '$1: ')
        .replace(/"/g, "'")
        .replace(/,/g, ', ')}`,
    )
  return `  { ${parts.join(', ')} },`
}

function render(people) {
  const undecoded = Object.entries(UNDECODED)
    .map(([code, subject]) => `  ${code}: '${subject}',`)
    .join('\n')

  return `/**
 * Хто стоїть за кодами вчителів у розкладі.
 *
 * ЗГЕНЕРОВАНО зі шкільного журналу скриптом
 * \`scripts/import-teachers.mjs\`. Розшифровка кодів і розведення тезок
 * живуть у самому скрипті — при повторному імпорті правки тут загубляться.
 *
 * Тут лише прізвища й коди: контакти в цей файл навмисно не потрапляють,
 * бо він їде у публічну збірку. Телефони — у \`contacts.ts\`, якого в git
 * немає (див. README).
 *
 * У списку лише ті, хто справді веде уроки в 4–11 класах.
 */

/** Умова, за якою урок належить саме цій людині (для спільних кодів). */
export type Claim = {
  /** Предмети (ключі \`SUBJECTS\`). Немає — будь-який. */
  s?: string[]
  /** Класи (\`id\` як у \`TIMETABLE\`). Немає — будь-який. */
  in?: string[]
}

export type Teacher = {
  /** Ідентифікатор у шкільному журналі — стабільний ключ. */
  id: number
  /** Код, яким ця людина позначена в розкладі. */
  code: string
  last: string
  first: string
  patronymic?: string
  /**
   * Один код — двоє тезок. Урок належить цій людині, якщо спрацювала
   * хоч одна умова. Немає \`when\` — усі уроки коду її.
   */
  when?: Claim[]
}

export const TEACHERS: Teacher[] = [
${people.map(serialise).join('\n')}
]

/**
 * Коди, під якими людину впізнати не вдалося: показуємо їх так, як на
 * папері. Значення — предмет, який під цим кодом стоїть у розкладі.
 */
export const UNDECODED_CODES: Record<string, string> = {
${undecoded}
}
`
}

function renderContacts(people) {
  const rows = people
    .filter((t) => t.phone)
    .map((t) => `  ${t.id}: '${t.phone}', // ${t.code} · ${t.last} ${t.first}`)
    .join('\n')

  return `/**
 * Робочі телефони вчителів.
 *
 * ЗГЕНЕРОВАНО скриптом \`scripts/import-teachers.mjs\`.
 *
 * ⚠ Цього файлу НЕМАЄ в git і не має бути, поки школа не дозволить
 * публікувати контакти: сайт лежить на GitHub Pages і доступний усім.
 * Застосунок підхоплює файл, лише якщо він є (\`lib/contacts.ts\`), —
 * без нього довідник просто не показує телефонів.
 */

/** Ідентифікатор учителя у журналі → номер у форматі \`380XXXXXXXXX\`. */
export const PHONES: Record<number, string> = {
${rows}
}
`
}

/* ── Поїхали ──────────────────────────────────────────────────────────── */

const people = await readTeachers()
attachCodes(people)

const used = await codesInTimetable()
const known = new Set([...Object.keys(CODES), ...Object.keys(UNDECODED)])
const missing = [...used].filter((c) => !known.has(c))
const extra = [...known].filter((c) => !used.has(c))

// У застосунок їдуть лише ті, хто стоїть у розкладі: решту показувати
// нема де, а зайвих персональних даних у збірці бути не повинно.
const inTimetable = people
  .filter((t) => t.code && used.has(t.code))
  .sort((a, b) => a.last.localeCompare(b.last, 'uk') || a.first.localeCompare(b.first, 'uk'))

await writeFile(OUT, render(inTimetable), 'utf8')
await writeFile(CONTACTS, renderContacts(inTimetable), 'utf8')

console.log(`У журналі: ${people.length}, працюють: ${people.filter((t) => !t.fired).length}`)
console.log(`У розкладі: ${inTimetable.length} осіб під ${used.size - missing.length} кодами`)
console.log(`Телефонів: ${inTimetable.filter((t) => t.phone).length}`)
if (missing.length) console.warn(`⚠ Коди без розшифровки: ${missing.join(', ')}`)
if (extra.length) console.warn(`⚠ Коди, яких немає в розкладі: ${extra.join(', ')}`)
console.log(`→ ${OUT}`)
console.log(`→ ${CONTACTS} (у git не потрапляє)`)
