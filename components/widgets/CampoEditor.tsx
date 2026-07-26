'use client'

import {
  PALETA,
  UBICACIONES_TEXTO,
  UBICACIONES_FICHA,
  DESTINOS,
  EMOJIS,
  PROPORCIONES,
  type Campo,
} from '@/lib/widgets/tipos'
import { SubirMedia } from './SubirMedia'
import { OpcionVisual, tieneDibujo } from './OpcionVisual'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react'

// Formulario genérico: dibuja UN campo a partir de su declaración en lib/widgets/tipos.ts.
// Ningún tipo de widget tiene formulario propio. Agregar un tipo nuevo no toca este archivo
// mientras use los tipos de campo ya soportados — que es justo el punto del diseño.
//
// Construido sobre shadcn/ui (base-ui): Input, Textarea, Select, Switch, Button, Label. El
// color primario de shadcn está teñido de salvia en app/globals.css, así que el foco y los
// controles salen con la identidad de marca sin estilar cada uno a mano.

export type Producto = { id: string; nombre: string; precio: number; imagen: string | null }

type Props = {
  campo: Campo
  valor: unknown
  /** Catálogo real de Tiendanube, para los campos de tipo producto. */
  productos?: Producto[]
  /** Config completa del widget: algún campo necesita mirar a otro (la medida sugerida
   *  del archivo depende de la proporción elegida). */
  config?: Record<string, unknown>
  /** Dónde vive el widget ('producto' | 'tienda' | 'guias'). El campo de ubicación ofrece
   *  las ranuras de la ficha de producto o las del texto según esto. */
  contexto?: string
  onChange: (v: unknown) => void
}

// Traducción de las ubicaciones viejas (genéricas) a la ranura concreta de la ficha. Es la
// misma tabla que aplica public/mic.js al dibujar: si se separan, el panel miente.
const HEREDADAS: Record<string, string> = {
  inicio: 'prod_titulo',
  tras_intro: 'prod_precio',
  medio: 'prod_form_arriba',
  antes_final: 'prod_boton',
  final: 'prod_final',
}

// Texto de ayuda debajo del campo, siempre en renglón aparte: es la diferencia entre poder
// configurar un widget sin preguntarle a nadie y tener que adivinar qué hace cada casilla.
const AYUDA = 'mt-1.5 text-[13px] leading-relaxed text-muted-foreground'
const AVISO = 'text-xs leading-relaxed text-amber-400'
const ETIQUETA = 'mb-1.5 text-[13px] font-medium text-foreground'

// base-ui Select trata el string vacío como "sin selección". Varios campos usan '' como un
// valor real ("Sin enlace"), así que se mapea a un centinela solo mientras vive en el Select.
const NADA = '__nada__'

function SelectCampo({
  value,
  onChange,
  opciones,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  opciones: readonly { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <Select value={value === '' ? NADA : value} onValueChange={v => onChange(v === NADA ? '' : String(v))}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opciones.map(o => (
          <SelectItem key={o.value} value={o.value === '' ? NADA : o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function CampoEditor({ campo, valor, productos = [], config, contexto, onChange }: Props) {
  const ayuda = campo.ayuda ? <p className={AYUDA}>{campo.ayuda}</p> : null

  // ── Booleano: switch de shadcn ────────────────────────────────────────────
  if (campo.tipo === 'booleano') {
    const prendido = valor === true
    return (
      <div className="py-1">
        <div className="flex items-center gap-3">
          <Switch checked={prendido} onCheckedChange={v => onChange(v === true)} />
          <Label className="cursor-pointer text-sm text-foreground" onClick={() => onChange(!prendido)}>
            {campo.label}
          </Label>
        </div>
        {campo.ayuda && <p className={`ml-[44px] ${AYUDA}`}>{campo.ayuda}</p>}
      </div>
    )
  }

  const etiqueta = <Label className={ETIQUETA}>{campo.label}</Label>

  // ── Ubicación: se elige mirando un dibujo de la página, no escribiendo HTML ─
  //
  // En la ficha de producto se dibuja la columna de compra completa —título, precio,
  // cuotas, formulario, descripción— y se elige la RANURA entre dos bloques. Es la única
  // forma de que lo elegido y lo que pasa en el sitio sean lo mismo: pedir "en el medio"
  // en una ficha no significa nada, y por eso antes todo terminaba al fondo.
  if (campo.tipo === 'ubicacion') {
    const ficha = contexto === 'producto'
    const lista = ficha ? UBICACIONES_FICHA : UBICACIONES_TEXTO
    const crudo = String(valor ?? campo.porDefecto ?? 'final')
    // Un widget de ficha guardado con la lista vieja: se muestra la ranura equivalente, la
    // misma a la que lo manda mic.js. Si no, el panel mostraría un lugar y el sitio otro.
    const actual = ficha ? (HEREDADAS[crudo] ?? crudo) : crudo
    const elegida = lista.find(u => u.value === actual) ?? lista[lista.length - 1]

    if (ficha) {
      return (
        <div>
          {etiqueta}
          <div className="overflow-hidden rounded-xl border border-border bg-card p-3">
            {UBICACIONES_FICHA.map(u => (
              <div key={u.value}>
                {u.bloque && (
                  <div className="rounded-md bg-muted px-2.5 py-1.5 text-[12px] text-muted-foreground">
                    {u.bloque}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onChange(u.value)}
                  className={cn(
                    'my-1 flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-[12px] transition-all',
                    u.value === actual
                      ? 'border-primary/55 bg-primary/10 text-foreground ring-2 ring-primary/15'
                      : 'border-dashed border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      u.value === actual ? 'bg-primary' : 'bg-border',
                    )}
                  />
                  {u.label}
                </button>
              </div>
            ))}
          </div>
          <p className={AYUDA}>{elegida.ayuda}</p>
          {ayuda}
        </div>
      )
    }

    const filas = UBICACIONES_TEXTO.map(u => u.value) as string[]
    return (
      <div>
        {etiqueta}
        <div className="flex flex-wrap gap-2">
          {UBICACIONES_TEXTO.map(u => {
            const activo = u.value === actual
            const posicion = filas.indexOf(u.value)
            return (
              <button
                key={u.value}
                type="button"
                onClick={() => onChange(u.value)}
                title={u.ayuda}
                className={cn(
                  'w-[104px] rounded-xl border p-2 text-left transition-all',
                  activo ? 'border-primary/55 bg-primary/8 ring-2 ring-primary/15' : 'border-border bg-card hover:border-foreground/20',
                )}
              >
                <div className="mb-1.5 space-y-[3px] rounded-md bg-muted p-1.5">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={cn(
                        i === posicion ? 'h-2 rounded-sm bg-primary' : 'h-[3px] rounded-sm bg-border',
                        i !== posicion && (i % 2 ? 'w-3/4' : 'w-full'),
                      )}
                    />
                  ))}
                </div>
                <span className={cn('block text-[11px] leading-tight', activo ? 'text-foreground' : 'text-muted-foreground')}>
                  {u.label}
                </span>
              </button>
            )
          })}
        </div>
        <p className={AYUDA}>{elegida.ayuda}</p>
        {ayuda}
      </div>
    )
  }

  // ── Enlace: lista cerrada de páginas reales ────────────────────────────────
  if (campo.tipo === 'enlace') {
    return (
      <div>
        {etiqueta}
        <SelectCampo value={String(valor ?? '')} onChange={onChange} opciones={DESTINOS} />
        {ayuda}
      </div>
    )
  }

  // ── Media: la conversión y el tope de peso viven en SubirMedia ─────────────
  if (campo.tipo === 'media') {
    const prop = PROPORCIONES.find(x => x.value === String(config?.proporcion ?? '16:9'))
    return (
      <SubirMedia
        valor={String(valor ?? '')}
        label={campo.label}
        ayuda={campo.ayuda}
        recomendado={prop?.medida}
        onChange={onChange}
      />
    )
  }

  // ── Producto del catálogo real ─────────────────────────────────────────────
  if (campo.tipo === 'producto') {
    const elegido = productos.find(p => p.id === String(valor ?? ''))
    const opciones = productos.map(p => ({
      value: p.id,
      label: p.precio ? `${p.nombre} — $${p.precio.toLocaleString('es-AR')}` : p.nombre,
    }))
    return (
      <div>
        {etiqueta}
        <div className="flex items-center gap-2">
          {elegido?.imagen && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={elegido.imagen} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover" />
          )}
          <div className="flex-1">
            <SelectCampo
              value={String(valor ?? '')}
              onChange={onChange}
              opciones={opciones}
              placeholder="Elegí un producto…"
            />
          </div>
        </div>
        {productos.length === 0 && (
          <p className={`mt-1.5 ${AVISO}`}>No se pudo leer el catálogo de Tiendanube. Recargá en un rato.</p>
        )}
        {ayuda}
      </div>
    )
  }

  // ── Emoji: paleta corta de marca ───────────────────────────────────────────
  if (campo.tipo === 'emoji') {
    const chip = (activo: boolean) =>
      cn(
        'flex h-9 w-9 items-center justify-center rounded-lg border leading-none transition-all',
        activo ? 'border-primary/55 bg-primary/8 ring-2 ring-primary/15' : 'border-border bg-card hover:border-foreground/20',
      )
    return (
      <div>
        {etiqueta}
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => onChange('')} className={cn(chip(!valor), 'text-xs text-muted-foreground')} title="Sin emoji">
            —
          </button>
          {EMOJIS.map(e => (
            <button key={e} type="button" onClick={() => onChange(e)} className={cn(chip(valor === e), 'text-lg')}>
              {e}
            </button>
          ))}
        </div>
        {ayuda}
      </div>
    )
  }

  // ── Select con dibujo: se elige mirando, no leyendo ────────────────────────
  // Solo cuando TODAS las opciones tienen dibujo. Media tabla ilustrada y media en texto se
  // lee peor que la lista entera en texto: la comparación visual se corta a la mitad.
  if (campo.tipo === 'select' && campo.previsual) {
    const opciones = campo.opciones ?? []
    const ilustrables = opciones.length > 0 && opciones.every(o => tieneDibujo(campo.previsual!, o.value))
    if (ilustrables) {
      const actual = String(valor ?? campo.porDefecto ?? opciones[0].value)
      return (
        <div>
          {etiqueta}
          <div className="flex flex-wrap gap-2">
            {opciones.map(o => {
              const activo = o.value === actual
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onChange(o.value)}
                  title={o.label}
                  className={cn(
                    'w-[104px] rounded-xl border p-2 text-left transition-all',
                    activo
                      ? 'border-primary/55 bg-primary/8 ring-2 ring-primary/15'
                      : 'border-border bg-card hover:border-foreground/20',
                  )}
                >
                  <div className={cn('mb-1.5', activo ? 'opacity-100' : 'opacity-70')}>
                    <OpcionVisual previsual={campo.previsual!} value={o.value} />
                  </div>
                  <span
                    className={cn(
                      'block text-[11px] leading-tight',
                      activo ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {o.label}
                  </span>
                </button>
              )
            })}
          </div>
          {ayuda}
        </div>
      )
    }
  }

  // ── Lista: ítems repetibles con reordenar y borrar ─────────────────────────
  if (campo.tipo === 'lista') {
    const items = Array.isArray(valor) ? (valor as Record<string, unknown>[]) : []
    const tope = campo.maxItems ?? 20
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-3.5">
        {etiqueta}
        {ayuda}
        <div className="mt-3 space-y-3">
          {items.map((item, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="font-mono text-[11px] text-muted-foreground">#{i + 1}</span>
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={i === 0}
                    aria-label="Subir"
                    onClick={() => {
                      const c = [...items]
                      ;[c[i - 1], c[i]] = [c[i], c[i - 1]]
                      onChange(c)
                    }}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={i === items.length - 1}
                    aria-label="Bajar"
                    onClick={() => {
                      const c = [...items]
                      ;[c[i + 1], c[i]] = [c[i], c[i + 1]]
                      onChange(c)
                    }}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-destructive hover:text-destructive"
                    aria-label="Borrar"
                    onClick={() => onChange(items.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                {(campo.campos ?? []).map(sub => (
                  <CampoEditor
                    key={sub.key}
                    campo={sub}
                    valor={item[sub.key]}
                    productos={productos}
                    onChange={v => {
                      const c = [...items]
                      c[i] = { ...c[i], [sub.key]: v }
                      onChange(c)
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-3" disabled={items.length >= tope} onClick={() => onChange([...items, {}])}>
          <Plus />
          Agregar
        </Button>
      </div>
    )
  }

  // ── Campos simples ─────────────────────────────────────────────────────────
  return (
    <div>
      {etiqueta}
      {campo.tipo === 'textarea' ? (
        <Textarea
          rows={3}
          value={String(valor ?? '')}
          placeholder={campo.placeholder}
          onChange={e => onChange(e.target.value)}
        />
      ) : campo.tipo === 'select' ? (
        <SelectCampo value={String(valor ?? '')} onChange={onChange} opciones={campo.opciones ?? []} />
      ) : campo.tipo === 'color' ? (
        <div>
          {/* La paleta de marca primero, y un código propio para lo puntual (un evento, una
              fecha). El orden importa: lo de marca es el camino fácil, el color libre es el
              desvío deliberado. */}
          <div className="flex flex-wrap items-center gap-2">
            {PALETA.map(p => (
              <button
                key={p.value}
                type="button"
                title={p.label}
                onClick={() => onChange(p.value)}
                className="h-8 w-8 rounded-full border-2 transition-all"
                style={{
                  background: p.hex,
                  borderColor: valor === p.value ? 'var(--foreground)' : 'var(--border)',
                  boxShadow: valor === p.value ? '0 0 0 3px color-mix(in oklch, var(--foreground) 12%, transparent)' : undefined,
                }}
              />
            ))}
            <span className="mx-1 h-6 w-px bg-border" />
            <label
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1',
                String(valor ?? '').startsWith('#') ? 'border-foreground' : 'border-border',
              )}
              title="Elegir un color propio"
            >
              <input
                type="color"
                className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
                value={String(valor ?? '').startsWith('#') ? String(valor) : '#6f8a5f'}
                onChange={e => onChange(e.target.value)}
              />
              <span className="text-xs text-foreground">Otro color</span>
            </label>
            <Input
              type="text"
              placeholder="#a1b2c3"
              maxLength={7}
              className="w-24 font-mono text-xs uppercase"
              value={String(valor ?? '').startsWith('#') ? String(valor) : ''}
              onChange={e => {
                const v = e.target.value.trim()
                onChange(v === '' ? 'sage' : v.startsWith('#') ? v : '#' + v)
              }}
            />
          </div>
          {String(valor ?? '').startsWith('#') && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(valor)) && (
            <p className={`mt-1.5 ${AVISO}`}>
              Código incompleto. Va con almohadilla y seis dígitos, por ejemplo #b0341d. Si se guarda así, vuelve al color de marca.
            </p>
          )}
        </div>
      ) : campo.tipo === 'numero' ? (
        <Input
          type="number"
          value={Number(valor ?? 0)}
          min={campo.min}
          max={campo.max}
          onChange={e => onChange(Number(e.target.value))}
        />
      ) : (
        <Input type="text" value={String(valor ?? '')} placeholder={campo.placeholder} onChange={e => onChange(e.target.value)} />
      )}
      {ayuda}
    </div>
  )
}
