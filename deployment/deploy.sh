#!/usr/bin/env bash
set -euo pipefail

# Deploy the service to Google Cloud Run.
# Usage:
#   PROJECT_ID=my-project REGION=us-central1 SERVICE_NAME=ecc-calculator ./deploy.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-ecc-calculator}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "PROJECT_ID is required. Set it in the environment and rerun." >&2
  exit 1
fi

echo "Building container image ${IMAGE}..."
# Copy Dockerfile to root for gcloud build compatibility
cp "${ROOT_DIR}/deployment/Dockerfile" "${ROOT_DIR}/Dockerfile"
gcloud builds submit --tag "${IMAGE}" .
# Clean up
rm -f "${ROOT_DIR}/Dockerfile"

echo "Deploying ${SERVICE_NAME} to Cloud Run in ${REGION}..."
EXTRA_ENV_ARGS=()
if [[ -n "${FLASK_SECRET_KEY:-}" ]]; then
  EXTRA_ENV_ARGS+=(--set-env-vars "FLASK_SECRET_KEY=${FLASK_SECRET_KEY}")
fi
if [[ -n "${DB_PATH:-}" ]]; then
  EXTRA_ENV_ARGS+=(--set-env-vars "DB_PATH=${DB_PATH}")
fi

gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  "${EXTRA_ENV_ARGS[@]}"

echo "Deployment complete."
