#!/bin/bash

echo "[CLEANUP] Removing everything from /var/www/zeizzu_rewrite_api (except .env and system dirs)"

# Remove all files and folders
rm -rf /var/www/zeizzu_rewrite_api/*

# Optional: remove specific hidden files EXCEPT .env (modify as needed)
find /var/www/zeizzu_rewrite_api -maxdepth 1 -type f -name ".*" ! -name ".env" -exec rm -f {} \;

echo "[CLEANUP] Done."

