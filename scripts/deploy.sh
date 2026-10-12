#!/bin/sh
set -eu
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_DIR"
if ! command -v docker >/dev/null 2>&1; then
  echo "Installez Docker Engine et Compose : https://docs.docker.com/engine/install/ubuntu/" >&2
  exit 1
fi
docker compose version >/dev/null
if [ ! -f .env ]; then
  docker run --rm --user "$(id -u):$(id -g)" -v "$PROJECT_DIR:/app" -w /app node:24-bookworm-slim node scripts/setup-env.mjs
  echo "Renseignez .env : valeurs Discord, DOMAIN, ACME_EMAIL, APP_URL=https://votre-domaine, NODE_ENV=production. Puis relancez ce script."
  exit 1
fi
# Ne pas afficher 'compose config' : il contient les secrets interpolés.
compose() { docker compose -f docker-compose.yml -f docker-compose.prod.yml "$@"; }
compose config --quiet
compose build web bot migrate
compose run --rm --no-deps web node scripts/check-production.mjs --discord
compose up -d
compose exec -T web node scripts/check-production.mjs --wait
echo "Testez maintenant le site en HTTPS et la connexion Discord. La disponibilité du domaine dépend des DNS et des ports 80/443."
