/**
 * Малює іконки застосунку з одного опису й розкладає їх у public/icons.
 *
 * Іконки вже лежать у репозиторії — запускати треба лише тоді,
 * коли міняється сам малюнок:
 *
 *   npm i -D sharp && node scripts/generate-icons.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const BG = '#3b5bdb'
const FG = '#ffffff'
const FONT = 'Segoe UI, Roboto, DejaVu Sans, Arial, sans-serif'

/**
 * @param {object} options
 * @param {number} options.radius   Радіус кутів у частках сторони (0 — квадрат).
 * @param {number} options.scale    Розмір напису відносно сторони.
 */
function icon({ radius = 0, scale = 1 } = {}) {
  const S = 512
  const r = radius * S
  const fontSize = 186 * scale
  const ruleWidth = 156 * scale
  const ruleY = 340 * scale + (S / 2) * (1 - scale)
  const textY = 228 * scale + (S / 2) * (1 - scale)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" rx="${r}" ry="${r}" fill="${BG}"/>
  <text x="${S / 2}" y="${textY}" fill="${FG}" text-anchor="middle" dominant-baseline="central"
        font-family="${FONT}" font-size="${fontSize}" font-weight="700"
        letter-spacing="${-4 * scale}">10Б</text>
  <rect x="${(S - ruleWidth) / 2}" y="${ruleY}" width="${ruleWidth}" height="${14 * scale}"
        rx="${7 * scale}" fill="${FG}" opacity="0.55"/>
</svg>`
}

/** Кругла іконка з полями — Android сам обріже її під форму системи. */
const ROUNDED = icon({ radius: 0.22 })
const SQUARE = icon({ radius: 0 })
const MASKABLE = icon({ radius: 0, scale: 0.62 })

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer()

await mkdir(OUT, { recursive: true })

await Promise.all([
  writeFile(join(OUT, 'favicon.svg'), ROUNDED),
  png(ROUNDED, 192).then((b) => writeFile(join(OUT, 'icon-192.png'), b)),
  png(ROUNDED, 512).then((b) => writeFile(join(OUT, 'icon-512.png'), b)),
  png(MASKABLE, 512).then((b) => writeFile(join(OUT, 'icon-maskable-512.png'), b)),
  // iOS не любить прозорі кути — для нього окремий суцільний квадрат.
  png(SQUARE, 180).then((b) => writeFile(join(OUT, 'apple-touch-icon.png'), b)),
])

console.log('Іконки готові:', OUT)
