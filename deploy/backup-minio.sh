#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/production.env}"
BACKUP_ROOT="${MINIO_BACKUP_DIR:-${SCRIPT_DIR}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Falta ${ENV_FILE}." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a

mkdir -p "${BACKUP_ROOT}"
chmod 0700 "${BACKUP_ROOT}"

TIMESTAMP="$(date -u +'%Y%m%dT%H%M%SZ')"
BACKUP_PATH="${BACKUP_ROOT}/minio-${TIMESTAMP}"
mkdir -p "${BACKUP_PATH}"
chmod 0700 "${BACKUP_PATH}"

COMPOSE=(docker compose --env-file "${ENV_FILE}" -f "${PROJECT_DIR}/compose.production.yml")

"${COMPOSE[@]}" run --rm --no-deps \
  --user "$(id -u):$(id -g)" \
  --volume "${BACKUP_PATH}:/backup" \
  --entrypoint /bin/sh \
  minio-init -ec '
    export MC_CONFIG_DIR=/tmp/.mc
    mc alias set production http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null

    public_usage="$(mc du --json "production/$STORAGE_PUBLIC_BUCKET")"
    private_usage="$(mc du --json "production/$STORAGE_PRIVATE_BUCKET")"
    public_size="${public_usage#*\"size\":}"; public_size="${public_size%%,*}"
    private_size="${private_usage#*\"size\":}"; private_size="${private_size%%,*}"
    public_objects="${public_usage#*\"objects\":}"; public_objects="${public_objects%%,*}"
    private_objects="${private_usage#*\"objects\":}"; private_objects="${private_objects%%,*}"

    for value in "$public_size" "$private_size" "$public_objects" "$private_objects"; do
      case "$value" in
        ""|*[!0-9]*) echo "No fue posible medir los buckets de MinIO." >&2; exit 1 ;;
      esac
    done

    source_size=$((public_size + private_size))
    source_objects=$((public_objects + private_objects))
    set -- $(df -Pk /backup | tail -n 1)
    available_kb="${4:-}"
    case "$available_kb" in
      ""|*[!0-9]*) echo "No fue posible medir el espacio disponible para el respaldo." >&2; exit 1 ;;
    esac
    available_bytes=$((available_kb * 1024))
    safety_margin=$((source_size / 10))
    if [ "$safety_margin" -lt 268435456 ]; then safety_margin=268435456; fi
    required_bytes=$((source_size + safety_margin))
    if [ "$available_bytes" -lt "$required_bytes" ]; then
      echo "Espacio insuficiente para respaldar MinIO: se requieren $required_bytes bytes y hay $available_bytes." >&2
      exit 1
    fi

    mkdir -p /backup/public /backup/private
    mc mirror --preserve "production/$STORAGE_PUBLIC_BUCKET" /backup/public >/dev/null
    mc mirror --preserve "production/$STORAGE_PRIVATE_BUCKET" /backup/private >/dev/null

    copied_public_usage="$(mc du --json /backup/public)"
    copied_private_usage="$(mc du --json /backup/private)"
    copied_public_size="${copied_public_usage#*\"size\":}"; copied_public_size="${copied_public_size%%,*}"
    copied_private_size="${copied_private_usage#*\"size\":}"; copied_private_size="${copied_private_size%%,*}"
    copied_public_objects="${copied_public_usage#*\"objects\":}"; copied_public_objects="${copied_public_objects%%,*}"
    copied_private_objects="${copied_private_usage#*\"objects\":}"; copied_private_objects="${copied_private_objects%%,*}"
    copied_size=$((copied_public_size + copied_private_size))
    copied_objects=$((copied_public_objects + copied_private_objects))
    if [ "$copied_objects" -ne "$source_objects" ] || [ "$copied_size" -ne "$source_size" ]; then
      echo "Respaldo incompleto de MinIO: origen $source_objects objetos/$source_size bytes, copia $copied_objects objetos/$copied_size bytes." >&2
      exit 1
    fi

    printf "public=%s objetos, %s bytes\nprivate=%s objetos, %s bytes\ntotal=%s objetos, %s bytes\n" \
      "$public_objects" "$public_size" "$private_objects" "$private_size" \
      "$source_objects" "$source_size" > /backup/manifest.txt
  '

if [[ ! -s "${BACKUP_PATH}/manifest.txt" ]]; then
  echo "El respaldo de MinIO no genero un manifiesto valido; se detiene el despliegue." >&2
  exit 1
fi

chmod -R go-rwx "${BACKUP_PATH}"

while IFS= read -r -d '' expired_backup; do
  case "${expired_backup}" in
    "${BACKUP_ROOT}"/minio-20*T*Z) rm -rf -- "${expired_backup}" ;;
  esac
done < <(
  find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d \
    -name 'minio-20*T*Z' -mtime "+${RETENTION_DAYS}" -print0
)

echo "Respaldo de archivos creado: ${BACKUP_PATH}"
