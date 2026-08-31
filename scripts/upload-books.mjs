/**
 * Завантажує підручники у бакет R2 «books».
 *
 * Токен НЕ вшитий у код — береться зі змінних середовища, тож у git
 * нічого секретного не потрапляє.
 *
 *   Windows PowerShell:
 *     $env:R2_ACCESS_KEY_ID="..."
 *     $env:R2_SECRET_ACCESS_KEY="..."
 *     $env:R2_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com"
 *     node scripts/upload-books.mjs "C:\шлях\до\папки\9"
 *
 *   Git Bash / macOS / Linux:
 *     export R2_ACCESS_KEY_ID=...
 *     export R2_SECRET_ACCESS_KEY=...
 *     export R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
 *     node scripts/upload-books.mjs ~/шлях/до/папки/9
 *
 * Папка передається аргументом; скрипт обходить її рекурсивно, а ключ
 * у сховищі = шлях відносно неї. Тож можна вказати як одну паралель
 * (`.../9`, де лежать bio-1.pdf → ключ `9/bio-1.pdf` при вказівці на
 * батьківську), так і батьківську папку з підпапками 5/ 6/ 7/ 8/ —
 * тоді всі паралелі заллються за одну команду з ключами `5/um-1.pdf` тощо.
 *
 * Потрібен один пакет: npm i -D @aws-sdk/client-s3
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

const BUCKET = 'books'

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
