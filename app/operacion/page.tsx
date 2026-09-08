import { redirect } from 'next/navigation'

// /operacion es el Resumen: se resuelve con un redirect y no duplicando la pantalla, así
// hay una sola URL canónica por sección y el rail no tiene dos entradas que llevan al mismo
// lugar.
export default function OperacionPage() {
  redirect('/operacion/resumen')
}
