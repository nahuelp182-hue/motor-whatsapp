#!/usr/bin/env python3
"""Escucha el pedido de auditoria que dispara el boton del panel.

Vive en 127.0.0.1:8790 y lo publica Caddy en https://vps.infomicelium.com.ar/auditar.

POR QUE UN LISTENER Y NO UN CRON QUE PREGUNTA
=============================================
La primera idea fue invertir el flujo: el boton dejaba una solicitud en la base y un cron
del VPS preguntaba cada 2 minutos si habia alguna. Se descarto por dos razones. Estaba
basada en un supuesto falso —que el firewall no dejaba entrar nada, cuando el 443 ya estaba
abierto con Caddy atendiendo— y habria sumado ~21.600 invocaciones mensuales a Vercel, que
esta en plan Hobby. Asi el boton es instantaneo y no agrega superficie: usa el puerto que
ya estaba abierto.

QUIEN LO PUEDE LLAMAR
=====================
Solo Vercel, con un token que vive en su lado y nunca llega al navegador. El panel no
llama aca directo: llama a su propia ruta, que valida la sesion del dashboard y recien
entonces reenvia el pedido.
"""
import json
import os
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

PUERTO = 8790
TOKEN = os.environ.get('AUDIT_TOKEN', '')
GUION = '/root/.claude/auditoria_sistema.py'

# Una auditoria hace ~16 llamadas a APIs externas. Sin freno, alguien apretando el boton
# repetido lanzaria N corridas en paralelo contra los mismos proveedores.
_candado = threading.Lock()
_ultima = 0.0
ESPERA_MIN_S = 60


class Handler(BaseHTTPRequestHandler):
    def _responder(self, codigo, datos):
        cuerpo = json.dumps(datos).encode()
        self.send_response(codigo)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_GET(self):
        if self.path == '/salud':
            return self._responder(200, {'ok': True})
        self._responder(404, {'error': 'no encontrado'})

    def do_POST(self):
        global _ultima

        if self.path != '/auditar':
            return self._responder(404, {'error': 'no encontrado'})

        auth = self.headers.get('Authorization', '')
        if not TOKEN or auth != f'Bearer {TOKEN}':
            return self._responder(401, {'error': 'no autorizado'})

        if not _candado.acquire(blocking=False):
            return self._responder(409, {'error': 'ya hay una auditoria corriendo'})
        try:
            resta = ESPERA_MIN_S - (time.time() - _ultima)
            if resta > 0:
                return self._responder(429, {'error': f'esperar {int(resta)} s'})

            r = subprocess.run(['python3', GUION, '--manual'],
                               capture_output=True, text=True, timeout=180)
            _ultima = time.time()
            # La salida NO incluye el detalle de los chequeos: los resultados viajan del
            # script al panel por su propio canal. Aca solo se confirma que corrio, para no
            # duplicar una fuente de verdad ni exponer valores por una segunda puerta.
            return self._responder(200 if r.returncode == 0 else 500, {
                'ok': r.returncode == 0,
                'resumen': (r.stdout or '').strip().splitlines()[:1],
            })
        except subprocess.TimeoutExpired:
            return self._responder(504, {'error': 'la auditoria tardo mas de 180 s'})
        except Exception as e:
            return self._responder(500, {'error': str(e)[:200]})
        finally:
            _candado.release()

    def log_message(self, *args):
        pass  # journald ya registra el servicio; el log por request solo hace ruido


if __name__ == '__main__':
    if not TOKEN:
        raise SystemExit('Falta AUDIT_TOKEN en el entorno: sin token no se levanta.')
    HTTPServer(('127.0.0.1', PUERTO), Handler).serve_forever()
