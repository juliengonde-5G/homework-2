#!/bin/bash
set -euo pipefail

# =============================================================================
# Lumos - Script d'installation initiale du VPS OVH
# Usage: ssh root@YOUR_VPS_IP 'bash -s' < deploy/setup-vps.sh
# =============================================================================

APP_USER="lumos"
APP_DIR="/home/$APP_USER/app"

echo "=== [1/7] Mise à jour du système ==="
apt-get update && apt-get upgrade -y

echo "=== [2/7] Installation des dépendances ==="
apt-get install -y \
  ca-certificates curl gnupg lsb-release \
  ufw fail2ban git unzip

echo "=== [3/7] Installation de Docker ==="
if ! command -v docker &> /dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable docker
  echo "Docker installé."
else
  echo "Docker déjà installé."
fi

echo "=== [4/7] Installation de Nginx ==="
if ! command -v nginx &> /dev/null; then
  apt-get install -y nginx
  systemctl enable nginx
  echo "Nginx installé."
else
  echo "Nginx déjà installé."
fi

echo "=== [5/7] Configuration du firewall (UFW) ==="
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
echo "y" | ufw enable
ufw status

echo "=== [6/7] Création de l'utilisateur applicatif ==="
if ! id "$APP_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" "$APP_USER"
  usermod -aG docker "$APP_USER"
  echo "Utilisateur '$APP_USER' créé et ajouté au groupe docker."
else
  usermod -aG docker "$APP_USER"
  echo "Utilisateur '$APP_USER' existe déjà."
fi

mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "=== [7/7] Configuration de fail2ban ==="
cat > /etc/fail2ban/jail.local <<'JAIL'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
JAIL
systemctl restart fail2ban

echo ""
echo "==========================================="
echo "  VPS prêt pour le déploiement Lumos !"
echo "==========================================="
echo ""
echo "Prochaines étapes :"
echo "  1. Copier les fichiers du projet sur le VPS :"
echo "     scp -r . $APP_USER@YOUR_VPS_IP:~/app/"
echo ""
echo "  2. Créer le fichier .env sur le VPS :"
echo "     ssh $APP_USER@YOUR_VPS_IP"
echo "     cp ~/app/deploy/.env.production.example ~/app/.env"
echo "     nano ~/app/.env  # Remplir les valeurs"
echo ""
echo "  3. Lancer le déploiement :"
echo "     cd ~/app && bash deploy/deploy.sh"
echo ""
