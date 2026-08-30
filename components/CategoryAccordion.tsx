'use client'
import { useState } from 'react'

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

type Product = { name: string; units: number; revenue: number; orders: number; pct: number }
type Category = { name: string; color: string; revenue: number; orders: number; units: number; pct: number; products: Product[] }

function shortName(s: string, max = 36) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export function CategoryAccordion({
  categories, totalRevenue, onSelectProduct, selectedProduct,
}: {
  categories: Category[]
  totalRevenue: number
  onSelectProduct: (name: string | null) => void
  selectedProduct: string | null
}) {
  const [open, setOpen] = useState<string | null>(categories[0]?.name ?? null)

  if (!categories.length) return (
    <div className="flex items-center justify-center py-10 text-[var(--pnl-text-3)] text-xs">Sin datos para el período</div>
  )

  return (
    <div className="space-y-2">
      {categories.map(cat => {
        const isOpen = open === cat.name
        return (
          <div key={cat.name}
            className="rounded-xl border border-[var(--pnl-hair)] overflow-hidden transition-all">

            {/* ── Cabecera de categoría ── */}
            <button
              onClick={() => setOpen(isOpen ? null : cat.name)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--pnl-panel-2)] transition-colors"
            >
              {/* Color dot */}
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />

              {/* Nombre */}
              <span className="text-sm font-semibold text-[var(--pnl-text)] flex-1 text-left">{cat.name}</span>

              {/* Stats */}
              <div className="flex items-center gap-4 flex-shrink-0">
                <span className="text-[10px] text-[var(--pnl-text-3)] hidden sm:block">{cat.orders} órd. · {cat.units} uds.</span>
                <span className="text-xs font-mono font-bold text-[var(--pnl-text)]">{ARS(cat.revenue)}</span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md"
                  style={{ background: `${cat.color}22`, color: cat.color }}>
                  {cat.pct}%
                </span>
                <span className={`text-[var(--pnl-text-3)] text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </div>
            </button>

            {/* Barra de progreso */}
            <div className="h-px mx-4 bg-[var(--pnl-track)] overflow-hidden">
              <div className="h-full transition-all duration-500"
                style={{ width: `${cat.pct}%`, background: cat.color, opacity: 0.5 }} />
            </div>

            {/* ── Productos desplegables ── */}
            {isOpen && (
              <div className="px-4 pb-3 pt-2 space-y-1 bg-[var(--pnl-page)]">
                {cat.products.map(prod => {
                  const isSelected = selectedProduct === prod.name
                  return (
                    <button
                      key={prod.name}
                      onClick={() => onSelectProduct(isSelected ? null : prod.name)}
                      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-all border ${
                        isSelected
                          ? 'border-[var(--pnl-amber)] bg-[color-mix(in_srgb,var(--pnl-amber)_12%,transparent)]'
                          : 'border-transparent hover:bg-[var(--pnl-panel-2)] hover:border-[var(--pnl-hair)]'
                      }`}
                    >
                      {/* Barra mini de revenue */}
                      <div className="w-16 h-1 rounded-full bg-[var(--pnl-track)] flex-shrink-0 overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{
                            width: `${totalRevenue > 0 ? (prod.revenue / totalRevenue) * 100 * 5 : 0}%`,
                            maxWidth: '100%',
                            background: cat.color,
                            opacity: 0.6,
                          }} />
                      </div>

                      <span className="flex-1 text-[11px] text-[var(--pnl-text)] truncate">{shortName(prod.name)}</span>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[10px] text-[var(--pnl-text-3)]">{prod.units} uds.</span>
                        <span className="text-[11px] font-mono text-[var(--pnl-text)]">{ARS(prod.revenue)}</span>
                        <span className="text-[10px] font-mono text-[var(--pnl-text-3)]">{prod.pct}%</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Total ── */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)]">
        <span className="text-[11px] text-[var(--pnl-text-3)]">Total período</span>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-[var(--pnl-text-3)]">
            {categories.reduce((s, c) => s + c.orders, 0)} órdenes
          </span>
          <span className="text-sm font-mono font-bold text-[var(--pnl-amber)]">{ARS(totalRevenue)}</span>
        </div>
      </div>
    </div>
  )
}
