/**
 * Збирає дані школи в один файл, який лягає поруч із застосунком:
 *
 *   npm run pack        → public/data/school.json
 *
 * Звідки береться: з тих самих модулів `src/data/seed/`, які йдуть у
 * збірку. Тобто пак і «насіння» не можуть розійтись — це буквально один
 * і той самий зміст, просто в JSON.
 *
 * Навіщо: замінивши цей файл на сервері, ви міняєте розклад усім — і на
 * сайті, і в застосунку на телефоні, — не збираючи й не перевикладаючи
 * нічого. Саме так розклад доїжджає до iOS, минаючи перевірку Apple.
 *
 * Модулі читаються самим Vite (`ssrLoadModule`), щоб не тягнути окремий
 * компілятор TypeScript заради шести файлів з даними.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'data', 'school.json')

/**
 * Версія даних. Рівно та сама позначка, що лежить у `seed/config.ts`, —
 * інакше застосунок вирішив би, що щойно зібраний пак старіший за той,
 * який у нього вже є, і проігнорував би його.
 */
const server = await createServer({
  configFile: false,
  root: ROOT,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const { SEED_PACK } = await server.ssrLoadModule('/src/data/pack.ts')

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(SEED_PACK))

  const bytes = Buffer.byteLength(JSON.stringify(SEED_PACK))
  console.log(
    `public/data/school.json — ${(bytes / 1024).toFixed(1)} КБ, ` +
      `версія ${SEED_PACK.version}, класів ${SEED_PACK.timetable.length}, ` +
      `вчителів ${SEED_PACK.teachers.length}.`,
  )
} finally {
  await server.close()
}
