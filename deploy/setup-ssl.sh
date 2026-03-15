#!/bin/bash
set -euo pipefail

# =============================================================================
# Lumos - Installation du certificat SSL Let's Encrypt
# Usage: sudo bash deploy/setup-ssl.sh votre-domaine.fr
# =============================================================================

DOMAIN="${1:?Usage: $0 <domaine>}"

echo "=== Installation de Certbot ==="
if ! command -v certbot &> /dev/null; then
  apt-get update
  apt-get install -y certbot python3-certbot-nginx
fi

echo "=== Mise à jour du server_name Nginx ==="
sed -i "s/server_name _;/server_name $DOMAIN;/" /etc/nginx/sites-available/lumos
nginx -t && systemctl reload nginx

echo "=== Obtention du certificat SSL ==="
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" --redirect

echo "=== Vérification du renouvellement automatique ==="
certbot renew --dry-run

echo ""
echo "==========================================="
echo "  SSL configuré pour $DOMAIN !"
echo "  URL: https://$DOMAIN"
echo "==========================================="
