import { Component } from 'react'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Що показати замість вмісту. `reset` пробує відмалювати його наново. */
  fallback?: (reset: () => void) => ReactNode
}

type State = { failed: boolean }

/**
 * Ловить помилки, щоб застосунок не перетворювався на білий екран.
 *
 * Для встановленого застосунку це важливо окремо: адресного рядка немає,
 * перезавантажити сторінку звичним способом не вийде, і людина лишається
 * сам на сам із порожнім екраном.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Помилка в застосунку:', error)
  }

  reset = () => this.setState({ failed: false })

  render() {
    if (!this.state.failed) return this.props.children
    if (this.props.fallback) return this.props.fallback(this.reset)

    return (
      <div className="crash">
        <h2 className="crash__title">Щось пішло не так</h2>
        <p className="crash__text">
          Розклад не зміг відмалюватися. Спробуйте ще раз — дані нікуди не зникли.
        </p>
        <div className="crash__actions">
          <button type="button" className="btn" onClick={this.reset}>
            Спробувати ще раз
          </button>
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => window.location.reload()}
          >
            Перезавантажити
          </button>
        </div>
      </div>
    )
  }
}
