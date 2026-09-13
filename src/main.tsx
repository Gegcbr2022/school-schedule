import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { packBooted } from './data/pack'
import { installHaptics } from './lib/haptics'
import { isNative } from './lib/native'
import { watchForFreshPack } from './lib/packUpdate'
import { watchForUpdates } from './lib/update'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Немає #root у документі')

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// Дійшли сюди — отже, з нинішнім паком застосунок запускається. Знімаємо
// позначку, інакше наступного разу пак буде відкинуто як підозрілий.
packBooted()

// Відгук на дотик — там, де він є. У браузері це порожня операція.
installHaptics()

// Service worker живе поруч із застосунком, тому й шлях беремо з BASE_URL —
// так воно працює і на GitHub Pages у підпапці, і локально в корені.
//
// У рідній оболонці його немає сенсу: файли й так лежать у пакеті, а нову
// версію застосунку приносить App Store. Розклад при цьому все одно
// оновлюється сам — паком, незалежно від версії застосунку.
if (import.meta.env.PROD && !isNative()) {
  window.addEventListener('load', () => watchForUpdates(`${import.meta.env.BASE_URL}sw.js`))
}

// А розклад оновлюється скрізь — і на сайті, і в застосунку.
if (import.meta.env.PROD) {
  window.addEventListener('load', watchForFreshPack)
}
