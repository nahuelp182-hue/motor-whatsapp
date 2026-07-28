# Plan de correcciones — motor-whatsapp

Auditoría del 27/07/2026. Estado: **plataforma interna de Micelium**, no SaaS vendible.
Los bloques A a F valen la pena aunque nunca haya un segundo tenant. El bloque G solo se
hace si aparece quien pague.

---

## Reglas del plan

**Cadencia: un bloque por semana, en huecos.** No en serie. Leído de corrido esto parece
un mes de ingeniería interna, y en un negocio que vive de adquisición (recompra 4,9%) un
mes sin empujar el frente comercial es la decisión más cara del plan. Seis semanas de
calendario sin comerse ninguna semana de negocio. El bloque A entra igual esta semana:
es el que saca el riesgo vivo.

**Timebox: 1,5× el estimado.** Si un bloque se pasa de ahí, se para, se anota qué faltó y
se sigue con el próximo. Los bloques son independientes salvo C, así que abandonar uno a
medias cuesta poco. El candidato natural a desbordarse es C.

**Reversa: cada bloque anota cómo se vuelve atrás** antes de empezar. El único que la
necesita en serio es F (migración del bot en vivo), y ahí la reversa es el dual-write.

**Métrica de éxito del plan entero:** qué proporción de incidentes descubrís vos vs. te
avisa una alerta. Hoy es 100% vos. A los tres meses del bloque E debería estar invertida.
Es la capacidad que se compra: no escala, sino que el sistema funcione sin que lo mires.

**Horas:** trabajo efectivo, no calendario.

---

## Bloque A — Medir, limpiar y tapar el agujero del VPS (~4 h)

Cero riesgo: no toca ninguna ruta viva. Mezcla lectura con dos limpiezas obvias.

- [x] **`CLAUDE.md` del repo con las trampas verificadas.** Hecho 27/07.
- [x] Inventario de crons: 9 rutas de cron en total. `vercel.json` declara 5
      (`send-pending`, `resumen-bot`, `radar`, `sync-calendario`, `ciclo-cultivo`), todas
      diarias. Las otras 4 (`carrito-abandonado`, `resena-post-entrega`, `andreani`,
      `instalar-widgets-tn`) las dispara el VPS — confirmado por comentario en el propio
      código, no son un supuesto.
- [ ] **Confirmar plan de Vercel** (Hobby vs Pro). No se pudo determinar por CLI — hace
      falta mirar el dashboard: `vercel.com/<team>/~/settings/billing`. En Hobby, máximo 2
      cron jobs y 1 vez/día; si es así, varios de los 5 declarados en `vercel.json` no están
      corriendo. **Pendiente, con impacto directo en el bloque B.**
- [x] **Heartbeat de crons.** Implementado: tabla `CronHeartbeat`
      (`prisma/migrations/20260727130000_cron_heartbeat/`), helper `lib/cron-heartbeat.ts`
      (`marcarHeartbeat` / `chequearHeartbeats`), wireado en los 6 crons periódicos
      (`carrito-abandonado`, `resena-post-entrega`, `send-pending`, `radar`,
      `sync-calendario`, `ciclo-cultivo`, `resumen-bot`). El chequeo se enganchó a
      `resumen-bot` en vez de crear un cron nuevo: mientras no esté confirmado el plan de
      Vercel, un cron nuevo podría no llegar a correr nunca. Dispara `notifyNahuel` con la
      lista de crons vencidos, aunque no haya actividad del bot ese día.
      **Falta aplicar la migración contra producción** (`npx prisma migrate deploy`, desde
      un entorno con `DATABASE_URL` real) — no se puede hacer desde acá sin el secreto.
- [ ] **Tabla de vencimientos**: tokens, keys SSH y certificados. Empezar por el token de
      Meta Ads, que según el `CLAUDE.md` global vencía el 2026-06-12. Pendiente — necesita
      revisar Business Manager, no es verificable por código.
- [x] **Borrar lo muerto.** Revisado con grep antes de tocar nada: `/api/debug-perf` y
      `/api/webhooks/instagram/debug` no tenían ninguna referencia → borrados, junto con
      `scratch_msglog.mjs`. **Corrección sobre la lista original**: `/api/performance` y
      `/api/sales-cadence` SÍ están vivos — los consume el dashboard
      (`components/PerformanceSection.tsx`, `components/SalesCadence.tsx`). No se tocan.
- [ ] Tier actual de WhatsApp Cloud API y calidad del número. Se revisa en Meta Business
      Manager → cuenta de WhatsApp → esa tienda. No es consultable por código sin un token
      con el permiso adecuado.
- [ ] Tamaño de `ig_diag`, `Visit`, `Visitor`, `WidgetEvent`, `MessageLog`. **Bloqueado**: el
      pull de env vars de Vercel devuelve los secretos redactados (`[SENSITIVE]`) desde este
      entorno — correcto por seguridad, pero significa que este chequeo lo tenés que correr
      vos. Comando abajo.
- [ ] Backup automático de Supabase: frecuencia y retención. Se revisa en el dashboard de
      Supabase → Database → Backups.
- [x] **Las variables `DB_*` de Vercel SÍ están habilitadas para Preview** (confirmado con
      `vercel env ls`): `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DATABASE_URL` y
      **`CRON_SECRET`** están en Production + Preview (`DATABASE_URL` y `CRON_SECRET`
      también en Development). Esto **ya no es una hipótesis**: cualquier preview build o
      rama de PR pega contra la base de producción, y con `CRON_SECRET` disponible ahí un
      preview podría disparar los crons de verdad. `WHATSAPP_TOKEN` y
      `WHATSAPP_APP_SECRET` sí están limitados a Production — el envío de WhatsApp desde un
      preview fallaría, pero la escritura en la base real no. Sube la prioridad del primer
      ítem del bloque B.
- [ ] Costo del bot por conversación, desde `claude_usage`. Pendiente — mismo bloqueo que
      el tamaño de tablas.
- [ ] Volumen actual: mensajes/mes, pedidos/mes, visitantes/mes. Pendiente, mismo motivo.

**Salida:** parcial. Código muerto fuera, heartbeat implementado (falta desplegar la
migración), y un hallazgo confirmado que cambia la urgencia del bloque B. Los números que
necesitan el dashboard de Vercel/Supabase/Meta o secretos de producción quedan para vos —
comandos al final del documento.

---

## Bloque B — Red de seguridad (~6 h)

Va segundo porque todo lo que sigue modifica caminos de producción. Hacerlo con el código
quieto es la póliza más barata del plan.

- [x] **CI en GitHub Actions.** `.github/workflows/ci.yml`: typecheck + tests bloquean el
      merge. Lint corre pero con `continue-on-error` — hay 18 errores preexistentes en
      código de la app (links `<a>` en vez de `next/link`, `setState` síncrono en efectos,
      un `any`) que no son de esta sesión y tocan muchos archivos ajenos al plan; bloquear
      por ellos ahora frenaría cada PR, no solo los que los tocan. Sacar `continue-on-error`
      cuando se limpien aparte. El chequeo de drift de migraciones está condicionado a que
      exista el secret `DATABASE_URL` en GitHub — **falta cargarlo**:
      Settings → Secrets and variables → Actions → New repository secret.
- [x] **Tests de regresión de `verificarFirmaMeta` y `chequearCron`.**
      `tests/meta-signature.test.ts` (7 tests: firma válida, sin firma, formato inválido,
      firma de otro secreto, cuerpo alterado, fail-closed en producción, fail-open fuera de
      producción) y `tests/cron-auth.test.ts` (5 tests, incluye fail-closed sin
      `CRON_SECRET`). Suite completa: 36/36 verdes.
- [ ] Base separada para previews (branch DB de Supabase o proyecto aparte). **Urgente**,
      confirmado arriba que hoy los previews escriben en la base real.
- [ ] Backup de Supabase verificado con restore de prueba. Pendiente, acción manual.
- [ ] Decidir: crons a Vercel Pro o quedan en el VPS con el heartbeat del bloque A.
      Depende de la confirmación del plan de Vercel (bloque A, pendiente).

**Salida:** CI corriendo y bloqueando por typecheck/tests (ver en GitHub tras el próximo
push); tests de seguridad en verde. Falta lo que requiere acceso a dashboards.

---

## Bloque C — Un solo camino al dato (~8 h)

Bloquea todo lo que viene. Sin esto cada arreglo posterior se bifurca. Es el candidato a
desbordar el timebox: si a las 12 h no cerró, parar y anotar.

- [ ] Unificar la conexión: runtime (`DB_HOST`/`DB_USER`/`DB_PASSWORD`) y migraciones
      (`DATABASE_URL`) al mismo lugar por el mismo camino. **Pendiente y bloqueado**: es
      diagnóstico puro —hay que probar por qué `DATABASE_URL` no conecta en runtime— y sin
      acceso a la base real cualquier cambio acá se hace a ciegas sobre el camino por el que
      pasa *toda* consulta. Es el ítem que justifica el timebox del bloque.
- [x] **Un solo pool `pg`.** Corrección de la auditoría: no eran dos, **eran seis**
      (`lib/prisma.ts`, `lib/diag.ts` y cuatro copias literales pegadas en
      `app/api/claude-usage`, `app/api/conversaciones`, `app/api/cron/radar` y
      `app/api/cron/resumen-bot`), cada una con `max: 1`. Una lambda que tocara varios
      módulos abría una conexión por módulo. Ahora hay una sola definición en `lib/db.ts` y
      quedan **dos** pools: el compartido y el de Prisma.
- [~] **El pool de Prisma sigue aparte, a propósito.** Compartirlo con `max: 1` haría que
      una consulta cruda y una de Prisma se esperen entre sí; ese cambio necesita medirse
      contra producción. Es el cierre del bloque, junto con el ítem de arriba.
- [~] **`ssl: { rejectUnauthorized: false }`** → ahora es `DB_SSL_STRICT === '1'` en los dos
      pools. No se encendió: si la cadena de certificados no valida, se cae **toda** consulta
      en producción. El interruptor existe para probarlo primero en un preview con base
      propia (Bloque B) y recién después en producción.
- [ ] Adoptar en `schema.prisma` las 5 tablas que hoy viven solo en producción: `ig_diag`,
      `wa_procesado`, `claude_usage`, `radar_snapshot`, `radar_youtube`. **Bloqueado**:
      requiere `prisma db pull` contra la base real. Escribir los modelos a mano desde las
      queries sería adivinar tipos y defaults, y un modelo equivocado es peor que ninguno
      —Prisma generaría migraciones para "corregir" una tabla que en realidad está bien.
- [ ] Retirar `scripts/aplicar-sql.js`. Va junto con el ítem anterior: mientras las 5 tablas
      no estén en el schema, ese script sigue siendo la única forma de tocarlas.
- [x] **Integridad del esquema.** Migración `20260727140000_integridad_esquema`:
      FK `WidgetLead` → `Widget` con `ON DELETE CASCADE`; `Coupon.codigo` único por tienda
      (era global: con dos tiendas, la primera en usar un código se lo bloqueaba a la otra);
      `store_id` en `gads_cache`, nullable, con backfill que **solo corre si hay exactamente
      una tienda**; índice `Visitor(store_id, email)` para el cosido de compras.
      `schema.prisma` actualizado en paralelo para que no quede marcado como drift.
- [x] **Una sola fuente para el `phone_number_id`.** Era el tercer dato con dos verdades:
      `CampaignService` lo leía de `campaign.configuracion`, el webhook y
      `/api/conversaciones/responder` del entorno — el bot podía contestar desde un número y
      el carrito abandonado escribir desde otro. Ahora pasa por
      `phoneNumberIdWhatsApp()` en `lib/credenciales.ts`, mismo criterio que los tokens
      (entorno para la tienda propia, config como respaldo), con 4 tests nuevos.
- [x] **README real.** Reescrito: cómo levantarlo, tabla de variables de entorno críticas,
      comandos de migración, y el mapa de crons.

**Salida:** parcial. Lo que era refactor verificable está hecho (6 pools → 2, tercera
credencial unificada, integridad del esquema, README). Lo que requiere la base real
—diagnóstico de la conexión, adopción de las 5 tablas, encender SSL estricto— queda
explícitamente pendiente en vez de hecho a ciegas.

**Pendiente de aplicar**: `npx prisma migrate deploy` con `DATABASE_URL` de producción, para
las migraciones `20260727130000_cron_heartbeat`, `20260727140000_integridad_esquema` y
`20260727150000_cola_envios`. Si la de integridad falla, es porque hay `WidgetLead`
huérfanos de antes — la propia migración trae la consulta para inspeccionarlos y hace
rollback sola, sin dejar nada a medias.

---

## Bloque D — La cola de envíos, de verdad (~6 h)

El único hallazgo con riesgo corriendo hoy. Va cuarto por concesión deliberada: necesita
migraciones confiables. Mitigación mientras tanto: no correr el cron dos veces en paralelo.

Hallazgo al abrirlo: `error_details` no cargaba dos significados sino **tres** — el payload
de la cola, una marca de idempotencia (`order:<id>`, consultada con `contains` desde
`CampaignService`) y el mensaje de error real. Esta pasada separó el primero; la marca queda
donde está a propósito, porque moverla implica reescribir las consultas `contains` y eso es
un cambio con su propio riesgo, no un efecto colateral de éste.

- [x] **Columna `payload` propia** en `MessageLog` (migración `20260727150000_cola_envios`),
      con backfill de las filas PENDING existentes. El backfill solo toca lo que parsea como
      objeto JSON: las marcas y los mensajes de error se quedan donde están.
- [x] **Columnas `intentos` y `bloqueado_hasta`**: backoff exponencial 2→4→8→16 minutos con
      techo, y tope de 5 intentos. El techo es deliberado: un carrito abandonado hace tres
      horas ya no se recupera, esperar horas entre reintentos no compra nada.
- [x] **Toma de trabajo con `FOR UPDATE SKIP LOCKED`** en una sola sentencia atómica
      (`tomarLote` en `lib/cola-envios.ts`): la corrida que llega segunda saltea las filas
      tomadas en vez de duplicarlas.
- [x] **`ORDER BY scheduled_for ASC`**: con backlog salen primero los más viejos, en vez de
      quedar filas rezagadas para siempre.
- [~] **Idempotencia**: cubierto el caso que estaba vivo (dos corridas solapadas). Queda
      abierta la ventana entre "se envió" y "se marcó SENT": si el proceso muere justo ahí,
      el mensaje se reintenta. Cerrarla del todo requiere promover la marca `order:<id>` a
      columna propia con índice único — el cambio que se dejó fuera de alcance arriba.
      Mitigación actual: `handleAbandonedCart` ya no encola si hay un PENDING o SENT del
      mismo cliente en 48 h.
- [x] **La cola muerta es visible.** El dashboard no dibuja mensajes fallidos en ninguna
      parte (`/api/metrics` los cuenta, nadie los muestra), así que en vez de una página
      nueva el resumen va al **mail diario** de `resumen-bot`: pendientes, agotados en 24 h y
      cuánto espera el más viejo. Avisa solo cuando hay algo mal.
- [x] **Tests**: `tests/cola-envios.test.ts`, 10 casos sobre backoff y lectura de payload —
      incluido el que impide confundir una marca `order:1598` con un payload y mandarle un
      mensaje vacío a un cliente. Suite total: 50.

**Salida:** el doble envío por corridas solapadas está cerrado. **Verificación pendiente**,
porque necesita la base real: correr el cron dos veces en paralelo a propósito y confirmar
que ningún mensaje sale duplicado. `FOR UPDATE SKIP LOCKED` no se puede probar con un mock —
requiere dos conexiones concurrentes contra Postgres.

---

## Bloque E — Ver lo que pasa (~7 h)

Después de D a propósito: instrumentar antes sería alertar sobre una cola que estás por
cambiar de forma.

- [x] **Log estructurado** (`lib/log.ts`): salida JSON en una línea con `ambito`, `trace_id`
      y `store_id` en la raíz, que es lo que permite filtrar en Vercel en vez de leer todo.
      El `trace_id` reusa el `x-vercel-id` de la plataforma cuando existe, así el log propio
      y el de Vercel se cruzan solos. Cableado en los dos caminos que importan: el rechazo de
      firma del webhook de WhatsApp (un pico ahí es un secreto rotado a medias, o alguien
      probando la URL) y la cola de envíos, donde un mensaje agotado se loguea como `error`
      porque significa que a ese cliente no le llegó nada. 9 tests.
- [ ] **Error tracking (Sentry).** Pendiente: necesita una cuenta y un DSN, que no se pueden
      crear desde acá. Mientras tanto el log estructurado hace que los logs de Vercel sean
      consultables, y las alertas de abajo cubren lo que no puede esperar a que alguien mire.
- [x] **Tres alertas accionables**, todas al mail diario de `resumen-bot`, que es el que se
      lee de verdad:
      **(1)** cola con problemas — agotados en 24 h o el más viejo esperando > 3 h (hecho en
      el bloque D); **(2)** crons que dejaron de reportar (bloque A); **(3)** gasto de Claude
      sobre el tope. La tercera es nueva y cubre un hueco real: los topes de `/api/asistente`
      cuentan *requests*, no dólares, y una conversación larga cuesta varias veces lo que una
      pregunta suelta — el volumen puede parecer normal mientras el costo se dispara.
      **El umbral (`CLAUDE_TOPE_USD_DIA`, default 5) está puesto a ojo y hay que ajustarlo**
      con el primer dato real: un umbral que nunca dispara es tan inútil como no tenerlo, y
      uno que dispara todos los días se vuelve ruido.
- [~] **`notify.ts` reusa el transporter SMTP**, pero **sin `pool: true`** — y eso significa
      que sigue habiendo una conexión SMTP por mail. La versión con pool reusa la conexión,
      que en un servidor de larga vida sería mejor; acá cada invocación es una lambda que se
      congela al responder, así que un socket esperando el próximo mail cuelga de un proceso
      que puede no despertar, y el modo de falla es un aviso que no sale. Romper el canal de
      alertas mientras se construye el sistema de alertas es el peor intercambio posible.
      Se ahorra la creación del objeto, nada más. Es aceptable porque el diseño manda pocos
      mails —solo cuando algo está mal—; si el volumen llegara a importar, la solución es
      agrupar avisos, no reusar sockets.
- [x] **Runbook de rescate** → [`RUNBOOK.md`](./RUNBOOK.md). Lo importante no es el listado
      de síntomas sino el **botón de pánico**: frenar los envíos sacando `CRON_SECRET` o
      `WHATSAPP_TOKEN` es más rápido y más seguro que revertir un deploy, y lo puede hacer
      alguien que no entiende el código. Incluye por qué NO conviene borrar
      `WHATSAPP_APP_SECRET` (Meta reintenta contra el 503 y puede degradar la calidad del
      número) y la advertencia de que revertir el código no revierte una migración.

**Salida:** parcial pero funcional. Las tres alertas están y llegan solas; falta el error
tracking, que es el que atrapa lo que nadie previó. **Verificación pendiente**, misma razón
que siempre: matar el token de WhatsApp a propósito y cronometrar cuánto tarda en avisar.

**Corrección de una consulta que había dejado mal**: la columna de fecha de `claude_usage`
es `ts`, no `synced_at` (verificado contra `app/api/claude-usage/route.ts`). La lista de
pendientes de abajo ya está corregida.

---

## Bloque F — Conversaciones y retención (4-5 días)

El techo de escala y la exposición legal, en el mismo trabajo. Reestimado: la versión
anterior (2-3 días) asumía un corte limpio que no existe.

- [ ] Modelos `Conversation` y `Message` con índices reales. Hoy el historial, el dedupe, el
      handoff lock y el debounce salen de `ig_diag` con `detail->>'campo'` sin índice.
- [ ] **Dual-write obligatorio.** El bot está en producción atendiendo clientes: se escribe
      en las dos tablas, se lee de la nueva, y recién cuando coinciden se corta. Sin esto,
      durante la migración un cliente puede recibir dos respuestas o el bot pierde el hilo a
      mitad de conversación. La reversa del bloque es dejar de leer la tabla nueva.
- [ ] `ig_diag` vuelve a ser lo que su nombre dice: un log.
- [ ] Política de retención escrita y aplicada: cuánto se guarda cada cosa.
- [ ] Borrado a pedido de un titular (Ley 25.326): que el procedimiento exista y funcione.

**Salida:** un mensaje entrante no dispara ningún escaneo secuencial, y podés borrar todo lo
de una persona con un comando.

---

## En cualquier hueco (~4 h sueltas)

- [ ] Minificar `mic.js`. Pesa 133 KB sin minificar y se sirve en cada ficha de producto: es
      conversión, no solo técnica. **No se hizo a ciegas**: se sirve en la tienda real y el
      cambio de nombre de archivo obligaría a re-registrar el script en el Portal de
      Partners de Tiendanube. Necesita verificar en vivo.
- [ ] Partir `dashboard/page.tsx` (1038 líneas). **No se hizo a ciegas**: el dashboard no
      levanta en local, así que un refactor "cosmético" acá no se puede comprobar.
- [x] ~~ADRs de las decisiones ya tomadas.~~ **Descartado a propósito.** `credenciales.ts`,
      `ratelimit.ts`, `session.ts` y `cola-envios.ts` ya explican el porqué de cada decisión
      en el punto de uso, que es donde se leen. Moverlas a `docs/adr/` las alejaría del
      código y crearía dos versiones que se desincronizan. Va contra la regla del loop: si no
      lo va a leer el que trabaja, no se escribe.
- [x] ~~Drift de comentarios: `send-pending` dice "cada 5 minutos", `vercel.json` dice
      `0 8 * * *`.~~ Anotado en el propio archivo (27/07): no se resolvió cuál de los dos es
      la intención real porque es una decisión de negocio (¿el recupero de carrito necesita
      correr cada 5 min, o una vez al día alcanza?), no una corrección de código.
- [ ] Quitar `ACEPTAR_FIRMA_LEGADO` de `session.ts` después del 15/08/2026.

---

## Bloque G — Solo con un segundo tenant que pague

La línea entre cimientos y desarrollo especulativo.

- [ ] Cifrado en reposo de los tokens de terceros. La puerta única ya existe
      (`lib/credenciales.ts`); falta el cifrado.
- [ ] `User` / `Membership` / roles. Hoy hay una `DASHBOARD_PASSWORD` compartida, sin
      trazabilidad de quién hizo qué.
- [ ] RLS en Postgres como red bajo la tenancy.
- [ ] Onboarding OAuth que dé de alta un `Store` de verdad. Hoy el callback hace `updateMany`
      sobre una tienda que ya tiene que existir: nunca hizo falta crear una.
- [ ] Planes, medidor de uso, facturación.
- [ ] Decidir si el SaaS se separa del repo interno. Hoy conviven ~7 productos.

---

## Loop de aprendizaje

Para que las mismas lecciones no se paguen dos veces. La jerarquía importa más que el
contenido:

| Nivel | Forma | Falla cuando |
|---|---|---|
| **0** | El error se vuelve **imposible** (chequeo en CI, tipo, puerta única) | Nunca |
| **1** | Default correcto en el código, con el porqué al lado | Alguien lo rodea a propósito |
| **2** | Regla escrita donde se trabaja (`CLAUDE.md`, ADR) | Nadie la lee |
| **3** | Acordarse | Siempre |

**Disparador 1 — cierre de bloque** (10 min, va como skill `/cierre`, con el contexto vivo
de la sesión):
1. ¿Qué me sorprendió? Si nada, no hay lección y termina acá.
2. ¿Se puede volver imposible? Si sí, esa es la única salida correcta y no se escribe nada.
3. Si no: ¿es trampa de este repo (`CLAUDE.md`) o patrón transversal (`~/.claude/memory`,
   nombrado por el patrón y no por el incidente)?

**Disparador 2 — incidente real** (5 líneas): qué pasó, cómo me enteré, por qué no lo
detectó una alerta, qué lo vuelve imposible. Las lecciones más densas no aparecen al cerrar
un bloque prolijo, aparecen cuando algo se rompe en vivo.

**Verificación en frío** — agente **Saac** (`~/.claude/agents/saac.md`, creado 27/07).
Agarra cada afirmación del `CLAUDE.md`, el README, el RUNBOOK y este plan, la contrasta
contra el código, y reporta las que quedaron obsoletas. Arranca en frío a propósito: su
valor está en no confiar en el contexto. Correrlo después de cada bloque que resuelva
trampas documentadas — que es justo cuando esta documentación queda vieja.

### Estado del loop (27/07)

- **Nivel 0 — hecho**: `tests/invariantes.test.ts` vuelve imposibles tres lecciones (un solo
  pool, todo cron autorizado, la cola no se lee sin tomarla). **En su primera corrida
  encontró un séptimo pool en `app/radar/page.tsx`** que dos revisiones a ojo no habían
  visto: es el argumento entero de la jerarquía en un caso.
- **Nivel 2 repo — hecho**: las trampas viven en `CLAUDE.md`, cada una con el bloque que la
  caduca.
- **Nivel 2 transversal — hecho**: tres patrones a memoria global, nombrados por el patrón y
  no por el incidente (migración-antes-que-deploy, dos-fuentes-de-verdad,
  serverless-no-reusar-sockets).
- **Ritual — hecho**: skill `/cierre`.
- **Verificación — hecho**: agente Saac.

**La señal a vigilar**: "un valor de configuración con dos fuentes de verdad" ya apareció
**tres veces** (tokens, `phone_number_id`, conexión a la base). Cuando una clase vuelve, la
salida no es documentar la tercera instancia sino buscar las que todavía no explotaron.

---

## Estado del repo (27/07) — OJO: hay trabajo concurrente

Durante estos bloques entraron **cinco commits de otra sesión** (bot WA, panel, KB) que
arrastraron `lib/db.ts` y `lib/log.ts` de este trabajo, probablemente por un `git add -A`.

Se verificó que el árbol commiteado es **coherente**: ningún archivo publicado importa
módulos sin commitear, y el `CampaignService` commiteado todavía NO escribe `payload`. O sea
que lo que ya esté desplegado no rompe nada.

Pero el estado es mixto: parte del trabajo está commiteada y parte no. **Antes de desplegar,
mirar qué hay realmente en `origin/master`**, no asumir.

**El riesgo concreto de la concurrencia**: si la otra sesión commitea y pushea
`prisma/schema.prisma` sin que las migraciones se hayan aplicado, producción rompe —Prisma
hace `SELECT` de todas las columnas del modelo, así que un schema adelantado tira *cualquier*
consulta a esa tabla, no solo las que usan la columna nueva. Conviene coordinar esto antes
que nada.

---

## Despliegue — la secuencia, en este orden

Se verificó a mano que **cada cambio de `schema.prisma` tiene su migración** (Coupon,
MessageLog, gads_cache, Visitor, WidgetLead, CronHeartbeat). La verificación mecánica es el
chequeo de drift del CI, que se activa recién con el paso 2.

```bash
# 1. Ver qué está commiteado y qué no
git status && git log --oneline origin/master -5

# 2. Commitear lo que falta (revisar el diff de las 3 migraciones antes)
git add -A && git diff --cached

# 3. Aplicar migraciones ANTES de que el código llegue a producción
npx prisma migrate deploy      # con DATABASE_URL de producción

# 4. Recién ahora, push (si hay auto-deploy, el push ES el deploy)
git push
```

**El orden 3→4 no es negociable.** El código nuevo lee y escribe `payload`; sin la columna,
el carrito abandonado deja de encolarse y el cron de envíos rompe en cada corrida. Al revés
es seguro: con las columnas creadas, el código viejo las ignora.

Si la migración de integridad falla, es por `WidgetLead` huérfanos previos: la propia
migración trae la consulta para inspeccionarlos y hace rollback sola.

---

## Pendientes que requieren correrlos vos (27/07)

Lo que quedó bloqueado porque necesita un dashboard o un secreto real, que este entorno no
puede leer (los valores vienen redactados a propósito):

1. **Verificar la cola sin duplicados** — es el criterio de salida del Bloque D, y es lo
   único que no se puede probar con un test: `FOR UPDATE SKIP LOCKED` necesita dos
   conexiones concurrentes de verdad.
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/send-pending &
   curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/send-pending &
   ```
   Una debería reportar `tomados > 0` y la otra 0 (o repartirse el lote). Ningún cliente
   recibe dos mensajes.

2. **Cargar el secret en GitHub** para que el CI chequee drift de migraciones:
   Settings → Secrets and variables → Actions → New repository secret → `DATABASE_URL`.

3. **Confirmar el plan de Vercel** (Hobby vs Pro): `vercel.com/<team>/~/settings/billing`.
   Cambia si conviene mover los crons del VPS a Vercel Pro (bloque B).

4. **Tamaño de tablas y antigüedad de `ig_diag`**, con el `.env.local` real:
   ```sql
   select relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) sz
     from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 25;
   select min(ts), max(ts), count(*) from ig_diag;
   ```

5. **Costo del bot y volumen** (la columna de fecha de `claude_usage` es `ts`, no
   `synced_at` — corregido tras verificarlo en el código):
   ```sql
   select min(ts), count(*), sum(cost_usd) from claude_usage;
   select channel, sum(cost_usd) from claude_usage
     where ts > now() - interval '30 days' group by channel;
   select count(*) from "MessageLog" where "createdAt" > now() - interval '30 days';
   ```
   El resultado del segundo define el valor de `CLAUDE_TOPE_USD_DIA` (ver abajo): hoy tiene
   un default puesto a ojo.

6. **Tier de WhatsApp Cloud API**: Meta Business Manager → WhatsApp Accounts → la cuenta →
   límite de mensajería.

7. **Vencimiento del token de Meta Ads**: Business Manager → esa cuenta de sistema, o
   `GET /debug_token?input_token=<token>&access_token=<token>` contra la Graph API.

8. **Backup de Supabase**: dashboard de Supabase → Database → Backups. Frecuencia,
   retención, y hacer un restore de prueba una vez (bloque B).

**Regla que evita que el loop sea su propio desperdicio:** si no lo va a leer el que trabaja
—vos o Claude al arrancar— no se escribe. Documentación que nadie lee cuesta dos veces.

---

## Lo que NO se hace

Microservicios, Kubernetes, event bus dedicado, DDD completo, base por tenant,
multi-región, outbox transaccional, un agente por fase. A esta escala no compran nada y
cuestan mantenimiento.

---

## Orden

```
A (medir+limpiar) → B (red) → C (dato) → D (cola) → E (ver) → F (conversaciones)
                                    ↘ los sueltos: en cualquier hueco
G solo si aparece un segundo tenant
```

Bloques A a E: ~31 h, y ahí ya está cubierto todo lo que hoy puede fallar en silencio.
El bloque F es el que quita el techo de escala.
