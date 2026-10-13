#!/bin/bash

echo "[START] Loading environment..."

# Load Node.js and pm2 into this shell
export NVM_DIR="/home/ubuntu/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 18

echo "[START] Starting app..."

cd /var/www/zeizzu_rewrite_api

# Start your processes
pm2 delete all
pm2 start index.js
pm2 start src/workers/notificationProcessor.js
pm2 start src/workers/scheduleNotificationJob.js
pm2 start src/workers/scheduleStatusChangeJob.js
pm2 start src/workers/tipWorker.js
pm2 start src/workers/cronHourlyEndWarn.js --name hourlyEndWarn
pm2 start src/workers/erpWorker.js
pnpm install google-auth-library
pm2 restart all
pm2 save

echo "[START] Done."

