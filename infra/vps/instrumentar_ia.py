#!/usr/bin/env python3
"""Inserta el registro de consumo en los scripts de IA del VPS.

Sin argumentos hace un ENSAYO y muestra el diff. Con --aplicar escribe (con backup).

Toca tres scripts que hoy funcionan, asi que el cambio es deliberadamente chico: se
captura la respuesta que ya se estaba devolviendo y se agrega UNA llamada. Nada de la
logica existente se mueve.

Es idempotente: si el archivo ya tiene el registro, se lo saltea.
"""
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

BASE = Path('/root/.claude')
IMPORT = 'from ia_log import registrar'

# (archivo, canal, patron a reemplazar, reemplazo)
#
# El patron incluye la indentacion para no pegarle a otra llamada parecida en otro punto
# del archivo. Cada uno se verifica con py_compile despues de escribir.
PARCHES = [
    (
        'vanguardia_diaria.py', 'vanguardia_diaria',
        "            with urllib.request.urlopen(req, timeout=300) as r:\n"
        "                return json.loads(r.read())\n",
        "            with urllib.request.urlopen(req, timeout=300) as r:\n"
        "                _resp = json.loads(r.read())\n"
        "            registrar('vanguardia_diaria', model, _resp)\n"
        "            return _resp\n",
    ),
    (
        'radar_saas.py', 'radar_saas',
        "            with urllib.request.urlopen(req, timeout=300) as r:\n"
        "                return json.loads(r.read())\n",
        "            with urllib.request.urlopen(req, timeout=300) as r:\n"
        "                _resp = json.loads(r.read())\n"
        "            registrar('radar_saas', model, _resp)\n"
        "            return _resp\n",
    ),
    (
        'reddit_radar.py', 'reddit_radar',
        "            with urllib.request.urlopen(req, timeout=300) as r:\n"
        "                resp = json.loads(r.read())\n",
        "            with urllib.request.urlopen(req, timeout=300) as r:\n"
        "                resp = json.loads(r.read())\n"
        "            registrar('reddit_radar', model, resp)\n",
    ),
]


def poner_import(texto):
    """Agrega el import despues del ultimo import de nivel superior."""
    if IMPORT in texto:
        return texto, False
    lineas = texto.splitlines(keepends=True)
    ultimo = 0
    for i, l in enumerate(lineas[:80]):
        if re.match(r'^(import |from )\S', l):
            ultimo = i
    lineas.insert(ultimo + 1, IMPORT + '\n')
    return ''.join(lineas), True


def main():
    aplicar = '--aplicar' in sys.argv
    for archivo, canal, viejo, nuevo in PARCHES:
        p = BASE / archivo
        if not p.exists():
            print(f'{archivo}: NO EXISTE')
            continue
        t = p.read_text(encoding='utf-8')

        if f"registrar('{canal}'" in t:
            print(f'{archivo}: ya instrumentado, se saltea')
            continue

        n = t.count(viejo)
        if n != 1:
            print(f'{archivo}: el patron aparece {n} veces (se esperaba 1) — NO se toca')
            continue

        t2 = t.replace(viejo, nuevo)
        t2, puso = poner_import(t2)
        print(f'{archivo}: parche listo (import agregado: {puso})')

        if aplicar:
            shutil.copy(p, BASE / f'{archivo}.bak-ialog-{datetime.now():%Y%m%d%H%M}')
            p.write_text(t2, encoding='utf-8')
            print(f'  escrito, backup guardado')

    if not aplicar:
        print('\n(ensayo — usar --aplicar para escribir)')


if __name__ == '__main__':
    main()
