#!/bin/sh
set -eu
umask 077
mkdir -p backups
docker compose exec -T postgres pg_dump -U atlas -d atlas -Fc > "backups/atlas-$(date -u +%Y%m%dT%H%M%SZ).dump"
echo "Sauvegarde créée dans backups/. Copiez-la vers un stockage indépendant et chiffré."
