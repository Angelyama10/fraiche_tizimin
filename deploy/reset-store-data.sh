#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/production.env}"
CONFIRMATION="${1:-}"

if [[ "${CONFIRMATION}" != "--confirm-reset" ]]; then
  cat >&2 <<'EOF'
Este comando elimina productos, inventario, clientes, pedidos, pagos,
promociones y registros de prueba. Conserva el administrador, el contenido
visual del sitio, las reglas de precio y las instrucciones de pago.

Uso: ./deploy/reset-store-data.sh --confirm-reset
EOF
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Falta ${ENV_FILE}." >&2
  exit 1
fi

COMPOSE=(docker compose --env-file "${ENV_FILE}" -f "${PROJECT_DIR}/compose.production.yml")

echo "Creando respaldo obligatorio antes de limpiar..."
"${SCRIPT_DIR}/backup-postgres.sh"

echo "Limpiando datos comerciales de prueba..."
"${COMPOSE[@]}" exec -T postgres sh -lc \
  'psql --set ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"' \
  < "${SCRIPT_DIR}/reset-store-data.sql"

echo "Reiniciando API y Redis..."
"${COMPOSE[@]}" restart api redis

echo "Datos comerciales eliminados. El administrador y la configuracion permanecen."
