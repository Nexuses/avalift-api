#!/bin/bash

echo "[INSTALL] Restoring preserved config files..."

# Copy shared config files — will overwrite if they exist
sudo cp /var/www/shared/src/config/database.js /var/www/zeizzu_rewrite_api/src/config/
sudo cp /var/www/shared/src/config/config.json /var/www/zeizzu_rewrite_api/src/config/
sudo cp /var/www/shared/src/config/redis.js /var/www/zeizzu_rewrite_api/src/config/
sudo cp /var/www/shared/src/queues/notificationQueue.js /var/www/zeizzu_rewrite_api/src/queues/

# Copy .env file
sudo cp /var/www/shared/.env /var/www/zeizzu_rewrite_api/

echo "[INSTALL] File restoration complete."

# Load NVM and set correct Node version
export NVM_DIR="/home/ubuntu/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use 18

# Install pnpm if missing
if ! command -v pnpm &> /dev/null; then
  echo "[INSTALL] Installing pnpm..."
  npm install -g pnpm
fi

# Install app dependencies
cd /var/www/zeizzu_rewrite_api
pnpm install

echo "[INSTALL] Done."

