# Osamayor — widget atado a Micelium (por ahora)

Segunda tienda de Tiendanube corriendo el motor de widgets de este repo. **Mismo código,
despliegue y base de datos separados.**

Este archivo es la memoria del proyecto. Si te olvidaste de todo, leelo entero y quedás al
día: qué es, cómo está armado, por qué se decidió así y qué está hecho.

- **Agenda de trabajo con casillas:** `OSAMAYOR_AGENDA.md`
- **Estado del repo y trampas del motor:** `CLAUDE.md`
- **Plan de correcciones del repo (bloques A–G):** `PLAN_ARQUITECTURA.md`

> **Nombre:** "Osamayor" es el nombre interno de este proyecto en la documentación. No es la
> marca de la tienda. Si la tienda tiene otro nombre comercial, va en la ficha de abajo y
> este archivo sigue llamándose igual para no romper las referencias.

---

## Qué es, en una frase

El motor de widgets y reseñas de Micelium, corriendo para una segunda tienda de Tiendanube
que no es de Nahuel, con aislamiento total en producción.

**Alcance:** widgets + reseñas. **Nada** de WhatsApp, MercadoLibre, Meta Ads, carrito
abandonado, asistente, CRM ni apicultura — eso es de Micelium y no se despliega acá.

---

## Ficha de la tienda

Datos operativos. **Los secretos NO van acá** — van en las variables de entorno del
despliegue. Acá solo se anota qué existe y dónde.

| Dato | Valor |
|---|---|
| Nombre comercial | **OSA MAYOR** |
| Dueña | Novia de Nahuel. Nahuel administra, tiene todas las credenciales. |
| ID de tienda Tiendanube | **`3224928`** — verificado 28/08 contra `LS.store` del storefront |
| Dominio del storefront | **`www.tiendaosamayor.com.ar`** |
| Dominio interno TN | `emuna23.mitiendanube.com` |
| Cuenta / mail | `info.osamayor20@gmail.com` |
| App de Tiendanube | ID **`32868`** — app **propia de OSA MAYOR**, distinta a la de Micelium. Ya instalada en la tienda. |
| GA4 | `G-KEXLLEL92E` (ya configurado en el storefront) |
| Dominio de la instancia | **`https://osamayor-nine.vercel.app`** — Vercel, proyecto `osamayor`, conectado a este repo/rama `master` |
| Base de datos | **Supabase, proyecto `osamayor`** (`ref: erqxzysaucxwlymyykau`, región `us-east-2`). 24+1 migraciones aplicadas y verificadas 28/08. |
| Ficha de Google Business | Sí, tiene. Cuenta de Google distinta a la de Micelium. |

> **⚠️ Ojo con los dos números.** `32868` es el ID de la **app** en el Portal de Partners;
> `3224928` es el ID de la **tienda**. La API de Tiendanube quiere el de la tienda: usar el
> de la app devuelve 401 y parece un problema de token cuando no lo es. Verificado el
> 28/08/2026 — se perdió un rato en eso.
>
> **El access token todavía no existe.** El valor de 48 caracteres que circuló es el
> **client secret** de la app, no un access token (los de tienda son 40 hex). Un access
> token no se copia de ningún lado: sale del flujo OAuth cuando la app se instala. Ver la
> etapa 0 de la agenda.
>
> **Verificado el 28/08:** el par `client_id=32868` + ese client secret **es válido** —
> el endpoint de token responde `invalid_grant` (el código de prueba era falso) y no
> `invalid_client`, que es lo que devolvería si el secret no correspondiera a esa app.

### Hallazgo del 28/08: 6 tablas faltaban del historial de migraciones

Al aplicar las 24 migraciones contra la base nueva de Osamayor, la migración
`20260727140000_integridad_esquema` falló: referencia `Widget`, `Visitor` y `gads_cache`,
pero **ninguna migración del repo las crea**. Se repitió con `WidgetLead` y `WidgetEvent`
(dependen de `Widget` por FK). Las seis existen en Micelium porque se crearon por fuera del
historial de Prisma en algún momento (a mano o con `db push`) y nunca quedaron registradas
— nadie lo notó porque la única base que existía ya las tenía.

**Arreglado:** nueva migración `20260727135900_tablas_faltantes_del_historial`, insertada
en el punto correcto (justo antes de `integridad_esquema`), con el DDL sacado de
`prisma migrate diff --to-schema` — no escrito a mano, para que coincida exacto con lo que
Prisma espera. Usa `IF NOT EXISTS` en todo: si esto se aplica alguna vez contra Micelium
(no debería hacer falta — ver el comentario en el propio archivo), no rompe nada.

**Un segundo problema, distinto:** dos migraciones más (`20260731200000_uso_ia`,
`20260801120000_messagelog_wamid`) tocan `claude_usage` e `ig_diag` — las **5 tablas que
`PLAN_ARQUITECTURA.md` (bloque C) ya señalaba como huérfanas del schema**, del bot de
WhatsApp/IA/Instagram. Osamayor no usa nada de eso. Decisión tomada: esas dos partes se
**saltearon** en la base de Osamayor (`prisma migrate resolve --applied`, sin ejecutar el
SQL de esas dos tablas) — pero `messagelog_wamid` también tocaba `MessageLog.wamid`, que
**sí importa** (la cola de envíos está en el schema), así que esa parte se aplicó a mano
antes de saltear el resto. **No se tocó el historial de migraciones del repo**: Micelium ya
tiene esas migraciones aplicadas con su checksum, y no hay que arriesgar eso.

Verificado con Prisma Client real (el mismo adapter `pg` + pooler que usa `lib/prisma.ts`)
contra el pooler 6543: `Widget`, `Review` y `Store` responden. Migraciones al día
(`prisma migrate status` → "Database schema is up to date!").

### Hallazgo del 28/08: el proyecto de Vercel necesita código delante para detectar Next.js

`vercel project add <nombre>` crea el proyecto **vacío**, sin mirar código, y lo deja con
`Framework Preset: Other`. Con eso el middleware falla al deployar: `"The Edge Function
middleware is referencing unsupported modules: @/lib/session"` — un error que no tiene nada
que ver con el código (se confirmó deployando el mismo commit como preview en Micelium, que
sí funcionó: `readyState: READY`).

**La forma correcta:** `vercel link` parado en un directorio que YA tiene el código de
Next.js delante. Ahí sí dice `Detected Next.js` y deja el preset correcto. Se hizo con
`git worktree` para no ensuciar el checkout real del repo.

**Beneficio extra:** ese mismo `link` conectó el repo de GitHub al proyecto automáticamente
(`Connecting GitHub repository... Connected`) — la etapa 5 (deploy automático por rama) ya
quedó resuelta de arranque, no hace falta configurarla aparte.

Deployado y verificado en vivo el 28/08: `/login` → 200, `/api/widgets/config` → 200,
`/dashboard/widgets` sin sesión → 307 (redirige a login, el middleware protege bien).

### Credenciales generadas el 28/08 (guardadas en el gestor de contraseñas de Nahuel)

No van acá los valores — solo el registro de que existen y dónde viven:

| Qué | Etiqueta en el gestor |
|---|---|
| Contraseña de la base (Supabase) | "Supabase — OSA MAYOR — DB" |
| Contraseña del panel | "Osamayor — panel" |
| `CRON_SECRET` | "Osamayor — CRON_SECRET" |

### Decidido el 28/08: primero la instancia, después la auth

La app `32868` es **propia de OSA MAYOR**, no la de Micelium. Eso permite hacerlo prolijo:
su callback se apunta directo a la instancia de ella, y el token nace donde tiene que vivir.

Consecuencia en el orden de trabajo: **la etapa 2 (crear su instancia) va ANTES de
completar la etapa 0 (el access token)**. Autorizar antes obligaría a guardar el token en
la base de Micelium y después mudarlo, que es trabajo al pedo y una ventana donde el token
de una tienda ajena vive en la base equivocada.

---

## Cómo está armado

### La decisión de arquitectura

Se evaluaron tres caminos. Queda anotado el descarte para no volver a discutirlo:

| Opción | Aislamiento | Costo | Veredicto |
|---|---|---|---|
| Duplicar el repo | Total | Cada mejora se hace **dos veces, para siempre**; las copias divergen | Descartada |
| Una instancia, separación por `store_id` | Lógico (filtro en cada consulta) | Refactor grande sobre código que sirve producción | Descartada **por ahora** |
| **Mismo repo, deploy y base aparte** | **Total (procesos y bases distintas)** | Desplegar dos veces; dos juegos de variables | **Elegida** |

**Por qué la elegida:** el requisito duro de Nahuel es que trabajar en la tienda de ella no
pueda romper Micelium. Bases y procesos separados lo garantizan físicamente, no por una
condición en una consulta que alguien puede olvidar. Y como cada instancia sigue viendo una
sola tienda, **casi todo el refactor de multi-tenancy no hace falta**: los `?? '1957278'`
dejan de ser un bug porque cada despliegue trae su propia `TN_STORE_ID`, el caché global de
productos no se envenena, y no hay selector de tienda que construir.

**Lo que se paga:** desplegar dos veces cada cambio. Es costo de operación, no de
desarrollo, y se automatiza (etapa 4 de la agenda).

**Cuándo se revisa:** esta arquitectura aguanta unos pocos clientes — cada uno suma una base
y un despliegue. Cuando eso deje de cerrar, el paso siguiente es la instancia única con
separación por tienda, que es el **bloque G** de `PLAN_ARQUITECTURA.md`. Esa decisión se toma
con un cliente que paga, no antes.

### El dibujo

```
                 un repositorio (motor-whatsapp, master)
                 mic.js · tipos.ts · panel · rutas de widgets
                                  │
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
    instancia Micelium                     instancia Osamayor
    base propia                            base propia
    ~60 variables                          ~12 variables
    widgets + reseñas                      widgets + reseñas
    + WhatsApp, ML, Ads, CRM               (y nada más)
```

Lo que se comparte es **el código**. Lo que está separado son **los datos y el proceso**.

---

## Qué le suma a la tienda

Esta es la parte que justifica el proyecto: **qué puede hacer la tienda después de esto que
no podía antes.** Tiendanube de fábrica no trae nada de lo de abajo.

### Las cuatro capacidades nuevas

**1. Poner bloques donde el tema no lo permite.** El editor de Tiendanube deja cambiar la
plantilla, no insertar un bloque arbitrario debajo del precio de la ficha. El motor sí:
tiene un mapa de anclas reales del tema (`.js-price-container`, `form.js-product-form`,
`.js-product-description`) y ubica el widget **como hermano** del bloque elegido —
"debajo del precio", "debajo del botón de compra", "antes de la descripción". Diez
ubicaciones nombradas, elegidas desde un desplegable.

**2. Leer el estado de la tienda en vivo.** Los widgets no son texto estático: se enganchan
al carrito y al catálogo de Tiendanube mientras la persona navega. De ahí salen la barra de
progreso a envío gratis, el cross-sell según lo que ya tiene en el carrito, la oferta al
agregar, y los precios que se actualizan solos porque el widget guarda el **id** del
producto, no su precio.

**3. Medir widget por widget.** Cada uno registra impresión, interacción y conversión —
más el monto que puso en juego. Eso permite decir *"este bloque movió $X"* y comparar entre
sí. Ninguna app de terceros da esto porque no sabe qué es una venta en tu negocio.

**4. Reseñas propias, de tres fuentes reales.** No es un formulario suelto: junta lo que
responden por WhatsApp tras la entrega, lo que sale de la ficha de Google Business, y lo
que dejan desde el sitio (con moderación antes de publicar). Cada una con su sello. Si no
hay reseñas, **no dibuja relleno**.

### El catálogo: 28 widgets

Definidos en `lib/widgets/tipos.ts`. Agregar uno = declararlo ahí + una función en `mic.js`.
**Las categorías de abajo son las del código** (campo `categoria`), no una agrupación
propia — si no coinciden con la intuición, manda el código.

**Confianza** (10) — atacan la desconfianza, que es el freno número uno.

| Widget | `slug` | Qué hace |
|---|---|---|
| Reseñas verificadas | `resenas` | Reseñas reales con sello. Tres fuentes, con moderación. |
| Preguntas frecuentes | `faq` | Acordeón. Responde la objeción antes de que la escriban. |
| Lista de beneficios | `beneficios` | Resultados, no componentes. |
| Mensaje de garantía | `garantia` | Recuadro de respaldo: garantía, soporte, quién está atrás. |
| Barra de confianza | `barra_confianza` | Fila de sellos cortos (envío, garantía, medios de pago). |
| Comparativa | `comparador` | Tabla de opciones enfrentadas. |
| Cómo funciona (1-2-3) | `pasos` | Los pasos del proceso. |
| Carrusel de imágenes | `carrusel` | Varias imágenes con desplazamiento. |
| Antes y después | `antes_despues` | Comparador de arrastre entre dos imágenes. |

**Conversión** (15) — empujan la decisión de compra.

| Widget | `slug` | Qué hace |
|---|---|---|
| Botón de WhatsApp | `whatsapp_flotante` | Flotante, abre WhatsApp con el mensaje ya escrito. |
| Barra de acción fija | `barra_accion` | Precio + botón pegados abajo. **Aprieta el botón real de Tiendanube**, no crea carrito propio. |
| Bloque de llamada a la acción | `cta_producto` | Título, texto y botón. El título puede rotar entre frases. |
| Línea de tiempo de entrega | `envio_estimado` | Compra → Envío → Entrega con **fechas calculadas solas**, días hábiles y hora de corte. |
| Progreso a envío gratis | `progreso_envio` | Lee el carrito en vivo y dice cuánto falta. |
| Cuotas sin interés | `cuotas` | El financiamiento, legible. |
| Corte de despacho | `corte_despacho` | "Comprando antes de las X, sale hoy." |
| Cuenta regresiva | `cuenta_regresiva` | Reloj hacia una fecha real. |
| Gente viendo ahora | `viendo_ahora` | Presentes reales de los últimos minutos, no un número inventado. |
| Qué incluye el pack | `desglose_pack` | Desglose de lo que trae. |
| Barra de anuncio | `banner_anuncio` | Cinta superior para un aviso temporal. |
| Complementos según el carrito | `crosssell_carrito` | "Si lleva A, ofrecer B". Nunca ofrece lo que ya está adentro. |
| Oferta al agregar al carrito | `upsell_al_agregar` | Ventana en el momento de mayor disposición. Una vez por visita. |
| Pasar a la versión superior | `upsell_upgrade` | Upsell al modelo de arriba. |
| Pack de complementarios | `pack_complementarios` | Varios productos juntos. |

**Contenido** (3)

| Widget | `slug` | Qué hace |
|---|---|---|
| Ficha técnica | `especificaciones` | Tabla de datos duros. |
| Video | `video` | Video embebido. |
| Imagen o animación | `media` | Imagen suelta. |

**Captura** (1)

| Widget | `slug` | Qué hace |
|---|---|---|
| Captura de email | `captura_email` | Email a cambio de un PDF. Valida que el dominio exista. Como ventana o como bloque. |

### Cómo se vincula con Tiendanube

**Por dónde entra:** un `<script>` en el storefront, vía el recurso *Scripts* de la API de
Tiendanube (o el bootstrap `<img onerror>` en Códigos externos si no hay app de Partners).
Se instala **una vez** para todo el sitio.

**Cómo sabe dónde está:** lee `window.LS.template` — la variable que el storefront de
Tiendanube expone — para distinguir ficha de producto, tienda o blog, y `window.LS.product.id`
para saber qué producto se está viendo. De ahí salen el filtro de reseñas por producto y las
reglas por página.

**Cómo no rompe el tema:** cada widget vive en su propio **Shadow DOM**. El CSS de la tienda
no lo puede tocar, y él no puede romper el de la tienda.

**Qué no toca:** el checkout. Tiendanube no admite scripts de terceros ahí, y el motor está
puesto con `where: 'store'` a propósito.

**Qué le pide a la API de Tiendanube:** el catálogo de productos (id, nombre, precio, imagen,
enlace), cacheado 10 minutos, solo para que elegir un producto en el panel sea un desplegable
y no escribir un id a mano.

### Lo que se suma al stack

| Pieza | Qué es |
|---|---|
| Despliegue en Vercel | Su propia instancia del repo |
| Base Postgres | Suya, separada de la de Micelium |
| Vercel Blob | Fotos de reseñas y medios de los widgets |
| Google Business Profile API | Trae las reseñas de su ficha (su cuenta, su OAuth) |
| Tiendanube API | Catálogo de productos e instalación del script |

Nada de esto existe hoy para su tienda. Lo que **no** se suma: WhatsApp Cloud API,
MercadoLibre, Meta Ads, GA4, Chatwoot, Telegram — todo eso es de Micelium.

### Los límites, dichos de frente

- **La barra de acción fija depende del botón real del tema.** Si el tema cambia y ese botón
  deja de existir, la barra no aparece. Es a propósito: mejor ausente que rota.
- **"Gente viendo ahora" es verificable.** Alguien puede abrir la página en dos dispositivos
  y contar. Si el factor de corrección está alto, se desmiente en treinta segundos.
- **El progreso a envío gratis tiene que coincidir** con el monto configurado en Tiendanube,
  o promete un beneficio que el checkout no da.
- **Las fechas de entrega tienen que ser las que se cumplen**, no el mejor caso. Llegar
  después resta el doble de lo que suma llegar antes.

---

## Lo que hay que saber del motor

Resumen de lo verificado contra el código el 28/08/2026. El detalle de trampas del repo
entero está en `CLAUDE.md`.

**Lo que ya estaba resuelto y conviene no re-descubrir:**

- `lib/credenciales.ts` es la **puerta única** a los tokens de una tienda. Su comentario de
  cabecera ya anticipó este caso: *"la columna queda como la forma correcta el día que haya
  tiendas de terceros (ahí el env var no escala y hay que cifrar la columna, no vaciarla)"*.
  `esTiendaPropia()` distingue la tienda propia comparando contra `TN_STORE_ID`.
- La base **ya es multi-tenant en el esquema**: `Widget`, `Review`, `WidgetEvent` y
  `WidgetLead` cuelgan de `store_id`. `resenasPublicas()` en `lib/widgets/datos.ts` ya recibe
  `storeId` como parámetro.
- `Coupon.codigo` ya es único **por tienda** (era global). Migración
  `20260727140000_integridad_esquema`.
- Hay **21 tests** con Vitest (`npm test`) y un middleware que **falla cerrado**
  (`middleware.ts`). Si alguna documentación dice lo contrario, está desactualizada.

**Lo que sigue atado a una sola tienda (y por qué no molesta acá):**

- Siete archivos con `process.env.TN_STORE_ID ?? '1957278'`. Con instancias separadas cada
  una trae la suya, así que el fallback nunca se usa. **Seguiría siendo un bug** el día que
  se unifique en una sola instancia.
- `lib/widgets/productos.ts` tiene un caché global de 10 minutos. Con una tienda por
  instancia no se envenena.

**Lo que sí hay que tocar:**

- `public/mic.js` tiene `BASE` fijo en `https://guias.infomicelium.com.ar`. Es **el único
  cambio de código imprescindible** para que exista la segunda instancia. **Ojo:** es un
  archivo estático servido desde `public/`, así que **no lee variables de entorno** —
  `PUBLIC_BASE_URL` no le llega. Lo más limpio es deducirlo de `document.currentScript.src`:
  el motor pega contra el dominio desde el que fue servido, sin configuración extra.
- El cron de reseñas de Google usa `GOOGLE_REVIEWS_REFRESH_TOKEN` del entorno. La ficha de
  ella es otra cuenta de Google → su instancia necesita su propio OAuth y su propio token.
- `@@unique([source, external_id])` en `Review` no incluye `store_id`. Con bases separadas
  **no molesta**; queda anotado para el día de la unificación.

---

## Trampas específicas de este proyecto

**Las migraciones sin aplicar.** Al 27/07/2026 había tres migraciones pendientes de
`prisma migrate deploy` contra producción (`cron_heartbeat`, `integridad_esquema`,
`cola_envios`). Si se crea la base de Osamayor desde el schema actual, va a tener un esquema
que la de Micelium todavía no tiene. **Verificar el estado real antes de crear la base.**

**Migración antes que deploy.** Prisma hace `SELECT` de todas las columnas del modelo: un
schema adelantado a la base rompe producción. Vale para las dos instancias.

**Las variables de Preview pegan a la base de producción.** Confirmado en el bloque A: las
`DB_*` y `CRON_SECRET` están habilitadas en Preview. Cualquier rama de PR escribe en la base
real. Al crear la instancia de Osamayor, **no repetir eso**.

**El tema de Tiendanube.** `mic.js` ubica los widgets con selectores del tema
(`.js-price-container`, `form.js-product-form`). Hay plan B — si no encuentra el ancla, va al
final de la columna — pero si el tema de ella es muy distinto, los widgets pueden caer en
lugares raros. **Se verifica mirando, no leyendo código.**

**Desplegar una sola.** El riesgo permanente de esta arquitectura: arreglás algo, desplegás
Micelium, y Osamayor queda atrás. A los tres meses son dos versiones distintas sin que nadie
lo haya decidido. Por eso la etapa 4 de la agenda no es opcional.

---

## Respaldos y seguridad

**Regla corta: el stack de respaldo de Micelium NO cubre esta instancia.** Está construido
alrededor de la PC, el VPS y la base de Micelium, y Osamayor no es ninguna de las tres.

### Lo que se hereda solo

| Pieza | Por qué |
|---|---|
| Seguridad del código | Mismo repo: middleware que falla cerrado, rate limiting, validación, CORS acotado. |
| Tests | Los mismos 21 corren sobre el mismo código. |
| Backup del código | `claude-sync` espeja el repo a GitHub. Es el mismo repo. |

### La solución montada (28/08/2026)

**Dos capas, a propósito.** El backup nativo de Supabase queda como primera línea, pero no
alcanza solo: *un backup del que no podés bajarte el archivo no es un backup, es una promesa
del proveedor*. Si la cuenta se cae, se suspende o se pierde el acceso, ese backup no sirve.

**Capa 1 — backups nativos de Supabase.** Se configuran en su proyecto. Cubren el error
común: borrar algo sin querer y querer volver atrás rápido.

**Capa 2 — dump propio semanal, en otra infraestructura.**
`~/.claude/backup_osamayor.sh` (va al VPS) hace `pg_dump` de la base entera todos los lunes
a las 4:30 y lo deja en `/root/backup/osamayor/`. Decisiones del script:

- **`--no-owner --no-acl`**: el dump tiene que poder restaurarse en *otra* base con *otro*
  usuario. Sin eso, un restore de emergencia falla por roles que no existen — justo el
  escenario para el que existe.
- **Escribe a `.parcial` y renombra al final**: un dump cortado a la mitad no queda con
  nombre de bueno.
- **Rechaza dumps de menos de 10 KB**: una base que responde pero no trae nada es un fallo
  silencioso.
- **Verifica el gzip con `gzip -t`**: un archivo del tamaño correcto pero corrupto es el peor
  caso, parece backup hasta el día que se necesita.
- **Rota a 90 días, y borra los viejos recién después** de confirmar que el nuevo está sano.

**Capa 3 — vigilancia.** `backup_watchdog.py` (ya corría los lunes 9:00 en el VPS) ahora
tiene un tercer grupo, **"Base de Osamayor", con umbral de 10 días** — el más corto de los
tres, porque su dump es semanal y automático: 10 días significa que fallaron dos corridas
seguidas. Los otros grupos son manuales y toleran más. Si falla, el mail explica que es un
cron del VPS y dónde mirar el log, en vez de dar las instrucciones manuales que no aplican.

**Por qué el umbral más corto es el de ella:** es la única base con datos de **otra persona**.
Una reseña que escribió un cliente en su tienda no se puede volver a generar.

### Lo que queda por decidir

| Pieza | Estado | Qué falta |
|---|---|---|
| **Fotos de reseñas (Blob)** | Sin respaldo. Están como URL dentro del dump, pero el archivo vive en Vercel. | Decidir si se respaldan. Son contenido de clientes reales. |
| **Sus credenciales** | Fuera del `.7z` cifrado (`backup_rescate.ps1` arma desde `~/.claude/`). | Sumarlas o documentar dónde viven. |
| **Aviso de caída de su cron de Google** | El heartbeat notifica a Micelium. | Que avise a algún lado para su instancia. |

El hardening del VPS (firewall Hetzner, SSH sin password) **no aplica**: nada de Osamayor
pasa por el VPS. Vercel y Supabase son gestionados, con su propia superficie de ataque.

### Lo que sí o sí hay que decidir

- **Contraseña del panel distinta** a la de Micelium. Si es la misma, el aislamiento entre
  instancias es de mentira.
- **Variables de base NO habilitadas en Preview.** En Micelium quedaron habilitadas y por eso
  cualquier rama de PR escribe en la base real. No repetir el error.
- **Qué pasa con los datos si el proyecto se termina.** Son reseñas y fotos de clientes de
  otra persona. Conviene que esté dicho de antemano.

---

## Variables de entorno de la instancia Osamayor

Mínimo para que corra widgets + reseñas. El repo entero usa ~60; acá van las que importan.

| Variable | Para qué |
|---|---|
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` | Conexión en runtime (pooler) |
| `DATABASE_URL` | Migraciones (camino distinto al de runtime — ver `CLAUDE.md`) |
| `TN_STORE_ID` | ID de tienda de ella en Tiendanube |
| `TN_ACCESS_TOKEN` | Token de API de su tienda |
| `PUBLIC_BASE_URL` | Dominio de su instancia. Lo usan los mails (`lib/mails-*.ts`). **No** alimenta a `mic.js` — ver arriba. |
| `DASHBOARD_PASSWORD` | Entrada al panel. **Distinta a la de Micelium** |
| `CRON_SECRET` | Autenticación de los crons |
| Vercel Blob | Fotos de reseñas y medios. El SDK toma el token del entorno; **verificar cómo se llama la variable en el despliegue**, no está escrita en el código. |
| `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` | OAuth (pueden ser los mismos) |
| `GOOGLE_REVIEWS_REFRESH_TOKEN` | **De su cuenta**, no la de Micelium |
| `GOOGLE_REVIEWS_ACCOUNT_ID` `GOOGLE_REVIEWS_LOCATION_ID` | Su ficha de Google |

**No van:** nada de `WHATSAPP_*`, `WA_*`, `META_*`, `ML_*`, `CHATWOOT_*`, `TELEGRAM_*`,
`GA4_*`, `GOOGLE_ADS_*`, `IG_*`, `FB_*`, `CLARITY_*`, `YOUTUBE_*`.

---

## Bitácora

Cada cambio con fecha. Lo último arriba.

### 28/08/2026 — Análisis de viabilidad y decisión de arquitectura

- Se auditó el motor de widgets contra el código real (no contra memoria).
- Se descartó duplicar el repo y se descartó, por ahora, la instancia única con separación
  por `store_id`. Elegido: mismo repo, deploy y base aparte.
- Se corrigieron tres afirmaciones falsas que venían de una memoria vieja: el repo **sí**
  tiene tests (21, Vitest), **sí** tiene auth (middleware que falla cerrado), y
  `lib/credenciales.ts` **ya existe** como puerta única de tokens.
- Se creó este archivo y `OSAMAYOR_AGENDA.md`.
- **Nada de código todavía.**
