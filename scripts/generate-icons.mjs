/**
 * Малює іконки застосунку з одного знака й розкладає їх по місцях.
 *
 * Іконки вже лежать у репозиторії — запускати треба лише тоді,
 * коли міняється сам малюнок:
 *
 *   npm i -D sharp && npm run icons
 *
 * Сам знак — у `brand/mark.mjs`, там же й пояснення до геометрії.
 * Сюди складено тільки те, кому який файл потрібен.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { BRAND, icon, safeRadius } from '../brand/mark.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ICONS = join(ROOT, 'public', 'icons')
const BRANDDIR = join(ROOT, 'brand')
/** Іконка для Xcode. Її кладемо просто у теку застосунку — решту зробить Xcode. */
const IOS = join(ROOT, 'ios', 'App', 'Assets.xcassets', 'AppIcon.appiconset')

/** Заокруглена — для вкладки браузера й звичайної установки. */
const ROUNDED = icon({ radius: 0.22 })
/** Квадратна: iOS не любить прозорих кутів і заокруглює сама. */
const SQUARE = icon({ radius: 0 })
/** Android сам обтинає під форму системи — лишаємо йому поля. */
const MASKABLE = icon({ radius: 0, scale: 0.68 })
/** Знак без підкладки — для документів, презентацій і темного тла. */
const GLYPH_BRAND = icon({ bg: 'none', fg: BRAND })
const GLYPH_LIGHT = icon({ bg: 'none', fg: '#ffffff' })

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer()

const SAFE = 204.5
const reach = safeRadius()
if (reach > SAFE) {
  throw new Error(
    `Знак виходить за безпечну зону maskable-іконки: ${reach.toFixed(1)} > ${SAFE}. ` +
      'Поправте геометрію в brand/mark.mjs.',
  )
}

await mkdir(ICONS, { recursive: true })
await mkdir(BRANDDIR, { recursive: true })
await mkdir(IOS, { recursive: true })

await Promise.all([
  writeFile(join(ICONS, 'favicon.svg'), ROUNDED),
  png(ROUNDED, 192).then((b) => writeFile(join(ICONS, 'icon-192.png'), b)),
  png(ROUNDED, 512).then((b) => writeFile(join(ICONS, 'icon-512.png'), b)),
  png(MASKABLE, 512).then((b) => writeFile(join(ICONS, 'icon-maskable-512.png'), b)),
  png(SQUARE, 180).then((b) => writeFile(join(ICONS, 'apple-touch-icon.png'), b)),

  // App Store приймає один файл 1024×1024 без прозорості — решту розмірів
  // Xcode зробить сам із цього ж зображення.
  png(SQUARE, 1024).then((b) => writeFile(join(IOS, 'icon-1024.png'), b)),

  writeFile(join(BRANDDIR, 'mark.svg'), SQUARE),
  writeFile(join(BRANDDIR, 'mark-on-light.svg'), GLYPH_BRAND),
  writeFile(join(BRANDDIR, 'mark-on-dark.svg'), GLYPH_LIGHT),
])

console.log(`Готово. Запас до краю безпечної зони: ${(SAFE - reach).toFixed(1)} px.`)
