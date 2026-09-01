import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
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

// Service worker живе поруч із застосунком, тому й шлях беремо з BASE_URL —
// так воно працює і на GitHub Pages у підпапці, і локально в корені.
if (import.meta.env.PROD) {
  window.addEventListener('load', () => watchForUpdates(`${import.meta.env.BASE_URL}sw.js`))
}
