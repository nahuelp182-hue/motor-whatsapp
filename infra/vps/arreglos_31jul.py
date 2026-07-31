#!/usr/bin/env python3
"""Tres arreglos decididos el 31/07/2026. Ensayo sin argumentos; --aplicar escribe.

1. radar_saas: max_uses de busqueda web 12 -> 6.
   Una corrida medida costo USD 1,79, de los cuales el 80% era input inflado por los
   resultados de las 12 busquedas (478.380 tokens de entrada). ~USD 30/mes el solo.

2. crm_sync: dejar de enumerar paginas de Facebook.
   me/accounts devuelve vacio (falta pages_show_list o la pagina quedo fuera del alcance
   del usuario), asi que scan_fb_complaints cortaba con "No hay paginas FB" en CADA
   corrida. El fb_page_token guardado en meta-config.json funciona perfecto usado directo.
   Se usa ese y se deja de preguntar por algo que la API no va a contestar.
"""
import shutil
import sys
from datetime import datetime
from pathlib import Path

BASE = Path('/root/.claude')

PARCHES = [
    (
        'radar_saas.py',
        '"max_uses": 12}',
        '"max_uses": 6}',
        'busqueda web 12 -> 6 usos',
    ),
    (
        'crm_sync.py',
        "        rl()\n"
        "        pages = meta_get('me/accounts', {'fields': 'id,name,access_token'}).get('data', [])\n"
        "        if not pages: return [], \"No hay páginas FB\"\n"
        "        page = pages[0]\n"
        "        rl()\n",
        "        # El token de pagina va DIRECTO desde la config, sin pasar por me/accounts.\n"
        "        # Ese endpoint devuelve vacio —falta pages_show_list, o la pagina quedo fuera\n"
        "        # del alcance del usuario— y hacia que esta funcion cortara con\n"
        "        # \"No hay paginas FB\" en cada corrida, en silencio, desde hacia semanas.\n"
        "        # El fb_page_token guardado si funciona: responde 200 y devuelve la pagina.\n"
        "        page = {'id': meta_cfg.get('fb_page_id'), 'name': meta_cfg.get('fb_page_name'),\n"
        "                'access_token': meta_cfg.get('fb_page_token')}\n"
        "        if not page['id'] or not page['access_token']:\n"
        "            return [], 'Falta fb_page_id o fb_page_token en meta-config.json'\n"
        "        rl()\n",
        'usar fb_page_token directo en vez de me/accounts',
    ),
]


def main():
    aplicar = '--aplicar' in sys.argv
    for archivo, viejo, nuevo, desc in PARCHES:
        p = BASE / archivo
        t = p.read_text(encoding='utf-8')
        if nuevo.strip() and nuevo in t:
            print(f'{archivo}: ya aplicado ({desc})')
            continue
        n = t.count(viejo)
        if n != 1:
            print(f'{archivo}: el patron aparece {n} veces (se esperaba 1) — NO se toca')
            continue
        print(f'{archivo}: {desc}')
        if aplicar:
            shutil.copy(p, BASE / f'{archivo}.bak-{datetime.now():%Y%m%d%H%M}')
            p.write_text(t.replace(viejo, nuevo), encoding='utf-8')
            print('  escrito, backup guardado')
    if not aplicar:
        print('\n(ensayo — usar --aplicar para escribir)')


if __name__ == '__main__':
    main()
