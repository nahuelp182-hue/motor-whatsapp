"""Registra en el panel lo que gasta cada script de IA del VPS.

    from ia_log import registrar
    ...
    registrar('vanguardia_diaria', modelo, respuesta)   # respuesta = dict de la API

Hasta el 31/07/2026 solo se medían las 4 rutas del motor: USD 2,30 en un mes. Lo que NO se
medía —este script y sus tres hermanos— se estimaba en ~USD 18/mes. O sea que lo medido era
la octava parte de lo gastado, y la parte ciega es justo la que puede escalar sola: una
corrida que se pone a buscar de más no dispara ninguna alerta, porque el tope de gasto mira
una tabla donde estos scripts no escribían.

DOS DECISIONES
==============
1. `registrar` NUNCA lanza. Medir no puede voltear el trabajo que se está midiendo: si el
   panel no responde, el script sigue y se pierde una fila de contabilidad, no la corrida.
2. El costo lo calcula el PANEL, no este archivo. La tabla de precios vive en un solo lugar
   (lib/precios-ia.ts). Duplicarla acá garantiza que dentro de tres meses las dos digan
   cosas distintas y nadie sepa cuál mirar.
"""
import json
import sys
import urllib.request

ENDPOINT = 'https://mw-micelium.vercel.app/api/ia/uso'
SECRETO = 'micelium-cron-2026'


def _de_anthropic(resp):
    """Extrae el uso de una respuesta de la API de Anthropic."""
    u = resp.get('usage') or {}
    return {
        'input_tokens': u.get('input_tokens', 0),
        'output_tokens': u.get('output_tokens', 0),
        'cache_read_tokens': u.get('cache_read_input_tokens', 0),
        'cache_write_tokens': u.get('cache_creation_input_tokens', 0),
        # La búsqueda web se factura APARTE (USD 10 cada 1.000). Es el costo que quedaba
        # invisible: los tres scripts de Claude del VPS la usan.
        'web_search_requests': (u.get('server_tool_use') or {}).get('web_search_requests', 0),
    }


def _de_gemini(resp):
    """Extrae el uso de una respuesta de la API de Gemini (otra forma, mismo concepto)."""
    u = resp.get('usageMetadata') or {}
    return {
        'input_tokens': u.get('promptTokenCount', 0),
        'output_tokens': u.get('candidatesTokenCount', 0),
        'cache_read_tokens': u.get('cachedContentTokenCount', 0),
        'cache_write_tokens': 0,
        'web_search_requests': 0,
    }


def registrar(canal, modelo, respuesta, duracion_ms=None, proveedor=None):
    """Manda al panel lo que consumió una llamada. Best-effort: nunca lanza.

    `canal` es el nombre del consumidor tal como se quiere ver en el ranking
    ('vanguardia_diaria', 'radar_saas', ...), no el del modelo.
    """
    try:
        if not isinstance(respuesta, dict):
            return
        prov = proveedor or ('google' if str(modelo).startswith('gemini') else 'anthropic')
        uso = _de_gemini(respuesta) if prov == 'google' else _de_anthropic(respuesta)

        cuerpo = json.dumps({
            'channel': canal, 'model': modelo, 'provider': prov,
            'duracion_ms': duracion_ms, **uso,
        }).encode()

        req = urllib.request.Request(
            ENDPOINT, data=cuerpo,
            headers={'Authorization': f'Bearer {SECRETO}', 'Content-Type': 'application/json'},
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            datos = json.loads(r.read().decode())
        # El panel avisa si el modelo no está en su tabla de precios. Se imprime en el log
        # del script porque es ahí donde alguien lo va a ver, y porque el costo de esa fila
        # es un piso, no un valor confiable.
        if datos.get('modeloDesconocido'):
            print(f'[ia_log] AVISO: "{modelo}" no tiene precio en la tabla del panel; '
                  f'el costo registrado es un piso. Agregarlo en lib/precios-ia.ts',
                  file=sys.stderr)
        return datos
    except Exception as e:
        print(f'[ia_log] no se pudo registrar el uso de {canal}: {e}', file=sys.stderr)
        return None
