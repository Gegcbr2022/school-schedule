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
 * Папка з файлами передається аргументом. Її вміст лягає у бакет під
 * префіксом `<номер класу>/…` — тобто `.../9/bio-1.pdf` → `9/bio-1.pdf`.
 * Клас береться з імені папки.
 *
 * Потрібен один пакет: npm i -D @aws-sdk/client-s3
 */

import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

const BUCKET = 'books'

const dir = process.argv[2]
if (!dir) {
  console.error('Вкажіть папку з файлами: node scripts/upload-books.mjs <папка>')
  process.exit(1)
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

const prefix = basename(dir) // «9» → усе лягає під 9/
const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.pdf'))
if (files.length === 0) {
  console.error('У папці немає PDF.')
  process.exit(1)
}

console.log(`Завантажую ${files.length} файлів у ${BUCKET}/${prefix}/ …\n`)

let done = 0
for (const file of files) {
  const key = `${prefix}/${file}`
  const body = await readFile(join(dir, file))
  process.stdout.write(`  ${key.padEnd(30)} ${(body.length / 1048576).toFixed(1)} MB … `)
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
