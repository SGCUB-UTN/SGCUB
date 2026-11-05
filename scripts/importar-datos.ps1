param([string]$Carpeta = 'respaldo', [string]$Base = '')

. "$PSScriptRoot\comun.ps1"

try {
    if (-not (Test-Path "$Carpeta\sgcub.dump")) { throw "No se encontró $Carpeta\sgcub.dump" }

    if (-not (Test-Path '.env')) { Copy-SiExiste "$Carpeta\.env" '.env' }
    if (-not (Test-Path 'docker-compose.override.yml')) { Copy-SiExiste "$Carpeta\docker-compose.override.yml" 'docker-compose.override.yml' }

    $commitOrigen = (Get-Content "$Carpeta\commit.txt" -ErrorAction SilentlyContinue | Select-Object -First 1)
    $commitLocal = (git rev-parse HEAD)
    if ($commitOrigen -and $commitOrigen -ne $commitLocal) {
        Write-Host "Atención: el código no está en el mismo commit que la PC de origen ($commitOrigen)." -ForegroundColor Yellow
    }

    Write-Host 'Levantando la base...'
    Invoke-Docker compose up -d --wait db
    Invoke-Docker compose stop backend qcluster

    Write-Host 'Restaurando los datos...'
    Invoke-Docker compose cp "$Carpeta\sgcub.dump" db:/tmp/sgcub.dump
    Invoke-Docker compose exec -T -e "BASE=$Base" db sh -c 'B=${BASE:-$POSTGRES_DB}; dropdb --if-exists --force -U $POSTGRES_USER $B && createdb -U $POSTGRES_USER -O $POSTGRES_USER $B && pg_restore --no-owner --no-acl --exit-on-error -U $POSTGRES_USER -d $B /tmp/sgcub.dump'

    Write-Host 'Verificando que los datos sean idénticos...'
    $diferencias = Compare-Object (Get-Content "$Carpeta\huella.txt") (Get-Huella $Base)

    Invoke-Docker compose up -d

    # Si la base restaurada referencia un logo que no existe en /media, restauramos el escudo oficial
    try {
        $logoQuery = 'psql -tA -U $POSTGRES_USER -d ${BASE:-$POSTGRES_DB} -c "SELECT club_logo FROM configuracion_general LIMIT 1;"'
        $logoPath = (& docker compose exec -T -e "BASE=$Base" db sh -c $logoQuery 2>$null)
        if ($logoPath) {
            $logoPath = $logoPath.Trim()
            if ($logoPath) {
                $cmd = 'TARGET="/app/media/' + $logoPath + '"; if [ ! -f "$TARGET" ]; then mkdir -p "$(dirname "$TARGET")" && cp /app/configuracion/fixtures/escudo-sin-fondo.png "$TARGET"; fi'
                & docker compose exec -T backend sh -c $cmd
            }
        }
    } catch {}

    if ($diferencias) {
        Write-Host 'Los datos NO coinciden con la PC de origen en estas tablas:' -ForegroundColor Red
        $diferencias | ForEach-Object { Write-Host "  $($_.InputObject.Split(' ')[0])" }
        exit 1
    }
    Write-Host 'Listo. Los datos son idénticos a los de la PC de origen.' -ForegroundColor Green
}
catch {
    Write-Host $_ -ForegroundColor Red
    exit 1
}
