'use client'
import { Component, type ReactNode } from 'react'

/**
 * Recharts puede tirar un TypeError interno (visto con arrays de datos vacíos o en cero,
 * combinado con un contenedor todavía sin medir) que un try/catch normal no atrapa porque
 * ocurre dentro del ciclo de commit de React. Sin este límite, ese error tira abajo toda la
 * página del dashboard en vez de solo el gráfico que falló.
 */
type Props = { children: ReactNode; height?: number | string }
type State = { crashed: boolean }

export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[chart]', error)
  }

  render() {
    if (this.state.crashed) {
      return (
        <div
          className="flex items-center justify-center text-[var(--pnl-text-3)] text-xs"
          style={{ height: this.props.height ?? 180 }}
        >
          No se pudo dibujar este gráfico
        </div>
      )
    }
    return this.props.children
  }
}
