import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Зламаний код не має доїхати до GitHub Pages — і не має тихо потрапити в
 * main. Перше тримає `deploy.yml`, друге — `ci.yml` на pull request. Обидва
 * — звичайні текстові файли, які легко «спростити», викинувши крок, і
 * нічого не помітити, поки на Pages не поїде зламане. Тут перевіряється
 * саме це: що кроки є і що вони стоять перед збіркою.
 */

const CHECKS = ['npx tsc -b', 'npm run lint', 'npm test']
const BUILD = 'npm run build'

/** Текст workflow без рядків-коментарів: у коментарі команда нічого не запускає. */
function workflow(name) {
  const text = readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8')
  return text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n')
}

/** Де в тексті стоїть команда; -1, якщо її немає. */
function position(text, command) {
  return text.search(new RegExp(`^[ \\t]*(- run: |run: )?${command.replace(/ /g, '[ \\t]+')}[ \\t]*$`, 'm'))
}

describe('deploy.yml', () => {
  it('перевіряє типи, лінт і тести до збірки', () => {
    const text = workflow('deploy.yml')
    const build = position(text, BUILD)
    expect(build).toBeGreaterThan(-1)
    for (const command of CHECKS) {
      const at = position(text, command)
      expect(at, command).toBeGreaterThan(-1)
      expect(at, command).toBeLessThan(build)
    }
  })
})

describe('ci.yml', () => {
  it('запускається на pull request', () => {
    expect(workflow('ci.yml')).toMatch(/^on:\s*\n(?:[ \t]+.*\n)*?[ \t]+pull_request:/m)
  })

  it('робить ті самі перевірки, що й деплой, і так само збирає', () => {
    const text = workflow('ci.yml')
    const build = position(text, BUILD)
    expect(build).toBeGreaterThan(-1)
    for (const command of CHECKS) {
      const at = position(text, command)
      expect(at, command).toBeGreaterThan(-1)
      expect(at, command).toBeLessThan(build)
    }
  })

  it('нічого не публікує', () => {
    // Pull request може прийти з будь-якої гілки — і з чужого форку.
    const text = workflow('ci.yml')
    expect(text).not.toMatch(/deploy-pages|upload-pages-artifact/)
    expect(text).not.toMatch(/^\s*(pages|id-token):\s*write/m)
  })
})
