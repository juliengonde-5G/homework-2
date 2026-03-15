#!/bin/bash
set -euo pipefail

# =============================================================================
# Lumos - Script de déploiement
# Usage: cd ~/app && bash deploy/deploy.sh
# =============================================================================

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$APP_DIR/.env"
BACKUP_DIR="$APP_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

cd "$APP_DIR"

echo "=== Déploiement Lumos - $(date) ==="

# Vérifier le fichier .env
if [ ! -f "$ENV_FILE" ]; then
  echo "ERREUR: Fichier .env manquant !"
  echo "Copier deploy/.env.production.example vers .env et remplir les valeurs."
  exit 1
fi

# Charger les variables
set -a
source "$ENV_FILE"
set +a

# Vérifications
if [ "${JWT_SECRET:-}" = "change-me-in-production" ] || [ -z "${JWT_SECRET:-}" ]; then
  echo "ERREUR: JWT_SECRET doit être défini avec une valeur sécurisée !"
  exit 1
fi

if [ -z "${DB_PASSWORD:-}" ]; then
  echo "ERREUR: DB_PASSWORD est requis !"
  exit 1
fi

# Backup de la base si le conteneur tourne
echo "=== Backup de la base de données ==="
mkdir -p "$BACKUP_DIR"
if docker compose ps db --format json 2>/dev/null | grep -q running; then
  docker compose exec -T db pg_dump -U homework homework_db | gzip > "$BACKUP_DIR/db_$TIMESTAMP.sql.gz"
  echo "Backup créé : $BACKUP_DIR/db_$TIMESTAMP.sql.gz"
  # Garder seulement les 10 derniers backups
  ls -t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm
else
  echo "Base de données non active, pas de backup."
fi

# Pull des dernières images de base
echo "=== Pull des images ==="
docker compose pull db

# Build et déploiement
echo "=== Build de l'application ==="
docker compose build --no-cache app

echo "=== Démarrage des services ==="
docker compose up -d

# Attendre que l'app soit prête
echo "=== Vérification de santé ==="
MAX_WAIT=60
WAITED=0
until docker compose exec -T app wget --no-verbose --tries=1 --spider http://localhost:3001/api/legal/privacy 2>/dev/null; do
  if [ $WAITED -ge $MAX_WAIT ]; then
    echo "ERREUR: L'application n'a pas démarré après ${MAX_WAIT}s"
    echo "Logs :"
    docker compose logs --tail=50 app
    exit 1
  fi
  sleep 2
  WAITED=$((WAITED + 2))
  echo "  En attente... (${WAITED}s)"
done

echo ""
echo "=== Configuration Nginx ==="
NGINX_CONF="/etc/nginx/sites-available/lumos"
if [ -f "$APP_DIR/deploy/nginx.conf" ]; then
  if [ -w /etc/nginx/sites-available ] || [ "$(id -u)" = "0" ]; then
    cp "$APP_DIR/deploy/nginx.conf" "$NGINX_CONF"

    # Remplacer le domaine/IP si défini
    if [ -n "${DOMAIN:-}" ]; then
      sed -i "s/server_name _;/server_name $DOMAIN;/" "$NGINX_CONF"
    fi

    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/lumos
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
    echo "Nginx configuré."
  else
    echo "ATTENTION: Permissions insuffisantes pour configurer Nginx."
    echo "Exécuter avec sudo ou en root pour la première fois."
  fi
fi

echo ""
echo "==========================================="
echo "  Lumos déployé avec succès !"
echo "==========================================="
docker compose ps
echo ""
if [ -n "${DOMAIN:-}" ]; then
  echo "URL: http://$DOMAIN"
else
  echo "URL: http://$(hostname -I | awk '{print $1}'):${PORT:-3001}"
fi
echo ""
