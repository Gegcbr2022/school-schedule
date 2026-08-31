/**
 * Завантажує підручники у бакет R2 «books».
 *
 * Доступи НЕ вшиті в код. Створіть у корені проєкту файл `.r2.env`
 * (він у .gitignore, у git не потрапляє) з трьома рядками:
 *
 *     R2_ACCESS_KEY_ID=cb21141102d46f958348dcc3fe64111d
 *     R2_SECRET_ACCESS_KEY=ваш-секрет
 *     R2_ENDPOINT=https://8a6cf70d39abdc687584d559539ad436.r2.cloudflarestorage.com
 *
 * Далі просто:
 *     npm i -D @aws-sdk/client-s3
 *     node scripts/upload-books.mjs "C:\шлях\до\папки"
 *
 * (Можна й через змінні середовища напряму — вони мають пріоритет над файлом.)
 *
 * Папка передається аргументом; скрипт обходить її рекурсивно, а ключ
 * у сховищі = шлях відносно неї. Тож батьківська папка з підпапками
 * 5/ 6/ 7/ 8/ заллється за одну команду з ключами `5/um-1.pdf` тощо.
 */

import { readdir, readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const BUCKET = 'books'

// Підхоплюємо .r2.env з кореня проєкту (не перекриваючи вже задані змінні).
try {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.r2.env')
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && !line.trimStart().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
} catch {
  /* файла немає — покладаємось на змінні середовища */
}

const dir = process.argv[2]
if (!dir) {
  console.error('Вкажіть папку з файлами: node scripts/upload-books.mjs <папка>')
  process.exit(1)
}

/** Усі PDF у папці, рекурсивно, з ключем = відносний шлях (з прямими /). */
async function collect(root) {
  const out = []
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.name.toLowerCase().endsWith('.pdf')) {
        out.push({ full, key: relative(root, full).split(sep).join('/') })
      }
    }
  }
  await walk(root)
  return out
}

const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT } = process.env
if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
  console.error(
    'Немає доступів. Задайте R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY і R2_ENDPOINT\n' +
      '(див. коментар на початку файла).',
  )
  process.exit(1)
}

let S3Client, PutObjectCommand
try {
  ;({ S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3'))
} catch {
  console.error('Спершу встановіть пакет:\n  npm i -D @aws-sdk/client-s3')
  process.exit(1)
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

const files = await collect(dir)
if (files.length === 0) {
  console.error('У папці немає PDF.')
  process.exit(1)
}

console.log(`Завантажую ${files.length} файлів у бакет «${BUCKET}» …\n`)

let done = 0
for (const { full, key } of files) {
  const body = await readFile(full)
  process.stdout.write(`  ${key.padEnd(24)} ${(body.length / 1048576).toFixed(1)} MB … `)
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: 'application/pdf',
        // Читалка тягне файл щоразу з мережі, поки його не збережуть —
        // тож даємо браузеру кешувати надовго, щоб не качав двічі.
        CacheControl: 'public, max-age=604800',
      }),
    )
    console.log('готово')
    done += 1
  } catch (e) {
    console.log('ПОМИЛКА:', e.message)
  }
}

console.log(`\n${done} з ${files.length} завантажено.`)
if (done < files.length) process.exit(1)
