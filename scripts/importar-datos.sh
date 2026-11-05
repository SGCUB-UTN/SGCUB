#!/usr/bin/env bash
set -euo pipefail

# Asegurar que corre desde la raíz del repo
cd "$(dirname "$0")/.."

CARPETA="${1:-respaldo}"
BASE="${2:-}"

if [ ! -f "$CARPETA/sgcub.dump" ]; then
    echo "Error: No se encontró $CARPETA/sgcub.dump" >&2
    exit 1
fi

if [ ! -f .env ] && [ -f "$CARPETA/.env" ]; then
    cp "$CARPETA/.env" .env
fi

if [ ! -f docker-compose.override.yml ] && [ -f "$CARPETA/docker-compose.override.yml" ]; then
    cp "$CARPETA/docker-compose.override.yml" docker-compose.override.yml
fi

if [ -f "$CARPETA/commit.txt" ]; then
    COMMIT_ORIGEN=$(head -n 1 "$CARPETA/commit.txt" | tr -d '\r\n')
    COMMIT_LOCAL=$(git rev-parse HEAD 2>/dev/null || echo "")
    if [ -n "$COMMIT_ORIGEN" ] && [ "$COMMIT_ORIGEN" != "$COMMIT_LOCAL" ]; then
        echo -e "\033[33mAtención: el código no está en el mismo commit que la PC de origen ($COMMIT_ORIGEN).\033[0m"
    fi
fi

echo "Levantando la base..."
docker compose up -d --wait db
docker compose stop backend qcluster

echo "Restaurando los datos..."
docker compose cp "$CARPETA/sgcub.dump" db:/tmp/sgcub.dump
docker compose exec -T -e BASE="$BASE" db sh -c 'B=${BASE:-$POSTGRES_DB}; dropdb --if-exists --force -U $POSTGRES_USER $B && createdb -U $POSTGRES_USER -O $POSTGRES_USER $B && pg_restore --no-owner --no-acl --exit-on-error -U $POSTGRES_USER -d $B /tmp/sgcub.dump'

echo "Verificando que los datos sean idénticos..."
docker compose cp scripts/huella.sql db:/tmp/huella.sql
HUELLA_ACTUAL=$(docker compose exec -T -e BASE="$BASE" db sh -c 'psql -v ON_ERROR_STOP=1 -tA -U $POSTGRES_USER -d ${BASE:-$POSTGRES_DB} -f /tmp/huella.sql' | tr -d '\r' | sed '/^[[:space:]]*$/d')
HUELLA_ORIGEN=$(cat "$CARPETA/huella.txt" | tr -d '\r' | sed '/^[[:space:]]*$/d')

docker compose up -d

# Si la base restaurada referencia un logo que no estaba en el volumen /media,
# restauramos el escudo oficial desde los fixtures para que no dé 404.
LOGO_PATH=$(docker compose exec -T -e BASE="$BASE" db sh -c 'psql -tA -U $POSTGRES_USER -d ${BASE:-$POSTGRES_DB} -c "SELECT club_logo FROM configuracion_general LIMIT 1;"' | tr -d '\r\n' || true)
if [ -n "$LOGO_PATH" ]; then
    docker compose exec -T -e LOGO="$LOGO_PATH" backend sh -c 'T="/app/media/$LOGO"; [ -f "$T" ] || { mkdir -p "$(dirname "$T")" && cp /app/configuracion/fixtures/escudo-sin-fondo.png "$T"; }' \
        || echo -e "\033[33mNo se pudo restaurar el logo del club.\033[0m"
fi

DIFERENCIAS=$(diff -u <(echo "$HUELLA_ORIGEN") <(echo "$HUELLA_ACTUAL") || true)

if [ -n "$DIFERENCIAS" ]; then
    echo -e "\033[31mLos datos NO coinciden con la PC de origen:\033[0m" >&2
    echo "$DIFERENCIAS" >&2
    exit 1
fi

echo -e "\033[32mListo. Los datos son idénticos a los de la PC de origen.\033[0m"

