# Osamayor — agenda de trabajo

GPS del proyecto: dónde estamos, qué falta, y **quién tiene que hacer cada cosa**. El
contexto completo está en `OSAMAYOR.md`.

**Casillas:** `[ ]` pendiente · `[x]` hecho · `[~]` a medias (con la razón al lado) ·
`[!]` bloqueado esperando algo de Nahuel.

**Responsable:** 🤖 lo hace Claude · 👤 lo hace Nahuel · 🤝 los dos.
Un ítem 👤 es algo que **Claude no puede hacer**: pide una credencial, un dashboard externo,
una decisión, o mirar algo con ojo humano.

**Reglas:**
- Al hacer algo se escribe **qué** se hizo y **la fecha**, no solo la marca.
- Ninguna etapa se cierra sin pasar su puerta de salida.
- Si algo se desborda: parar, anotar qué faltó, seguir. Las etapas 0 a 2 son secuenciales;
  de la 3 en adelante hay margen.

---

## 📍 Dónde estamos

**Etapa actual: 0 — Antes de tocar nada.** Nada de código escrito todavía.

**Progreso:** 0 de 6 etapas · **1 de 40 ítems**

| Etapa | Qué es | Estado | Falta | De quién |
|---|---|---|---|---|
| 0 | Antes de tocar nada | ⬜ pendiente | 5 (+4 datos) | casi todo 👤 |
| 1 | Que el motor arranque sin lo de Micelium | ⬜ pendiente | 7 | casi todo 🤖 |
| 2 | Su instancia, con su dominio | ⬜ pendiente | 10 | mitad y mitad |
| 3 | Instalar en su tienda | ⬜ pendiente | 6 | casi todo 🤖 |
| 4 | Respaldos y avisos | ⬜ pendiente | 8 | mitad y mitad |
| 5 | Que desplegar dos veces no se olvide | 🟡 1 de 4 | 3 | casi todo 🤖 |

_40 = 44 casillas menos las 4 de "Después (no ahora)", que no son de este tramo._

### 👤 Lo que necesito de vos AHORA

Sin esto el proyecto no arranca. Es todo de la etapa 0:

1. **ID de tienda y token de API de Tiendanube** de su tienda.
2. **Dominio de su storefront** (la dirección de la tienda).
3. **Nombre comercial** de la tienda.
4. **Con qué dominio querés su panel** (de ahí sale `PUBLIC_BASE_URL`).
5. **Acceso a su cuenta de Google** para el OAuth de la ficha.
6. **Correr `npx prisma migrate status`** con la `DATABASE_URL` de producción y pasarme la
   salida — yo no tengo el secreto.

Con 1 a 4 puedo empezar la etapa 1. El 5 recién hace falta en la etapa 2, y el 6 conviene
antes de crear la base.

---

## Etapa 0 — Antes de tocar nada

Recolección. No se escribe código. Existe porque **la etapa 2 se traba sin estos datos**, y
porque hay un pendiente heredado que puede romper la base nueva.

- [ ] 👤 **Verificar si las tres migraciones pendientes se aplicaron a producción.**
      Al 27/07/2026 estaban sin aplicar: `20260727130000_cron_heartbeat`,
      `20260727140000_integridad_esquema`, `20260727150000_cola_envios`.
      **Por qué importa acá:** si la base de Osamayor se crea desde el schema actual, va a
      tener un esquema que la de Micelium todavía no tiene.
      **Corré:** `npx prisma migrate status` con la `DATABASE_URL` de producción y pasame la
      salida. Yo no tengo ese secreto.
- [ ] 👤 **Datos de la tienda**, para completar la ficha de `OSAMAYOR.md`:
      - [ ] Nombre comercial
      - [ ] ID de tienda en Tiendanube
      - [ ] Token de API de Tiendanube
      - [ ] Dominio del storefront
- [ ] 👤 **Elegir el dominio de su instancia** (de ahí sale `PUBLIC_BASE_URL`).
- [ ] 👤 **Acceso a su cuenta de Google** para el OAuth de la ficha de Business Profile.
      Recién hace falta en la etapa 2.
- [ ] 🤝 **Mirar su tienda con ojo de tema**: entrar a una ficha de producto y ver si están
      los bloques que el motor usa como ancla (precio, formulario de compra, descripción).
      Con el dominio yo puedo revisarlo con Playwright; es el aviso temprano del riesgo de
      tema.

> **Puerta de salida:** están los datos para crear la instancia y se sabe si el esquema de
> producción está al día.

---

## Etapa 1 — Que el motor arranque sin lo de Micelium

El repo tiene 29 rutas de API y ~60 variables. Su instancia necesita widgets y reseñas.
Hay que lograr que **lo no configurado no exista**, en vez de existir roto.

Esta etapa **toca código compartido**: rama aparte y los 21 tests en verde antes de mezclar.

- [ ] 🤖 Rama de trabajo (`osamayor-instancia` o similar).
- [ ] 🤖 **Inventariar el mínimo real** de widgets + reseñas. Punto de partida en la tabla de
      variables de `OSAMAYOR.md`; confirmar contra el código, no contra esa tabla.
- [ ] 🤖 **Hacer opcional lo que depende de Micelium.** Las rutas y crons de WhatsApp, ML,
      Ads, CRM y apicultura **no se registran** si falta su configuración.
      **Criterio:** ausente es mejor que presente y roto.
- [ ] 🤖 `.env.ejemplo` con el mínimo para una instancia de widgets, comentado.
- [ ] 🤖 **Probar el arranque en limpio**: base vacía y solo las variables mínimas. Que
      levante sin errores.
- [ ] 🤖 `npm test` en verde (21 tests).
- [ ] 🤝 Verificar que **la instancia de Micelium sigue idéntica**. Es el requisito duro del
      proyecto. Yo reviso el código; **vos confirmás en el sitio real** antes de mezclar.

> **Puerta de salida:** el proyecto levanta con la docena de variables mínimas, sin errores,
> y Micelium no se enteró de nada.

---

## Etapa 2 — Su instancia, con su dominio

Casi todo configuración. Un solo cambio de código imprescindible.

- [ ] 👤 **Base de datos nueva.** Separada de la de Micelium. Se crea desde el dashboard de
      Supabase; pasame los datos de conexión cuando esté.
- [ ] 🤝 **Migraciones de Prisma sobre la base nueva.** Yo preparo el comando, **vos lo
      corrés** (necesita la `DATABASE_URL` real). Primero migración, después deploy — Prisma
      hace `SELECT` de todas las columnas y un schema adelantado rompe el arranque.
- [ ] 👤 **Despliegue nuevo desde el mismo repo**, con sus variables. Se hace en Vercel.
- [ ] 👤 **Almacenamiento Blob propio**, para que sus fotos no caigan en el de Micelium.
      Verificar cómo se llama la variable en el despliegue.
- [ ] 👤 **NO habilitar las variables de base en Preview.** En Micelium quedaron habilitadas
      y eso hace que cualquier rama escriba en la base real. No repetir el error.
- [ ] 🤝 **Cargar su tienda en `Store`**: id de Tiendanube, token, dominio. Yo preparo la
      inserción, vos la corrés contra su base.
- [ ] 🤖 **`BASE` en `mic.js` deja de estar fijo** en `guias.infomicelium.com.ar`.
      **Es el único cambio de código imprescindible de esta etapa**, y no es trivial:
      `mic.js` es un **archivo estático** en `public/`, así que **no puede leer variables de
      entorno**. Tres caminos posibles, a decidir al implementar:
      1. Deducirlo del `src` del propio `<script>` (`document.currentScript.src`) — sin
         configuración, el motor pega contra donde fue servido. Es el más simple.
      2. Pasarlo como atributo `data-base` en la etiqueta del script.
      3. Servir `mic.js` desde una ruta dinámica que inyecte el valor.
      La opción 1 no necesita tocar la instalación en ninguna de las dos tiendas.
- [ ] 👤 **OAuth de Google Business para su ficha** → su `GOOGLE_REVIEWS_REFRESH_TOKEN`,
      `GOOGLE_REVIEWS_ACCOUNT_ID` y `GOOGLE_REVIEWS_LOCATION_ID`. Requiere entrar con su
      cuenta de Google.
- [ ] 👤 **`DASHBOARD_PASSWORD` distinta** a la de Micelium. Guardala donde guardás las otras.
- [ ] 🤝 Probar que su cron de reseñas de Google trae de **su** ficha.

> **Puerta de salida:** su panel abre en su dominio, con su contraseña, y muestra cero
> widgets porque la base está vacía. Micelium sin cambios.

---

## Etapa 3 — Instalar en su tienda

La única etapa que toca una tienda real. Como hay credenciales, no hace falta app pública ni
aprobación de Tiendanube.

- [ ] 🤝 **Instalar `mic.js` en su storefront**, apuntando a su instancia.
      Vía el recurso *Scripts* de la API, o el bootstrap `<img onerror>` en Códigos externos.
      `where: 'store'` — nunca el checkout. Yo preparo la llamada; **la primera instalación
      la mirás vos** porque toca una tienda en vivo.
- [ ] 🤖 **Verificar visualmente con Playwright antes de darlo por hecho.** Las anclas asumen
      el tema de Tiendanube y el suyo puede ser otro. Mirar la ficha renderizada.
- [ ] 🤖 Publicar **un widget de prueba** y confirmar que se ve donde corresponde.
- [ ] 🤖 Confirmar que el **evento se registra en su base**, no en la de Micelium.
- [ ] 🤖 Probar el **formulario de reseñas de punta a punta**, incluida la foto (que debe ir
      a su almacenamiento).
- [ ] 🤖 Si el tema rompe alguna ubicación: anotar cuál y con qué selector se arregla.

> **Puerta de salida:** un widget visible en su tienda, con su métrica contando en su base.

---

## Etapa 4 — Respaldos y avisos

**El stack de respaldo de Micelium no cubre esta instancia.** Está armado alrededor de la
PC, el VPS y la base de Micelium. Una base nueva de Supabase nace **sin respaldo**.

Va después de instalar porque antes no hay nada que perder — y antes de dar el proyecto por
cerrado porque después ya hay reseñas y fotos de clientes reales adentro.

- [ ] 👤 **Backups de su base**, con retención declarada. Se configura en el dashboard de
      Supabase. Decime cuál quedó y lo anoto en `OSAMAYOR.md`.
- [ ] 🤝 **Probar la restauración una vez.** Un backup no probado no es un backup.
- [ ] 👤 **Sus credenciales al paquete cifrado** (`backup_rescate.ps1` arma el `.7z` desde
      `~/.claude/`), o documentar dónde viven y por qué no están ahí. Necesita la passphrase.
- [ ] 🤖 **Sumarla a `backup_watchdog.py`**, o dejar escrito que no se vigila. Lo que no se
      puede quedar es en el medio: creer que está vigilada sin estarlo.
- [ ] 🤝 **Decidir qué pasa con las fotos de reseñas.** Son contenido de clientes reales y no
      tienen respaldo propio. La decisión es tuya; el script lo hago yo.
- [ ] 🤖 **Que su heartbeat de crons avise a algún lado.** Hoy el aviso va a Micelium; su
      cron de Google puede morir en silencio.
- [ ] 👤 **Verificar que la contraseña del panel es distinta** a la de Micelium.
- [ ] 👤 **Confirmar que las variables de base NO quedaron habilitadas en Preview.**

> **Puerta de salida:** su base tiene backup probado, y si algo deja de correr, alguien se
> entera.

---

## Etapa 5 — Que desplegar dos veces no se olvide

El punto flojo de esta arquitectura es humano. **No es opcional.**

- [ ] 👤 Su despliegue sale de la **misma rama**, automático. Se configura en Vercel.
- [x] 🤖 Anotar en el `CLAUDE.md` del repo que hay **dos instancias** y cuál es cuál.
      Hecho 28/08/2026, junto con la creación de esta agenda.
- [ ] 🤖 Una forma de **ver qué versión corre cada una**, para notar la deriva antes de que
      importe.
- [ ] 🤖 Anotar en `OSAMAYOR.md` la ficha completa ya con los datos reales.

> **Puerta de salida:** un cambio mezclado a `master` llega a las dos instancias sin
> intervención, y se puede ver de un vistazo si alguna quedó atrás.

---

## Después (no ahora)

No se hace salvo que aparezca la necesidad concreta. Anotado para no re-discutirlo.

- [ ] **Widgets propios de su rubro.** Los 28 actuales son generales, pero algunos textos y
      valores por defecto tienen olor a Micelium.
- [ ] **Cifrado en reposo de los tokens.** La puerta única ya existe (`lib/credenciales.ts`);
      falta el cifrado. Es el bloque G de `PLAN_ARQUITECTURA.md`.
- [ ] **Unificar en una sola instancia** con separación por `store_id`. Solo cuando el costo
      de una base + un deploy por cliente deje de cerrar. Ahí sí hay que arreglar los siete
      `?? '1957278'`, el caché global de productos y el `@@unique` de `Review`.
- [ ] **Cuentas de usuario.** Mientras Nahuel sea el único que entra, la contraseña única
      alcanza.

---

## Cómo se mantiene este archivo

**Para Claude, en cualquier sesión futura:** este archivo es el GPS del proyecto y se
actualiza **en el momento**, no al final.

1. **Al terminar un ítem**: tildarlo `[x]` y anotar al lado **qué** se hizo y la fecha.
2. **Si quedó a medias**: `[~]` con la razón. Si está trabado esperando a Nahuel: `[!]`.
3. **Actualizar el bloque 📍 Dónde estamos**: el contador de ítems, la etapa actual y la
   tabla. Un GPS que miente es peor que ninguno.
4. **Actualizar 👤 Lo que necesito de vos** cuando cambie lo que está bloqueado.
5. **Anotar en la bitácora** lo que se aprendió, no solo lo que se hizo.
6. Si aparece trabajo que no estaba previsto, **se agrega como ítem** en vez de hacerlo
   calladamente.

No dar por hecho un ítem sin verificarlo. La agenda vale por ser cierta.

---

## Bitácora

Lo último arriba. Anotar qué se hizo y qué se aprendió, no solo que se hizo.

### 28/08/2026 — Agenda creada

Análisis de viabilidad hecho contra el código real. Arquitectura decidida: mismo repo,
despliegue y base aparte. Sin código todavía.

**Lo que se aprendió revisando** (para no re-descubrirlo):

- `lib/credenciales.ts` ya era la puerta única de tokens que se iba a proponer construir, y
  su comentario ya anticipaba el caso de tiendas de terceros. `Coupon.codigo` ya se había
  arreglado por la misma razón.
- Tres afirmaciones de una memoria vieja resultaron falsas (que el repo no tenía tests ni
  auth). Costaron un análisis entero. La memoria quedó corregida.
- El catálogo tiene **28** widgets, no 26, y las categorías reales del código no coinciden
  con la agrupación intuitiva. Siempre contra `tipos.ts`.
- El stack de respaldos de Micelium **no cubre** una instancia nueva. De ahí salió la etapa 4,
  que no estaba en el plan original.
