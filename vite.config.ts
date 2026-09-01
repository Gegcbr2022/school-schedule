import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'

/**
 * Проставляє у service worker відбиток збірки.
 *
 * `public/sw.js` копіюється як є, тож між випусками він не змінювався —
 * а браузер оновлює service worker лише тоді, коли сам файл інакший.
 * Через це встановлений застосунок не помічав нових версій. Відбиток
 * беремо з index.html: у ньому імена зібраних файлів із хешами, тож він
 * інакший рівно тоді, коли застосунок справді змінився.
 */
function stampServiceWorker(): Plugin {
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    // Файли з public/ копіюються після збірки — правимо вже на диску.
    closeBundle() {
      const dir = 'dist'
      const html = readFileSync(join(dir, 'index.html'), 'utf8')
      const build = createHash('sha256').update(html).digest('hex').slice(0, 12)
      const sw = join(dir, 'sw.js')
      writeFileSync(sw, readFileSync(sw, 'utf8').replace("const BUILD = 'dev'", `const BUILD = '${build}'`))
    },
  }
}

/**
 * GitHub Pages віддає проєкт із підпапки з назвою репозиторію,
 * тому всі шляхи мають бути з префіксом. Для власного домену
 * достатньо зібрати з BASE_PATH=/ і нічого тут не міняти.
 */
export default defineConfig({
  base: process.env.BASE_PATH ?? '/school-schedule/',
  plugins: [react(), stampServiceWorker()],
  build: {
    target: 'es2022',
  },
})
