param([string]$Carpeta = 'respaldo')

. "$PSScriptRoot\comun.ps1"

try {
    New-Item -ItemType Directory -Force $Carpeta | Out-Null

    Write-Host 'Generando volcado de la base...'
    Invoke-Docker compose exec -T db sh -c 'pg_dump -Fc -U $POSTGRES_USER -d $POSTGRES_DB -f /tmp/sgcub.dump'
    Invoke-Docker compose cp db:/tmp/sgcub.dump "$Carpeta\sgcub.dump"

    Write-Host 'Calculando huella de los datos...'
    Get-Huella | Set-Content -Encoding ascii "$Carpeta\huella.txt"

    Copy-SiExiste '.env' "$Carpeta\.env"
    Copy-SiExiste 'docker-compose.override.yml' "$Carpeta\docker-compose.override.yml"
    git rev-parse HEAD | Set-Content -Encoding ascii "$Carpeta\commit.txt"

    Write-Host "Listo. Copiá la carpeta '$Carpeta' a la otra PC." -ForegroundColor Green
}
catch {
    Write-Host $_ -ForegroundColor Red
    exit 1
}
