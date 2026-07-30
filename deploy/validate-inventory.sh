#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/production.env}"
EXPECTED_PRODUCTS="${EXPECTED_PRODUCTS:-1027}"
EXPECTED_ZERO_STOCK="${EXPECTED_ZERO_STOCK:-115}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Falta ${ENV_FILE}." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a

COMPOSE=(docker compose --env-file "${ENV_FILE}" -f "${PROJECT_DIR}/compose.production.yml")

echo "Validando INVENTARIO 3.0 en PostgreSQL..."
"${COMPOSE[@]}" exec -T postgres psql \
  --set ON_ERROR_STOP=1 \
  --set expected_products="${EXPECTED_PRODUCTS}" \
  --set expected_zero_stock="${EXPECTED_ZERO_STOCK}" \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  < "${SCRIPT_DIR}/validate-inventory.sql"

echo "INVENTARIO 3.0 validado correctamente."
