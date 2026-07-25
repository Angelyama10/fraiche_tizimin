#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/production.env}"
BACKUP_FILE="${1:-}"

if [[ -z "${BACKUP_FILE}" || ! -f "${BACKUP_FILE}" ]]; then
  echo "Uso: ./deploy/restore-postgres.sh deploy/backups/perfumes-FECHA.dump" >&2
  exit 1
fi
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Falta ${ENV_FILE}." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a

read -r -p "Esto reemplazara los datos actuales. Escribe RESTAURAR para continuar: " confirmation
if [[ "${confirmation}" != "RESTAURAR" ]]; then
  echo "Restauracion cancelada."
  exit 0
fi

COMPOSE=(docker compose --env-file "${ENV_FILE}" -f "${PROJECT_DIR}/compose.production.yml")
SERVICES_STOPPED=false
restart_services() {
  if [[ "${SERVICES_STOPPED}" == "true" ]]; then
    "${COMPOSE[@]}" up -d api web >/dev/null
  fi
}
trap restart_services EXIT

"${COMPOSE[@]}" stop api web
SERVICES_STOPPED=true
"${COMPOSE[@]}" exec -T postgres \
  pg_restore --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" \
  --clean --if-exists --no-owner --no-privileges < "${BACKUP_FILE}"
"${COMPOSE[@]}" up -d --wait api web
SERVICES_STOPPED=false

echo "Base de datos restaurada desde ${BACKUP_FILE}."
