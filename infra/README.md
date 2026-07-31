# infra — lo que corre fuera de Vercel

Estos archivos **no los ejecuta la app**. Se copian a mano a la máquina que corresponde.
Están versionados acá porque hasta el 31/07/2026 vivían sueltos en el VPS y en la PC, sin
historial ni forma de revisarlos: si alguno se perdía, había que reconstruirlo de memoria.

La copia que manda es **la de la máquina**. Este directorio es el respaldo revisable, no la
fuente de despliegue — no hay nada que sincronice automáticamente. Al cambiar algo acá,
copiarlo a mano y verificarlo corriendo.

## `vps/run_job.sh` → `/root/.claude/run_job.sh`

Envuelve un job del cron para que reporte a `/api/jobs/ingest` cómo le fue.

```
run_job.sh <slug> -- <comando...>
```

Dos reglas que no se tocan: nunca cambia el resultado del job (sale con su mismo código y
la salida sigue yendo al log de siempre), y un fallo al reportar nunca voltea el job.

Necesita `jq` instalado.

## `vps/envolver_crontab.py` → `/root/.claude/envolver_crontab.py`

Reescribe el crontab envolviendo cada job. Sin argumentos hace un ensayo y no toca nada;
con `--aplicar` escribe y deja backup en `/root/.claude/crontab.antes-wrapper-<fecha>`.

Es idempotente: una línea ya envuelta se deja como está, así que se puede correr de nuevo
después de agregar jobs nuevos.

**La trampa que ya costó una restauración**: casi todas las líneas son
`cd /root/.claude && python3 x.py`. Si el comando no se pasa entero a `bash -c`, el shell
del cron parte en el `&&`: el wrapper recibe solo el `cd` —que sale 0 y se reporta como
éxito— y el script real corre suelto, fuera de la medición y sin directorio de trabajo.
O sea: todos los jobs rotos y el panel diciendo que todo anda bien.

## `windows/heartbeat_tareas.ps1` → `%USERPROFILE%\.claude\heartbeat_tareas.ps1`

Reporta el resultado de las tareas programadas de Windows. Es un **reportero**, no un
wrapper: el Programador de tareas ya guarda la última corrida y su código, así que
envolver duplicaría lo que el sistema hace solo.

Lo dispara la tarea `Micelium-Heartbeat-Tareas` cada 30 minutos.

Distingue **"no llegó a correr"** (`0x800710E0`, la PC estaba suspendida o a batería) de
**"corrió y falló"**. Solo lo segundo cuenta como error: si una PC de escritorio apagada
pintara todo de rojo, el rojo dejaría de significar algo.
