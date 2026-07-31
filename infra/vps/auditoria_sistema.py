#!/usr/bin/env python3
"""Auditoría del sistema — Micelium.

Corre todos los chequeos que solo se pueden hacer estando adentro del VPS y los manda al
panel, que les agrega el estado de las 46 automatizaciones (eso vive en su base).

    python3 auditoria_sistema.py            # corrida programada (cron diario)
    python3 auditoria_sistema.py --manual   # disparada desde el boton del panel
    python3 auditoria_sistema.py --local    # imprime y NO manda (para probar)

POR QUE LAS CREDENCIALES SE CHEQUEAN CON UNA LLAMADA REAL
=========================================================
La primera version de esto iba a mirar fechas de vencimiento. El 31/07/2026 quedo claro que
no alcanza: se roto la API key de Anthropic, la vieja quedo revocada, y el bot de WhatsApp,
el de Instagram y el asistente web quedaron mudos. Ninguna fecha habia vencido — la
credencial simplemente dejo de servir. Nadie se entero hasta que se miro a mano.

Una credencial revocada no expira: deja de funcionar. La unica forma de saberlo es usarla.
Por eso cada chequeo de credencial hace una llamada real y barata al proveedor.
"""
import json
import os
import shutil
import socket
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = Path('/root/.claude')
ENDPOINT = 'https://mw-micelium.vercel.app/api/auditoria/ingest'
SECRETO = 'micelium-cron-2026'
BITACORA = BASE / 'auditoria.jsonl'

checks = []


def check(clave, grupo, titulo, estado, valor=None, umbral=None, hint=None):
    checks.append({
        'clave': clave, 'grupo': grupo, 'titulo': titulo, 'estado': estado,
        'valor': str(valor) if valor is not None else None,
        'umbral': str(umbral) if umbral is not None else None,
        'hint': hint,
    })


def cfg(nombre):
    return json.loads((BASE / nombre).read_text())


def http(url, headers=None, timeout=20, datos=None):
    req = urllib.request.Request(url, headers=headers or {}, data=datos)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read().decode('utf-8', 'replace')


def horas_desde_mtime(p: Path):
    if not p.exists():
        return None
    return (time.time() - p.stat().st_mtime) / 3600


# ─────────────────────────────────────────────────────────────────────────────
# CREDENCIALES — llamada real, no lectura de fecha
# ─────────────────────────────────────────────────────────────────────────────

def cred(clave, titulo, fn, hint):
    """Envuelve un chequeo de credencial. Cualquier excepcion es 'fail': una credencial
    que no se puede verificar es, a los efectos, una credencial que no sirve."""
    try:
        ok, detalle = fn()
        check(clave, 'credenciales', titulo, 'ok' if ok else 'fail',
              detalle, 'la llamada responde', None if ok else hint)
    except Exception as e:
        check(clave, 'credenciales', titulo, 'fail', f'{type(e).__name__}: {e}'[:200],
              'la llamada responde', hint)


def cred_anthropic():
    k = cfg('anthropic-config.json')['api_key']
    cuerpo = json.dumps({'model': 'claude-sonnet-5', 'max_tokens': 1,
                         'messages': [{'role': 'user', 'content': 'x'}]}).encode()
    st, _ = http('https://api.anthropic.com/v1/messages',
                 {'x-api-key': k, 'anthropic-version': '2023-06-01',
                  'content-type': 'application/json'}, datos=cuerpo)
    return st == 200, f'HTTP {st}'


def cred_ml():
    k = cfg('ml-config.json')['access_token']
    st, _ = http('https://api.mercadolibre.com/users/me', {'Authorization': f'Bearer {k}'})
    return st == 200, f'HTTP {st}'


def cred_meta():
    # La clave es 'long_lived_token', no 'access_token'. Vale anotarlo: la primera version
    # de este chequeo fallaba con KeyError y eso se veia igual que un token muerto.
    k = cfg('meta-config.json')['long_lived_token']
    st, _ = http(f'https://graph.facebook.com/v21.0/me?access_token={k}')
    return st == 200, f'HTTP {st}'


def cred_fb_page():
    k = cfg('meta-config.json').get('fb_page_token', '')
    if not k:
        return False, 'no hay fb_page_token en meta-config.json'
    st, cuerpo = http(f'https://graph.facebook.com/v21.0/me?access_token={k}')
    nombre = json.loads(cuerpo).get('name', '?') if st == 200 else ''
    return st == 200, f'HTTP {st} ({nombre})' if st == 200 else f'HTTP {st}'


def fb_paginas():
    """El token de usuario, ¿puede LISTAR las paginas?

    Chequeo aparte del token en si, porque son dos fallas distintas que se veian igual:
    el 31/07/2026 los dos tokens de Meta respondian 200 y sin embargo el sync del CRM
    reportaba "No hay paginas FB" en cada corrida. La causa es que me/accounts devuelve
    vacio (falta el permiso pages_show_list, o la pagina quedo fuera del alcance del
    usuario), aunque el fb_page_token guardado funciona perfecto cuando se usa directo.
    """
    k = cfg('meta-config.json')['long_lived_token']
    st, cuerpo = http(f'https://graph.facebook.com/v21.0/me/accounts?access_token={k}')
    n = len(json.loads(cuerpo).get('data', [])) if st == 200 else 0
    return n > 0, f'{n} paginas visibles (HTTP {st})'


def cred_wa():
    d = cfg('wa-cloud-config.json')
    st, _ = http(f"https://graph.facebook.com/v21.0/{d['waba_id']}?access_token={d['token']}")
    return st == 200, f'HTTP {st}'


def cred_tn():
    d = cfg('tiendanube-config.json')
    tid = d.get('store_id') or d.get('user_id')
    tok = d.get('access_token')
    st, _ = http(f'https://api.tiendanube.com/v1/{tid}/store',
                 {'Authentication': f'bearer {tok}', 'User-Agent': 'Micelium (info@infomicelium.com.ar)'})
    return st == 200, f'HTTP {st}'


# ─────────────────────────────────────────────────────────────────────────────
# INFRA
# ─────────────────────────────────────────────────────────────────────────────

def infra():
    du = shutil.disk_usage('/')
    pct = du.used / du.total * 100
    check('disco', 'infra', 'Espacio en disco del VPS',
          'fail' if pct >= 90 else ('warn' if pct >= 80 else 'ok'),
          f'{pct:.0f}% usado ({du.free // 2**30} GB libres)', '< 80%',
          'SSH: du -sh /root/* /var/log/* | sort -h | tail')

    try:
        m = {}
        for linea in Path('/proc/meminfo').read_text().splitlines():
            k, v = linea.split(':')
            m[k] = int(v.strip().split()[0])
        libre_pct = m['MemAvailable'] / m['MemTotal'] * 100
        check('memoria', 'infra', 'Memoria disponible',
              'fail' if libre_pct < 10 else ('warn' if libre_pct < 20 else 'ok'),
              f'{libre_pct:.0f}% libre ({m["MemAvailable"] // 1024} MB)', '> 20%',
              'SSH: ps aux --sort=-%mem | head')
    except Exception as e:
        check('memoria', 'infra', 'Memoria disponible', 'warn', str(e)[:120])

    carga = os.getloadavg()[1]
    ncpu = os.cpu_count() or 1
    check('carga', 'infra', 'Carga del procesador (5 min)',
          'fail' if carga > ncpu * 2 else ('warn' if carga > ncpu else 'ok'),
          f'{carga:.2f} con {ncpu} nucleos', f'< {ncpu}', 'SSH: top -b -n1 | head -15')

    # Backup: el watchdog semanal ya avisa por mail, pero el panel tiene que poder
    # contestar "¿hay backup reciente?" sin ir a buscar un correo viejo.
    # Solo archivos que SON un respaldo. La primera version miraba el archivo mas nuevo del
    # directorio cualquiera fuera, y un .txt de notas dejado ahi al pasar alcanzaba para que
    # el chequeo diera verde con el backup real viejo. Un chequeo que se conforma con
    # cualquier cosa es peor que no tenerlo: da tranquilidad sin respaldarla.
    exts = ('*.tar.gz', '*.tgz', '*.zip', '*.sql', '*.sql.gz', '*.db', '*.dump')
    dir_backup = Path('/root/backup')
    backups = sorted(
        (f for patron in exts for f in dir_backup.glob(patron)),
        key=lambda p: p.stat().st_mtime, reverse=True,
    ) if dir_backup.exists() else []
    if backups:
        h = (time.time() - backups[0].stat().st_mtime) / 3600
        check('backup', 'infra', 'Antiguedad del ultimo backup',
              'fail' if h > 24 * 10 else ('warn' if h > 24 * 8 else 'ok'),
              f'{h / 24:.1f} dias ({backups[0].name})', '< 8 dias',
              'SSH: ls -lt /root/backup | head')
    else:
        check('backup', 'infra', 'Antiguedad del ultimo backup', 'fail', 'no hay backups',
              '< 8 dias', 'SSH: revisar /root/backup y el cron de backup_watchdog')

    # Certificado del dominio del propio endpoint: si vence, el boton del panel deja de
    # funcionar y la auditoria se vuelve inalcanzable justo cuando hace falta.
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection(('vps.infomicelium.com.ar', 443), timeout=15) as s:
            with ctx.wrap_socket(s, server_hostname='vps.infomicelium.com.ar') as ss:
                vence = datetime.strptime(ss.getpeercert()['notAfter'], '%b %d %H:%M:%S %Y %Z')
        dias = (vence.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)).days
        check('tls', 'infra', 'Certificado TLS del endpoint',
              'fail' if dias < 7 else ('warn' if dias < 20 else 'ok'),
              f'vence en {dias} dias', '> 20 dias',
              'Caddy renueva solo; si falla: journalctl -u caddy -n 50')
    except Exception as e:
        check('tls', 'infra', 'Certificado TLS del endpoint', 'warn', str(e)[:120],
              '> 20 dias', 'SSH: systemctl status caddy')


# ─────────────────────────────────────────────────────────────────────────────
# NEGOCIO — heredado de crm_watchdog.py, que sigue corriendo aparte por mail
# ─────────────────────────────────────────────────────────────────────────────

def negocio():
    try:
        st = json.loads((BASE / 'crm_sync_state.json').read_text())
        ts = st.get('last_sync', '')
        h = (datetime.now(timezone.utc) - datetime.fromisoformat(ts).replace(
            tzinfo=timezone.utc)).total_seconds() / 3600
        check('crm_sync', 'negocio', 'Sincronizacion del CRM',
              'fail' if h > 2 else 'ok', f'hace {h:.1f} h', '< 2 h',
              'SSH: tail -30 /root/.claude/crm_sync_cron.log')
    except Exception as e:
        check('crm_sync', 'negocio', 'Sincronizacion del CRM', 'fail', str(e)[:150], '< 2 h',
              'SSH: cat /root/.claude/crm_sync_state.json')

    try:
        rep = json.loads((BASE / 'crm_sync_report.json').read_text())
        benignos = ('sin telefono', 'sin datos')
        errs = [e for e in rep.get('errors', []) if not any(b in e.lower() for b in benignos)]
        check('crm_errores', 'negocio', 'Errores en la ultima sincronizacion',
              'fail' if errs else 'ok', '; '.join(errs)[:300] or 'sin errores', '0',
              'SSH: cat /root/.claude/crm_sync_report.json' if errs else None)
    except Exception as e:
        check('crm_errores', 'negocio', 'Errores en la ultima sincronizacion', 'warn', str(e)[:150])

    h = horas_desde_mtime(BASE / 'daily_report_last.txt')
    check('reporte_diario', 'negocio', 'Reporte diario enviado',
          'ok' if h is not None and h <= 25 else 'fail',
          f'hace {h:.0f} h' if h is not None else 'nunca', '< 25 h',
          'SSH: tail -40 /root/.claude/daily_report.log')

    r = subprocess.run(['getent', 'hosts', 'api.notion.com'], capture_output=True)
    check('dns', 'negocio', 'Resolucion DNS', 'ok' if r.returncode == 0 else 'fail',
          'resuelve' if r.returncode == 0 else 'NO resuelve', 'resuelve',
          'SSH: tailscale dns status (debe decir disabled) / resolvectl status')


def main():
    inicio = time.time()
    manual = '--manual' in sys.argv

    cred('cred_anthropic', 'API de Claude (bot, vanguardia, radar)', cred_anthropic,
         'Rotar en console.anthropic.com y actualizar EN LOS DOS LADOS: '
         '/root/.claude/anthropic-config.json y la variable ANTHROPIC_API_KEY de Vercel '
         '(esta ultima necesita redeploy para tomar efecto).')
    cred('cred_ml', 'Token de MercadoLibre', cred_ml,
         'El VPS es el dueño del token. SSH: cd /root/.claude && python3 ml_refresh.py')
    cred('cred_meta', 'Token de Meta Ads', cred_meta,
         'Regenerar en Business Manager y actualizar /root/.claude/meta-config.json')
    cred('cred_fb_page', 'Token de la pagina de Facebook', cred_fb_page,
         'Regenerar el token de pagina en Meta for Developers (Graph API Explorer) y '
         'actualizar fb_page_token en /root/.claude/meta-config.json')
    cred('fb_paginas', 'El token de usuario puede listar las paginas', fb_paginas,
         'me/accounts devuelve vacio: falta el permiso pages_show_list en el token de '
         'usuario, o la pagina quedo fuera de su alcance. Es lo que hace que crm_sync.py '
         'reporte "No hay paginas FB" en cada corrida. El fb_page_token guardado SI '
         'funciona, asi que la salida corta es que crm_sync use ese token directo en vez '
         'de enumerar paginas.')
    cred('cred_wa', 'Token de WhatsApp Cloud', cred_wa,
         'Regenerar en Meta for Developers y actualizar /root/.claude/wa-cloud-config.json')
    cred('cred_tn', 'Token de Tiendanube', cred_tn,
         'Reinstalar la app en el admin de Tiendanube y actualizar tiendanube-config.json')

    infra()
    negocio()

    duracion = int((time.time() - inicio) * 1000)
    cuenta = {e: sum(1 for c in checks if c['estado'] == e) for e in ('ok', 'warn', 'fail')}
    payload = {'origen': 'manual' if manual else 'programada',
               'duracion_ms': duracion, 'checks': checks}

    # La bitacora local es un respaldo crudo por si la base no esta alcanzable. NO se lee
    # para mostrar nada: la fuente de verdad del panel es la base, y tener dos lugares que
    # contestan lo mismo es como se empieza a divergir.
    try:
        with BITACORA.open('a') as f:
            f.write(json.dumps({'ts': datetime.now(timezone.utc).isoformat(), **payload}) + '\n')
    except Exception as e:
        print(f'aviso: no se pudo escribir la bitacora: {e}', file=sys.stderr)

    print(f"{len(checks)} chequeos — ok:{cuenta['ok']} warn:{cuenta['warn']} fail:{cuenta['fail']} ({duracion} ms)")
    for c in checks:
        if c['estado'] != 'ok':
            print(f"  [{c['estado'].upper()}] {c['titulo']}: {c['valor']}")

    if '--local' in sys.argv:
        return 0

    try:
        st, cuerpo = http(ENDPOINT,
                          {'Authorization': f'Bearer {SECRETO}', 'Content-Type': 'application/json'},
                          timeout=45, datos=json.dumps(payload).encode())
        print(f'panel: HTTP {st} {cuerpo[:200]}')
        return 0 if st == 200 else 1
    except Exception as e:
        print(f'ERROR al mandar al panel: {e}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
