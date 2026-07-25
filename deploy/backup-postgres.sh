#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/production.env}"
BACKUP_DIR="${BACKUP_DIR:-${SCRIPT_DIR}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Falta ${ENV_FILE}." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a

mkdir -p "${BACKUP_DIR}"
chmod 0700 "${BACKUP_DIR}"

TIMESTAMP="$(date -u +'%Y%m%dT%H%M%SZ')"
BACKUP_FILE="${BACKUP_DIR}/perfumes-${TIMESTAMP}.dump"
COMPOSE=(docker compose --env-file "${ENV_FILE}" -f "${PROJECT_DIR}/compose.production.yml")

"${COMPOSE[@]}" exec -T postgres \
  pg_dump --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" --format custom \
  > "${BACKUP_FILE}"

chmod 0600 "${BACKUP_FILE}"
find "${BACKUP_DIR}" -type f -name 'perfumes-*.dump' -mtime "+${RETENTION_DAYS}" -delete

echo "Respaldo creado: ${BACKUP_FILE}"

