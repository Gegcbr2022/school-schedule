/**
 * Знак «Дзвінки» — одне джерело для всіх іконок.
 *
 * Дзвін, складений із тих самих примітивів, з яких зроблено сам
 * застосунок: дуга зворотного відліку, смужка прогресу й точка «зараз».
 * Тому це не чергова іконка сповіщень, а знак саме цього продукту.
 *
 * Три фігури й жодного тексту: так він читається і в 16 пікселів у
 * вкладці, і в 1024 в App Store, і однією фарбою на ксероксі.
 *
 * ГЕОМЕТРІЯ ПЕРЕВІРЕНА під maskable-іконку Android: усе лежить у колі
 * радіуса 204.5 від центру полотна 512×512, тож жодна система обтинання
 * нічого не зріже. Міняючи числа, перевірте це заново — `npm run icons`
 * друкує відступи.
 */

export const CANVAS = 512

/** Фірмовий синій — той самий `--accent`, що й у застосунку. */
export const BRAND = '#3b5bdb'

const rad = (deg) => (deg * Math.PI) / 180

/** Параметри знака. Підібрані на око по контактному аркушу — не «рівні» навмисно. */
const G = {
  /** Купол: радіус серединної лінії дуги, товщина, центр, розхил у градусах. */
  domeR: 128,
  stroke: 52,
  domeCy: 251,
  sweep: 196,
  /** Край дзвона. */
  rimW: 320,
  rimH: 42,
  /** Просвіт між куполом і краєм — через нього знак читається як складений. */
  gap: 14,
  /** Язик. */
  dot: 34,
  dotGap: 14,
}

/**
 * Сам знак у координатах 512×512, без підкладки.
 * @param {string} fill Колір фігур.
 */
export function markShapes(fill = '#ffffff') {
  const cx = CANVAS / 2
  const half = G.sweep / 2
  const point = (deg) => [
    cx + G.domeR * Math.cos(rad(deg)),
    G.domeCy - G.domeR * Math.sin(rad(deg)),
  ]
  const [x1, y1] = point(90 + half)
  const [x2, y2] = point(90 - half)
  const largeArc = G.sweep > 180 ? 1 : 0

  const rimY = G.domeCy + G.gap + G.stroke / 2
  const dotCy = rimY + G.rimH + G.dotGap + G.dot

  return [
    `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${G.domeR} ${G.domeR} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${fill}" stroke-width="${G.stroke}"/>`,
    `<rect x="${cx - G.rimW / 2}" y="${rimY}" width="${G.rimW}" height="${G.rimH}" rx="${G.rimH / 2}" fill="${fill}"/>`,
    `<circle cx="${cx}" cy="${dotCy}" r="${G.dot}" fill="${fill}"/>`,
  ].join('')
}

/**
 * Найдальша точка знака від центру полотна. Має лишатися меншою за
 * 204.5 — радіус безпечної зони maskable-іконки.
 */
export function safeRadius() {
  const cx = CANVAS / 2
  const rimY = G.domeCy + G.gap + G.stroke / 2
  const half = G.stroke / 2
  const corners = [
    // кінці краю дзвона — найдальші кути прямокутника
    [cx - G.rimW / 2, rimY + G.rimH],
    [cx + G.rimW / 2, rimY + G.rimH],
    // маківка купола й найширші його точки з урахуванням товщини
    [cx, G.domeCy - G.domeR - half],
    [cx - G.domeR - half, G.domeCy],
    [cx + G.domeR + half, G.domeCy],
    // низ язика
    [cx, rimY + G.rimH + G.dotGap + 2 * G.dot],
  ]
  return Math.max(...corners.map(([x, y]) => Math.hypot(x - cx, y - cx)))
}

/**
 * Готова іконка.
 * @param {object} o
 * @param {string} o.bg      Колір підкладки; `none` — прозоро.
 * @param {string} o.fg      Колір знака.
 * @param {number} o.radius  Радіус кутів у частках сторони.
 * @param {number} o.scale   Масштаб знака (для maskable лишаємо поля).
 */
export function icon({ bg = BRAND, fg = '#ffffff', radius = 0.22, scale = 1 } = {}) {
  const S = CANVAS
  const plate = bg === 'none' ? '' : `<rect width="${S}" height="${S}" rx="${radius * S}" fill="${bg}"/>`
  const shapes = markShapes(fg)
  const inner =
    scale === 1
      ? shapes
      : `<g transform="translate(${(S * (1 - scale)) / 2} ${(S * (1 - scale)) / 2}) scale(${scale})">${shapes}</g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${plate}${inner}</svg>`
}
