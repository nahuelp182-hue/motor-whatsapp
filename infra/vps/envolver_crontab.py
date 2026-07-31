#!/usr/bin/env python3
"""Envuelve cada job del crontab con run_job.sh para que reporte cómo le fue.

Sin argumentos hace un ENSAYO: muestra qué quedaría y no toca nada. Con --aplicar
reescribe el crontab (dejando backup).

El slug sale del comando, no de una lista escrita a mano: una lista a mano se
desincroniza del crontab el primer día que alguien agrega un job, y un catálogo que
miente es peor que no tenerlo.
"""
import re
import shlex
import subprocess
import sys
from datetime import datetime

WRAPPER = '/root/.claude/run_job.sh'

# Sufijos que distinguen dos líneas del mismo script (el trabajo y su reporte).
BANDERAS = ['--reporte', '--semanal', '--descubrir', '--ingest', '--push', '--live', '--email']
# Subcomandos de ig_auto (publicar, proponer, confirmar, insights).
IG_SUB = ['publicar', 'proponer', 'confirmar', 'insights', 'render']


def slug_de(comando: str) -> str | None:
    """Nombre estable para un job, derivado de su comando. None = no envolver."""
    if WRAPPER in comando:
        return None  # ya envuelto: idempotente

    # Los curl a Vercel ya se auto-reportan desde adentro de la ruta.
    if comando.strip().startswith('curl') or '/api/cron/' in comando:
        return None

    m = re.search(r'([A-Za-z0-9_]+)\.py', comando)
    if not m:
        if 'crm_cron.sh' in comando:
            return 'crm_cron'
        return None
    base = m.group(1)

    if base == 'ig_auto':
        for s in IG_SUB:
            if re.search(rf'ig_auto\.py\s+{s}', comando):
                sufijo = s
                if s == 'publicar' and '--tipo reel' in comando:
                    sufijo = 'reel'
                return f'ig_auto_{sufijo}'
        return 'ig_auto'

    for b in BANDERAS:
        if b in comando:
            # --reporte semana / --reporte mes se distinguen por el argumento que sigue
            m2 = re.search(rf'{re.escape(b)}\s+(\w+)', comando)
            extra = f'_{m2.group(1)}' if m2 and m2.group(1) not in ('>>', '2>&1') else ''
            return f'{base}_{b.lstrip("-")}{extra}'
    return base


# Una línea de cron: <5 campos de tiempo> <comando>
RE_LINEA = re.compile(r'^((?:[^\s]+\s+){5})(.*)$')


def procesar(texto: str):
    salida, cambios = [], []
    for linea in texto.splitlines():
        if not linea.strip() or linea.lstrip().startswith('#') or '=' in linea.split()[0:1]:
            salida.append(linea)
            continue
        m = RE_LINEA.match(linea)
        if not m:
            salida.append(linea)
            continue
        tiempo, comando = m.group(1), m.group(2)

        slug = slug_de(comando)
        if not slug:
            salida.append(linea)
            continue

        # Se separa la redirección al log: tiene que seguir aplicándose al conjunto,
        # no quedar adentro del comando envuelto.
        redir = ''
        mr = re.search(r'(\s*(?:>>?|2>>?|>)\s*\S+.*)$', comando)
        if mr:
            redir = mr.group(1)
            comando = comando[:mr.start()]

        # El comando entero va a `bash -c` como UN argumento.
        #
        # Esto no es cosmetico. Casi todas las lineas son `cd /root/.claude && python3 x.py`.
        # Pasadas sin envolver, el shell del cron parte en el `&&`: run_job.sh recibiria solo
        # el `cd` —que sale 0 y se reporta como exito— y el script real correria suelto,
        # afuera de la medicion y sin el directorio de trabajo. O sea: todos los jobs rotos y
        # el panel diciendo que todo anda bien. Se detecto en la primera aplicacion.
        adentro = shlex.quote(comando.strip())
        # En crontab, `%` significa salto de linea salvo que se escape.
        adentro = adentro.replace('%', r'\%')
        nueva = f'{tiempo}{WRAPPER} {slug} -- /bin/bash -c {adentro}{redir}'
        salida.append(nueva)
        cambios.append((slug, tiempo.strip(), comando.strip()[:70]))
    return '\n'.join(salida) + '\n', cambios


def main():
    actual = subprocess.run(['crontab', '-l'], capture_output=True, text=True).stdout
    nuevo, cambios = procesar(actual)

    print(f'Jobs a envolver: {len(cambios)}\n')
    for slug, tiempo, cmd in cambios:
        print(f'  {slug:34} {tiempo:16} {cmd}')

    vistos = [s for s, _, _ in cambios]
    dup = {s for s in vistos if vistos.count(s) > 1}
    if dup:
        print(f'\nOJO: slugs repetidos (varias lineas comparten uno): {sorted(dup)}')

    if '--aplicar' not in sys.argv:
        print('\n(ensayo — no se toco nada. Usar --aplicar para escribir)')
        return

    with open(f'/root/.claude/crontab.antes-wrapper-{datetime.now():%Y%m%d%H%M}', 'w') as f:
        f.write(actual)
    subprocess.run(['crontab', '-'], input=nuevo, text=True, check=True)
    print('\nCRONTAB REESCRITO')


if __name__ == '__main__':
    main()
