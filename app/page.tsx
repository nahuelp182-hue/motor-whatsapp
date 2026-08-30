import { redirect } from 'next/navigation'
import { MARCA } from '@/lib/marca'

// La raíz era todavía la plantilla de create-next-app: quien entraba al dominio sin ruta
// veía "To get started, edit the page.tsx file". Ahora manda al inicio de la instancia
// (Micelium → métricas, Osamayor → widgets); si no hay sesión, el middleware intercepta
// ese destino y lleva al login.
export default function Home() {
  redirect(MARCA.inicio)
}
