Set-Location (Split-Path $PSScriptRoot -Parent)

function Invoke-Docker {
    & docker @args
    if ($LASTEXITCODE -ne 0) { throw "Falló: docker $($args -join ' ')" }
}

function Get-Huella([string]$Base = '') {
    Invoke-Docker compose cp "$PSScriptRoot\huella.sql" db:/tmp/huella.sql
    $lineas = & docker compose exec -T -e "BASE=$Base" db sh -c 'psql -v ON_ERROR_STOP=1 -tA -U $POSTGRES_USER -d ${BASE:-$POSTGRES_DB} -f /tmp/huella.sql'
    if ($LASTEXITCODE -ne 0) { throw 'Falló el cálculo de la huella de los datos' }
    $lineas | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}

function Copy-SiExiste([string]$Origen, [string]$Destino) {
    if (Test-Path $Origen) { Copy-Item $Origen $Destino -Force }
}
