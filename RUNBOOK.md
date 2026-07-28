# Runbook — motor-whatsapp

Qué hacer cuando algo se rompe. Escrito para que lo pueda seguir alguien que no construyó
esto: hoy el bus factor es 1, y el sistema le manda mensajes a clientes reales.

**Producción**: `mw-micelium.vercel.app` (proyecto Vercel `mw-micelium` — hay otros cinco
con nombres parecidos, no son ese).
**Base**: Supabase, vía pooler.
**Panel**: `mw-micelium.vercel.app/dashboard` (contraseña: `DASHBOARD_PASSWORD`).

---

## Lo primero, siempre

1. **¿Está caído todo o una parte?** Abrir `mw-micelium.vercel.app/guia` — es público y no
   toca la base. Si carga, el deploy está vivo y el problema es más abajo.
2. **Mirar los logs**: Vercel → proyecto `mw-micelium` → Logs. Los logs propios salen en
   JSON con un campo `ambito` (`wa`, `cola`, `cron`): filtrar por ahí.
3. **Mirar el mail diario** de `resumen-bot`: si hay algo mal con la cola, los crons o el
   gasto de Claude, ya avisó.

---

## Frenar los envíos (el botón de pánico)

Si el bot o las automatizaciones están mandando algo que no deberían, **lo más rápido es
sacarles la credencial**, no revertir el deploy.

- **Frenar TODOS los crons** (carrito abandonado, reseñas, ciclo de cultivo): en Vercel,
  borrar o cambiar la variable `CRON_SECRET`. Todas las rutas `/api/cron/*` pasan a
  responder 401 y ninguna hace nada. Falla cerrado a propósito.
- **Frenar el bot de WhatsApp**: borrar `WHATSAPP_TOKEN`. El webhook sigue recibiendo pero
  no puede enviar. (Borrar `WHATSAPP_APP_SECRET` es peor: en producción rechaza todo webhook
  con 503, y Meta reintenta y puede degradar la calidad del número.)
- **Frenar la secuencia de mails a leads**: poner `LEADS_NURTURE_ENABLED` en algo distinto
  de `1`.

Los cambios de variables en Vercel **requieren un redeploy** para tomar efecto.

---

## Revertir un deploy

Vercel → Deployments → buscar el último que andaba → **Promote to Production**.
Es instantáneo y no toca la base.

**OJO**: si el deploy incluía una migración, revertir el código NO revierte la base. Ver
abajo.

---

## Síntomas y qué hacer

### "No salen los mensajes de carrito abandonado"

1. ¿Corrió el cron? El cron lo dispara **el VPS**, no Vercel. Si el VPS está caído, no corre
   nada — y desde el bloque A eso llega por mail ("Crons sin reportar").
2. ¿Se están agotando? El mail diario reporta "agotados": son mensajes que fallaron 5 veces
   y ya no se reintentan. La causa suele estar en `error_details` de esas filas.
3. ¿Hay filas encoladas sin salir?
   ```sql
   select estado, count(*) from "MessageLog"
    where tipo_evento = 'checkout/abandoned' group by estado;
   ```
4. **Causa clásica**: el token de WhatsApp venció. Los envíos quedan FAILED con un error de
   autenticación de Meta.

### "El bot no contesta en WhatsApp"

1. ¿Llegan los webhooks? Logs de Vercel, filtrar `ambito: "wa"`. Si hay
   `webhook rechazado`, el problema es la firma: `WHATSAPP_APP_SECRET` no coincide con el de
   la app de Meta.
2. ¿Está derivado a una persona? Tras una derivación, el bot calla 6 horas a propósito.
3. ¿Se acabó el cupo de Claude? Los topes de `/api/asistente` cortan y devuelven el WhatsApp
   humano.

### "El panel pide contraseña y no entra / da 503"

`DASHBOARD_PASSWORD` falta o cambió. Si falta, en producción devuelve 503 a propósito: es
preferible un panel caído a un panel abierto.

### "Todo da error de base"

1. Supabase → ¿el proyecto está pausado o sin espacio?
2. ¿Se tocó `DB_SSL_STRICT`? Si se puso en `1` y la cadena de certificados no valida, **toda
   consulta falla**. Sacarlo es la reversa inmediata.
3. Las conexiones se agotan si algún deploy agregó un pool nuevo: tienen que salir todos de
   `lib/db.ts`.

---

## Migraciones

```bash
npx prisma migrate deploy    # aplica las pendientes
```

**Orden con el deploy**: la migración va **primero**, el código después. El código nuevo usa
columnas que la migración crea; al revés, el código viejo simplemente ignora las columnas
nuevas y sigue andando.

**Revertir una migración no es automático.** Prisma no genera el "down". Si una migración
rompió algo, la salida es restaurar el backup de Supabase (Database → Backups) o escribir el
SQL inverso a mano. Por eso las migraciones se leen antes de aplicarlas.

---

## A quién avisar

Nahuel — es el único que conoce el sistema. Los avisos automáticos ya le llegan por mail,
Telegram y WhatsApp (`lib/notify.ts`).

Si Nahuel no está disponible y hay clientes afectados: **frenar los envíos** (arriba) es
siempre preferible a improvisar un arreglo. Un sistema callado se explica; uno que le manda
mensajes equivocados a clientes, no.
