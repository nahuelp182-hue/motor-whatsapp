# Osamayor — agenda de trabajo

GPS del proyecto: dónde estamos, qué falta, y **quién tiene que hacer cada cosa**. El
contexto completo está en `OSAMAYOR.md`.

> **Versión interactiva (la que mira Nahuel):**
> https://claude.ai/code/artifact/21262aca-987b-4299-9c20-3662b0dee45d
> Casillas tildables, barra de progreso y filtro por responsable. El progreso se guarda en
> el navegador de él, así que **este archivo sigue siendo la fuente de verdad**: cuando algo
> se completa de verdad, se tilda ACÁ y se republica la página para que no diverjan.

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

**Etapa actual: 2 — Su instancia, con su dominio.** OAuth completa y verificada en vivo
(29/08): la tienda está dada de alta con su access token real. Solo falta Blob (paso 4).

**La instancia vive en: `https://osamayor-nine.vercel.app`**

**Progreso:** 0 de 6 etapas cerradas · **16 hechos + 2 a medias, de 43 ítems**

| Etapa | Qué es | Estado | Falta | De quién |
|---|---|---|---|---|
| 0 | Antes de tocar nada | 🟡 datos sí, migración por confirmar | 2 | 👤 |
| 1 | Que el motor arranque sin lo de Micelium | 🟡 3 de 7 | 4 | casi todo 🤖 |
| 2 | Su instancia, con su dominio | 🟡 9 de 10 | 1 | 👤 |
| 3 | Instalar en su tienda | ⬜ pendiente | 6 | casi todo 🤖 |
| 4 | Respaldos y avisos | 🟡 2 de 10 | 8 | casi todo 👤 |
| 5 | Que desplegar dos veces no se olvide | 🟡 1 de 4 | 3 | casi todo 🤖 |

_42 casillas en las etapas 0–5. Las 4 de "Después (no ahora)" no cuentan._

**Tres hallazgos grandes en el camino, documentados en `OSAMAYOR.md`:** 6 tablas faltaban
del historial de migraciones de Prisma (afecta a cualquier tercera instancia futura, no
solo Osamayor); crear un proyecto de Vercel sin código delante lo deja mal configurado para
Next.js; y el callback OAuth registraba webhooks de OSA MAYOR apuntando a Micelium por un
bug de "tienda propia" que no contemplaba dos instancias (sin daño real, pero arreglado).
Los tres ya están resueltos y con el arreglo commiteado.

### 👤 Lo que necesito de vos AHORA

Una sola cosa, en el dashboard de Vercel — no lo puedo hacer yo:

1. **Conectar Vercel Blob** al proyecto `osamayor`, para las fotos de reseñas y widgets.
   Vercel dashboard → proyecto `osamayor` → Storage → Connect Blob.

Con eso cerrada la etapa 2, sigo yo con la etapa 3 (instalar `mic.js` en el storefront de
OSA MAYOR y verificar visualmente) sin necesitar nada más de vos hasta ahí.

**Guardaste ya en tu gestor de contraseñas:** la contraseña de la base de Supabase, la del
panel de Osamayor y el `CRON_SECRET` — las tres se generaron y mostraron durante el setup.

**Y cuando exista la base** (etapa 4, ya escrito y esperando): subir al VPS el script de
respaldo y su vigilancia. Los pasos exactos están en la etapa 4.

---

## Etapa 0 — Antes de tocar nada

Recolección. No se escribe código. Existe porque **la etapa 2 se traba sin estos datos**, y
porque hay un pendiente heredado que puede romper la base nueva.

- [~] 👤 **Verificar si las tres migraciones de julio se aplicaron a producción.**
      `PLAN_ARQUITECTURA.md` las daba por pendientes al 27/07: `cron_heartbeat`,
      `integridad_esquema`, `cola_envios`.
      **Revisado el 28/08:** hay **7 migraciones posteriores** en disco, la última del
      26/08 (`review_approved_default_false`). Prisma no deja crear migraciones nuevas
      sobre una base desincronizada sin protestar, así que **casi con seguridad ya se
      aplicaron** y el aviso del plan quedó viejo. Riesgo bajo, no bloqueante.
      **Para cerrarlo del todo:** `npx prisma migrate status` con la `DATABASE_URL` de
      producción. No está en el disco (no hay `.env`), así que lo tenés que correr vos.
- [~] 👤 **Datos de la tienda.** Recibidos y verificados el 28/08 — están en `OSAMAYOR.md`:
      - [x] Nombre comercial: **OSA MAYOR**
      - [x] ID de tienda: **`3224928`** (sacado de `LS.store` del storefront; el `32868`
            que circuló es el id de la **app**, no de la tienda)
      - [ ] **Access token: FALTA.** El valor de 48 caracteres que llegó es el *client
            secret* de la app, no un access token (los de tienda son 40 hex; da 401).
            No se copia de ningún panel: **sale del flujo OAuth** al instalar la app.
      - [x] Dominio: **`www.tiendaosamayor.com.ar`** (interno `emuna23.mitiendanube.com`)
- [x] 👤 **Confirmar a dónde apunta el callback de la app `32868`.** Resuelto 28/08: es una
      app **propia de OSA MAYOR**, no la de Micelium. Decidido esperar a que exista su
      instancia (etapa 2) y apuntar el callback ahí directo — ver la nota al inicio de la
      etapa 2. El callback ya está preparado para recibir una tienda nueva sin romper nada.
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

**Revisado el 28/08 — el trabajo es mucho menor de lo que parecía.** Tres hallazgos:

1. **`vercel.json` tiene `"crons": []`.** Vercel no dispara ninguno de los 15 crons: los
   llama el VPS por `curl` contra `mw-micelium.vercel.app`. En la instancia de ella
   **nunca se van a ejecutar**, porque nadie los va a llamar. No hay que desactivarlos.
2. **`chequearCron` falla cerrado**: sin `CRON_SECRET` devuelve 503. Una ruta de cron
   colgada en la instancia nueva no es una puerta abierta.
3. **Los tres webhooks validan firma** (Instagram, Tiendanube, WhatsApp), y el de
   Tiendanube devuelve 503 en producción si falta el secreto.

Queda entonces poco: que el arranque no dependa de lo que no está, y dejar escrito el
mínimo. Igual **toca código compartido**: rama aparte y 230 tests en verde antes de mezclar.

- [ ] 🤖 Rama de trabajo (`osamayor-instancia` o similar).
- [x] 🤖 **Inventariar el mínimo real.** Hecho 28/08: son ~12 variables, contra las ~60 del
      repo. La tabla está en `OSAMAYOR.md`, verificada contra el código.
- [x] 🤖 **Verificar qué se rompe sin lo de Micelium.** Hecho 28/08: nada crítico. Los `!`
      de TypeScript en env vars no explotan en runtime (son solo tipado), los crons no se
      disparan solos y los webhooks fallan cerrado. Ver los tres hallazgos de arriba.
- [ ] 🤖 `.env.ejemplo` con el mínimo para una instancia de widgets, comentado.
- [ ] 🤖 **Probar el arranque en limpio**: base vacía y solo las variables mínimas. Que
      levante sin errores.
- [ ] 🤖 `npm test` en verde (230 tests en 20 archivos).
- [ ] 🤝 Verificar que **la instancia de Micelium sigue idéntica**. Es el requisito duro del
      proyecto. Yo reviso el código; **vos confirmás en el sitio real** antes de mezclar.

> **Puerta de salida:** el proyecto levanta con la docena de variables mínimas, sin errores,
> y Micelium no se enteró de nada.

---

## Etapa 2 — Su instancia, con su dominio

Casi todo configuración. Un solo cambio de código imprescindible.

> **Decidido el 28/08: esta etapa va ANTES de completar la etapa 0.** La app `32868` es
> propia de OSA MAYOR, así que su callback puede apuntar directo a la instancia de ella y
> el token nace donde tiene que vivir. Autorizar antes obligaría a guardarlo en la base de
> Micelium y después mudarlo.

### El orden exacto, y por qué importa

Los pasos 1 a 3 **no se pueden reordenar**. El resto sí.

1. [x] **Crear la base** (Supabase, proyecto `osamayor`, `us-east-2`). Hecho 28/08.
2. [x] **Aplicar las migraciones.** Hecho 28/08 — con un hallazgo grande en el camino: 6
   tablas faltaban del historial (ver `OSAMAYOR.md`, arreglado con una migración nueva) y
   2 migraciones de tablas ajenas al motor de widgets se saltearon a propósito. Verificado
   con Prisma Client real contra el pooler: `Widget`/`Review`/`Store` responden.
3. [x] **Crear el deploy en Vercel.** Hecho 28/08 — con un hallazgo: crear el proyecto con
   `vercel project add` (sin código delante) lo deja mal configurado (`Framework Preset:
   Other`, rompe el middleware). Se resolvió con `vercel link` parado en el código real
   (vía `git worktree`), que detecta Next.js solo. **Bonus:** eso conectó el repo de
   GitHub automáticamente — la etapa 5 (deploy automático) ya quedó resuelta.
   Dominio: **`https://osamayor-nine.vercel.app`**. `TN_ACCESS_TOKEN` queda vacío por
   ahora: lo va a escribir el callback en el paso 6.
4. [ ] **Conectar Blob** al proyecto nuevo (para las fotos de reseñas). **Pendiente** —
   requiere entrar al dashboard de Vercel, no se pudo hacer por CLI/API.
5. [x] **Apuntar el callback de la app `32868`** en el Portal de Partners. Hecho 29/08 por
   Nahuel, a `https://osamayor-nine.vercel.app/api/auth/tiendanube/callback`.
6. [x] **Autorizar la app.** Hecho 29/08: `{"ok":true,"store_id":"3224928","creada":true}`.
   **Bug encontrado y arreglado en el momento**: el callback registró webhooks apuntando a
   Micelium por un bug de "tienda propia" que no contemplaba dos instancias — sin daño real
   (la firma los habría rechazado), pero se arregló la causa y se borró el webhook mal
   registrado de la cuenta real. Ver `OSAMAYOR.md`.

- [x] 👤 **Base de datos nueva.** Hecho 28/08 — Supabase, proyecto `osamayor`.
- [x] 🤖 **Migraciones de Prisma sobre la base nueva.** Hecho 28/08, con el hallazgo de las
      6 tablas faltantes (ver arriba y `OSAMAYOR.md`).
- [x] 🤖 **Despliegue nuevo desde el mismo repo.** Hecho 28/08 —
      `https://osamayor-nine.vercel.app`, con el hallazgo del Framework Preset (ver arriba).
- [ ] 👤 **Almacenamiento Blob propio**, para que sus fotos no caigan en el de Micelium.
      **Pendiente** — requiere el dashboard de Vercel.
- [x] 👤 **NO habilitar las variables de base en Preview.** No se tocó Preview al cargar
      las variables — solo se agregaron a Production. Verificado 28/08.
- [x] 🤖 **Cargar su tienda en `Store`**: id de Tiendanube, token, dominio. Hecho 29/08 —
      la creó el callback OAuth solo. Access token real de 40 caracteres, verificado.
- [x] 🤖 **`BASE` en `mic.js` deja de estar fijo.** Hecho 28/08: se deduce de
      `new URL(document.currentScript.src).origin`, sin necesidad de configurar nada en la
      etiqueta ni en el storefront. Con respaldo al dominio de Micelium si `currentScript`
      no está disponible. Verificado en Chrome con los cuatro escenarios (Micelium, OSA
      MAYOR, panel local, sin currentScript) — todos correctos. `tsc` limpio, 230 tests OK.
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

- [x] 🤝 **Instalar `mic.js` en su storefront.** Hecho 29/08 vía **Google Tag Manager**
      (contenedor `GTM-5DBVNKSX`, tag HTML personalizado con activador All Pages).
      Verificado en la tienda real sobre una URL dinámica: `window.__micInit === true`,
      `mic.js` servido desde `osamayor-nine.vercel.app`. Detalle en
      **`OSAMAYOR_GTM.md`**.
      Las dos vías anteriores no sirvieron: el panel de "Códigos externos" de OSA MAYOR
      **no tiene** el campo de JavaScript libre que sí existe en Micelium (solo GTM, GA4,
      Facebook, códigos de conversión, AFIP, Bing), y el sistema de Scripts del Portal de
      Partners queda **bloqueado en el front-end** para apps privadas (enforcement de
      NubeSDK): el script llega a `active`, se registra en el HTML tras reinstalar la app,
      y aun así el loader no lo ejecuta — mientras una app pública al lado sí carga.
      Post-mortem completo en `OSAMAYOR.md` y en la memoria
      `feedback_diagnostico_diferencial`.
- [x] 🤖 **Verificar las anclas contra la ficha real.** Hecho 30/08 sobre
      `/productos/luna-armonia-wfreg/`. El riesgo era real y se confirmó: **el tema
      `new_linkedman` no tiene `.product-detail-container`**, así que la ficha entera se
      caía al reparto por conteo de párrafos y las siete ubicaciones de producto quedaban
      en cualquier lado. Arreglado en `public/mic.js`: `columnaFicha()` prueba también
      `.product-form-container`, que es como se llama la misma pila de bloques en los temas
      viejos, **solo cuando `LS.template === 'product'`** (ver el ítem de la regresión).
      **Cómo se verificó, para que no haya que creerme:** se interceptó `fetch` en el
      navegador para que `/api/widgets/config` devolviera cinco widgets de prueba, y se
      cargó la ficha real con el `mic.js` desplegado. Los cinco se insertaron como hijos
      directos de la columna, en el orden correcto, y se vieron en pantalla. No es una
      simulación de la lógica: es el motor real dibujando.
      Medido a 1280px; el reparto de bloques se comprobó además a 500px.
- [x] 🤖 **Publicar un widget de prueba y confirmar que se ve donde corresponde.** Hecho
      30/08: "Mensaje de garantía" en `/productos/luna-armonia-wfreg/`, ubicación "debajo
      del botón de compra". Verificado en la ficha real: hijo inmediato después del
      `<form>` en la columna, visible, con el texto correcto. Apagado después de verificar.
- [x] 🤖 **Confirmar que el evento se registra en su base, no en la de Micelium.** Hecho
      30/08: tras la visita, el panel de Osamayor mostró `VISTAS: 1` en el widget. El panel
      solo puede leer su propia base (`DATABASE_URL` de la instancia), así que si lo ve ahí
      es porque cayó ahí — no hay forma de que muestre datos de Micelium.
- [ ] 👤 Probar el **formulario de reseñas de punta a punta**, incluida la foto (que debe ir
      a su almacenamiento). **Bloqueado: necesita Vercel Blob conectado.** Queda para cuando
      se resuelva ese pendiente.
- [x] 🤖 **Ubicaciones que el tema degrada** (anotado 30/08, ninguna rompe — todas caen en
      un lugar razonable):
      - «Debajo del título» y «debajo del precio» son **el mismo punto**: el tema mete
        nombre y precio en un solo bloque (`.js-product-name-price-container`).
      - «Debajo de los medios de pago» cae igual que «debajo del botón»: el bloque de
        cuotas vive **dentro** del `<form>`.
      - «Debajo del envío» no tiene ancla (el tema no trae
        `.js-free-shipping-minimum-message` ni `#product-shipping-container`) → va al final
        de la columna.
      - «Debajo de la descripción» ancla en la descripción **mobile**. En escritorio esa
        copia está oculta y la visible vive fuera de la columna, así que el widget termina
        al pie de la columna. Se ve, pero no debajo del texto.
      Si alguna de estas molesta, se arregla con un mapa de anclas por tema; hoy no vale la
      pena.
      Además: «debajo del título» y «debajo del precio» apuntan al mismo bloque, así que si
      hay uno de cada uno **salen en orden invertido** respecto del `orden` del panel. Con
      un solo widget ahí no se nota.
- [x] 🤖 **Regresión propia, encontrada y corregida el mismo día (30/08).** El arreglo de
      arriba, tal como salió en el primer commit, no tenía guardia de template. En la
      **grilla de categoría y en la home** el mismo tema deja un `.product-form-container`
      de 0×0 dentro de cada tarjeta —el panel de *quickshop*, oculto—, así que
      `columnaFicha()` daba truthy fuera de la ficha y **todo widget de contexto "tienda"
      se habría enterrado adentro de una tarjeta, invisible**. Es exactamente el riesgo que
      el comentario de `contenido()` ya describía para los candidatos genéricos; ahí el
      guardia existía y en `columnaFicha()` faltaba. Corregido: el selector suelto solo se
      prueba con `LS.template === 'product'`. Micelium nunca estuvo afectado (su tema no
      trae ninguno de los dos contenedores en el DOM fuera de la ficha).
- [!] 🤝 **El contexto "tienda" no dibuja nada en la home ni en las categorías — y le pasa
      también a Micelium.** Fuera de la ficha, `contenido()` solo acepta
      `[data-mic-contenido]`, `article`, `.mic-ancho main` y `main`. **Ninguno de los cuatro
      existe** en el tema de OSA MAYOR ni en el de Micelium (verificado el 30/08 en las dos
      homes). Los widgets acotados por ruta a una ficha funcionan; los de toda la tienda no
      se dibujan. En Micelium hoy hay **un** widget así (`viendo_ahora`, sin restricción de
      rutas) que nunca se vio en la portada.
      **Arreglo propuesto:** agregar `.main-content` a la lista de candidatos permitidos
      fuera de la ficha. Existe en las dos tiendas y es el envoltorio del contenido (11
      hijos en OSA MAYOR, 15 en Micelium); el atajo del blog ya confía en él.
      **Por qué no lo hice solo:** cambia una tienda en producción sin que nadie lo pida —
      el `viendo_ahora` de Micelium empezaría a aparecer en la portada al día siguiente.
      Decisión de Nahuel: se aplica, o se deja y los widgets de tienda se acotan a fichas.

> **Puerta de salida:** un widget visible en su tienda, con su métrica contando en su base.

---

## Etapa 4 — Respaldos y avisos

**El stack de respaldo de Micelium no cubre esta instancia.** Está armado alrededor de la
PC, el VPS y la base de Micelium. Una base nueva de Supabase nace **sin respaldo**.

Va después de instalar porque antes no hay nada que perder — y antes de dar el proyecto por
cerrado porque después ya hay reseñas y fotos de clientes reales adentro.

- [x] 🤖 **Script de dump propio escrito.** `~/.claude/backup_osamayor.sh` — `pg_dump`
      semanal, con las defensas que hacen que un backup sea de verdad: escribe a `.parcial`
      y renombra al final, rechaza dumps de menos de 10 KB, verifica el gzip con `gzip -t`,
      rota a 90 días borrando los viejos **después** de confirmar que el nuevo está sano.
      `--no-owner --no-acl` para que se pueda restaurar en otra base con otro usuario.
      Hecho 28/08/2026. **Falta instalarlo en el VPS** (ver abajo).
- [x] 🤖 **Vigilancia enganchada.** `backup_watchdog.py` (ya corría lunes 9:00 en el VPS)
      tiene un tercer grupo, "Base de Osamayor", umbral **10 días** — el más corto, porque
      su dump es automático y semanal. El mail de alerta ahora explica que es un cron del
      VPS y dónde mirar el log. Hecho 28/08/2026. **Falta subir el archivo al VPS.**
- [ ] 👤 **Instalar el dump en el VPS.** Tres pasos:
      1. `scp ~/.claude/backup_osamayor.sh root@100.117.45.81:/root/scripts/` y `chmod +x`
      2. Guardar la connection string en `/root/.claude/osamayor-db` (`chmod 600`).
         **⚠️ Puerto 5432, NO 6543.** El 6543 es el pooler en transaction mode —el que usa
         la app— y `pg_dump` no funciona ahí. Va la conexión directa: en Supabase,
         Settings → Database → Connection string → URI. El script avisa si detecta 6543.
      3. `crontab -e` → `30 4 * * 1 /root/scripts/backup_osamayor.sh >> /var/log/backup_osamayor.log 2>&1`
      Además subir el `backup_watchdog.py` actualizado, y verificar que `pg_dump` del VPS
      sea de versión >= la del servidor (Supabase corre PG 15/16).
- [ ] 👤 **Backups nativos de Supabase** en su proyecto, con retención declarada. Es la
      primera línea; el dump propio es la segunda.
- [ ] 🤝 **Probar la restauración una vez.** Un backup no probado no es un backup.
      Restaurar el dump en una base descartable y ver que las tablas están.
- [ ] 👤 **Sus credenciales al paquete cifrado** (`backup_rescate.ps1` arma el `.7z` desde
      `~/.claude/`), o documentar dónde viven y por qué no están ahí. Necesita la passphrase.
- [ ] 🤝 **Decidir qué pasa con las fotos de reseñas.** Están como URL dentro del dump, pero
      el archivo vive en Vercel Blob. Son contenido de clientes reales. La decisión es tuya;
      el script lo hago yo.
- [ ] 🤖 **Que su heartbeat de crons avise a algún lado.** Hoy el aviso va a Micelium; su
      cron de Google puede morir en silencio.
- [ ] 👤 **Verificar que la contraseña del panel es distinta** a la de Micelium.
- [ ] 👤 **Confirmar que las variables de base NO quedaron habilitadas en Preview.**

> **Puerta de salida:** su base tiene backup probado, y si algo deja de correr, alguien se
> entera.

---

## Etapa 5 — Que desplegar dos veces no se olvide

El punto flojo de esta arquitectura es humano. **No es opcional.**

- [x] 🤖 Su despliegue sale de la **misma rama**, automático. **Ya estaba configurado** y se
      comprobó en vivo el 30/08: un push a `master` levantó build en las dos instancias sin
      tocar nada, y el `mic.js` nuevo apareció servido tanto en `osamayor-nine.vercel.app`
      como en `mw-micelium.vercel.app`. Osamayor tarda ~1 min, Micelium ~3.
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
