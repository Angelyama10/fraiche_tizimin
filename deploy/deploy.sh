#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/production.env}"
COMPOSE_FILE="${PROJECT_DIR}/compose.production.yml"
RUN_SEED=false
CHECK_ONLY=false

usage() {
  cat <<'EOF'
Uso: ./deploy/deploy.sh [--check] [--seed]

  --check Valida secretos y Docker Compose sin iniciar servicios.
  --seed  Carga los datos iniciales y crea/actualiza el administrador.
          Usalo en el primer despliegue, no en cada actualizacion.
EOF
}

for argument in "$@"; do
  case "${argument}" in
    --check) CHECK_ONLY=true ;;
    --seed) RUN_SEED=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Opcion desconocida: ${argument}" >&2; usage; exit 1 ;;
  esac
done

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Falta ${ENV_FILE}. Copia deploy/production.env.example y completa los valores." >&2
  exit 1
fi

if grep -Eq '(^|=)CHANGE_ME' "${ENV_FILE}"; then
  echo "Todavia hay valores CHANGE_ME en ${ENV_FILE}." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a

if [[ ! "${APP_DOMAIN:-}" =~ ^[a-zA-Z0-9.-]+$ ]]; then
  echo "APP_DOMAIN debe contener solo el dominio, sin https:// ni rutas." >&2
  exit 1
fi
JWT_SECRET_VALUE="${JWT_SECRET:-}"
CUSTOMER_JWT_SECRET_VALUE="${CUSTOMER_JWT_SECRET:-}"
ADMIN_PASSWORD_VALUE="${ADMIN_PASSWORD:-}"

if [[ "${#JWT_SECRET_VALUE}" -lt 32 || "${#CUSTOMER_JWT_SECRET_VALUE}" -lt 32 ]]; then
  echo "JWT_SECRET y CUSTOMER_JWT_SECRET deben tener al menos 32 caracteres." >&2
  exit 1
fi
if [[ "${JWT_SECRET_VALUE}" == "${CUSTOMER_JWT_SECRET_VALUE}" ]]; then
  echo "Los secretos JWT de personal y clientes deben ser diferentes." >&2
  exit 1
fi
if [[ ! "${WHATSAPP_PHONE:-}" =~ ^[0-9]{10,15}$ ]]; then
  echo "WHATSAPP_PHONE debe incluir solo digitos y codigo de pais." >&2
  exit 1
fi
if [[ "${#ADMIN_PASSWORD_VALUE}" -lt 12 ]]; then
  echo "ADMIN_PASSWORD debe tener al menos 12 caracteres." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "Docker Engine y Docker Compose no estan disponibles." >&2
  exit 1
fi

cd "${PROJECT_DIR}"
COMPOSE=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")

echo "Validando configuracion..."
"${COMPOSE[@]}" config --quiet

if [[ "${CHECK_ONLY}" == "true" ]]; then
  echo "Configuracion de produccion valida."
  exit 0
fi

echo "Construyendo imagenes de produccion..."
BUILD_SERVICES=(api web migrate)
if [[ "${RUN_SEED}" == "true" ]]; then
  BUILD_SERVICES+=(seed)
fi
"${COMPOSE[@]}" build --pull "${BUILD_SERVICES[@]}"

echo "Iniciando servicios de datos..."
"${COMPOSE[@]}" up -d --wait postgres redis minio
"${COMPOSE[@]}" run --rm minio-init

echo "Aplicando migraciones..."
"${COMPOSE[@]}" run --rm migrate

if [[ "${RUN_SEED}" == "true" ]]; then
  echo "Cargando datos iniciales..."
  "${COMPOSE[@]}" --profile tools run --rm seed
fi

echo "Publicando API, frontend y HTTPS..."
"${COMPOSE[@]}" up -d --wait --remove-orphans api web caddy

echo "Comprobando servicios..."
curl --fail --silent --show-error --retry 12 --retry-delay 5 \
  "https://api.${APP_DOMAIN}/api/v1/health"
echo
curl --fail --silent --show-error --retry 12 --retry-delay 5 \
  --output /dev/null "https://${APP_DOMAIN}/"

"${COMPOSE[@]}" ps
echo
echo "Despliegue terminado: https://${APP_DOMAIN}"
