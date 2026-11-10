param([switch]$Confirmar, [string]$Base = '')

. "$PSScriptRoot\comun.ps1"

try {
    if (-not $Confirmar) { throw 'Este script BORRA todos los datos de la base. Volvé a ejecutarlo con -Confirmar.' }
    $base = if ($Base) { $Base } else { 'sgcub_db' }
    $carpeta = (Resolve-Path "$PSScriptRoot\datos-demo").Path

    Write-Host 'Levantando la base y deteniendo el backend...'
    Invoke-Docker compose up -d --wait db
    Invoke-Docker compose stop backend qcluster

    Write-Host "Borrando la base $base..."
    Invoke-Docker compose exec -T -e "BASE=$base" db sh -c 'dropdb --if-exists --force -U $POSTGRES_USER $BASE && createdb -U $POSTGRES_USER -O $POSTGRES_USER $BASE'

    Write-Host 'Creando las tablas y generando los datos (puede tardar varios minutos)...'
    Invoke-Docker compose run --rm --no-deps -e "DB_NAME=$base" -v "${carpeta}:/datos-demo" backend sh -c 'pip install -q --disable-pip-version-check time-machine && python manage.py migrate --noinput && python manage.py create_initial_admin && python /datos-demo/generar_datos_demo.py'

    Write-Host 'Listo. Datos de la demo generados.' -ForegroundColor Green
}
catch {
    Write-Host $_ -ForegroundColor Red
    $fallo = $true
}
finally {
    & docker compose up -d
}
if ($fallo) { exit 1 }
