# Reporta al panel el resultado de las tareas programadas de Windows.
#
# POR QUÉ ES UN REPORTERO Y NO UN WRAPPER COMO EN EL VPS
#
# En el VPS hubo que envolver cada job porque cron no guarda nada: dispara y se olvida. El
# Programador de tareas de Windows YA registra la última corrida y su código de resultado,
# así que envolver seria duplicar lo que el sistema ya hace. Acá alcanza con leer y mandar.
#
# EL FALSO POSITIVO QUE HAY QUE EVITAR
#
# Estas tareas corren en una PC de escritorio que se apaga y se suspende. El código
# 0x800710E0 ("el operador rechazó la solicitud") aparece cuando la tarea no pudo arrancar
# porque la máquina estaba suspendida o a batería — no es un bug del script. Se reporta
# aparte, como 'no_corrio', para que el panel no lo pinte igual que un error real: si todo
# fuera rojo, el rojo dejaría de significar algo.

$ErrorActionPreference = 'Stop'

$Endpoint = 'https://mw-micelium.vercel.app/api/jobs/ingest'
$Secreto  = 'micelium-cron-2026'
$EstadoFile = "$env:USERPROFILE\.claude\heartbeat_tareas_estado.json"

# Tareas propias. El filtro va por nombre porque no hay una carpeta propia en el
# Programador; si algún día se crea una, conviene filtrar por TaskPath.
$Patron = '^(Micelium|MiceliumABTestCheck|MiceliumBotWAAlerta)'

# Códigos que significan "no llegó a correr", no "corrió y falló".
#
# Se comparan como HEXADECIMAL y no como número: los resultados del Programador vienen sin
# signo y desbordan Int32 (3221225786 no entra en un int), asi que la comparacion numerica
# reventaba. El hexadecimal es ademas la forma en que Microsoft los documenta.
#   0x800710E0 - el operador rechazó la solicitud (PC suspendida o a bateria)
#   0x00041303 - la tarea nunca corrio
#   0x00041325 - la tarea esta en cola, todavia no arrancó
$NoCorrio = @('0x800710E0', '0x00041303', '0x00041325')

function CodigoConSigno($crudo) {
    # LastTaskResult llega como entero sin signo; Postgres guarda int4. Se pasa al mismo
    # valor con signo que muestra el Programador, en vez de perder el dato por desborde.
    $v = [int64]$crudo
    if ($v -gt 2147483647) { return [int]($v - 4294967296) }
    return [int]$v
}

function Slug($nombre) {
    return ($nombre -replace '[^a-zA-Z0-9]', '_').ToLower()
}

# Estado: última corrida ya reportada de cada tarea. Sin esto, cada pasada volvería a
# mandar la misma corrida y el historial se llenaría de duplicados que inventan actividad.
$estado = @{}
if (Test-Path $EstadoFile) {
    try {
        (Get-Content $EstadoFile -Raw | ConvertFrom-Json).PSObject.Properties |
            ForEach-Object { $estado[$_.Name] = $_.Value }
    } catch {
        Write-Warning "Estado ilegible, se empieza de cero: $_"
    }
}

$enviados = 0
Get-ScheduledTask | Where-Object { $_.TaskName -match $Patron } | ForEach-Object {
    $tarea = $_
    $info  = $tarea | Get-ScheduledTaskInfo
    $slug  = Slug $tarea.TaskName

    if (-not $info.LastRunTime) { return }
    $marca = $info.LastRunTime.ToString('o')
    if ($estado[$slug] -eq $marca) { return }  # ya reportada

    if ($tarea.State -eq 'Disabled') { return }  # deshabilitada a proposito: no se vigila

    $hex  = '0x{0:X8}' -f ([int64]$info.LastTaskResult)
    $code = CodigoConSigno $info.LastTaskResult
    $ok   = ($code -eq 0)
    $detalle = ''
    if (-not $ok) {
        if ($NoCorrio -contains $hex) {
            $detalle = "no_corrio: la PC estaba apagada, suspendida o a bateria ($hex)"
        } else {
            $detalle = "la tarea corrio y fallo con codigo $hex"
        }
    }

    $cuerpo = @{
        slug      = $slug
        origen    = 'windows'
        exit_code = $code
        detalle   = $detalle
    } | ConvertTo-Json -Compress

    try {
        Invoke-RestMethod -Uri $Endpoint -Method Post -TimeoutSec 20 `
            -Headers @{ Authorization = "Bearer $Secreto" } `
            -ContentType 'application/json' -Body $cuerpo | Out-Null
        $estado[$slug] = $marca
        $enviados++
    } catch {
        # Reportar es lo menos importante que hace esta PC: si falla, se reintenta en la
        # proxima pasada. No se escribe el estado, asi que la corrida no se pierde.
        Write-Warning "No se pudo reportar $slug : $_"
    }
}

$estado | ConvertTo-Json | Set-Content $EstadoFile -Encoding utf8
Write-Output "Reportadas $enviados corridas nuevas."
