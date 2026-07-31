#!/bin/bash
# Envuelve un job del cron para que reporte cómo le fue.
#
#   run_job.sh <slug> -- <comando...>
#
# POR QUÉ UN WRAPPER Y NO TOCAR LOS SCRIPTS
#
# Son 36 jobs. Instrumentarlos uno por uno es 36 oportunidades de introducir un bug en
# código que hoy funciona, y 36 lugares donde mantener la misma lógica. Envolviendo, el
# cambio es una línea por job en el crontab y los programas quedan intactos.
#
# POR QUÉ EL EXIT CODE Y NO EL LOG
#
# Hasta ahora lo único que había era el mtime del .log de cada job. Eso dice que el proceso
# escribió algo, no que haya terminado bien: un script que explota igual deja su excepción
# en el log y actualiza la fecha. El exit code no se puede fingir.
#
# REGLAS QUE NO SE NEGOCIAN
#
#  1. El wrapper NUNCA cambia el resultado del job. Sale con el mismo código que el comando
#     envuelto, y la salida sigue yendo a stdout tal cual (el crontab la redirige a su log
#     como siempre).
#  2. Un fallo al reportar NO puede voltear el job. El curl va con timeout corto y su error
#     se traga: medir es menos importante que el trabajo que se está midiendo.

set -uo pipefail

SLUG="${1:-}"
shift || true
[ "${1:-}" = "--" ] && shift

if [ -z "$SLUG" ] || [ $# -eq 0 ]; then
  echo "uso: run_job.sh <slug> -- <comando...>" >&2
  exit 2
fi

ENDPOINT="https://mw-micelium.vercel.app/api/jobs/ingest"
SECRETO="micelium-cron-2026"

SALIDA=$(mktemp)
INICIO=$(date +%s%3N)

# La salida se duplica: sigue yendo a stdout (para el log del crontab) y además se guarda
# para poder mandar el final. PIPESTATUS preserva el código del comando, no el del tee.
"$@" 2>&1 | tee "$SALIDA"
CODIGO=${PIPESTATUS[0]}

FIN=$(date +%s%3N)
DURACION=$((FIN - INICIO))

# Solo las últimas líneas: alcanza para ver el error y evita mandar megabytes de log.
# En un job que anduvo bien no interesa el detalle, así que va vacío.
if [ "$CODIGO" -eq 0 ]; then
  DETALLE=""
else
  DETALLE=$(tail -c 1500 "$SALIDA")
fi
rm -f "$SALIDA"

# jq arma el JSON: escapar a mano el detalle (comillas, saltos de línea, backslashes de un
# traceback de Python) es una fuente de bugs garantizada.
CUERPO=$(jq -nc \
  --arg slug "$SLUG" \
  --arg detalle "$DETALLE" \
  --argjson code "$CODIGO" \
  --argjson dur "$DURACION" \
  '{slug:$slug, origen:"vps", exit_code:$code, duracion_ms:$dur, detalle:$detalle}')

curl -sS -m 20 -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $SECRETO" \
  -H 'Content-Type: application/json' \
  -d "$CUERPO" >/dev/null 2>&1 || true

exit "$CODIGO"
