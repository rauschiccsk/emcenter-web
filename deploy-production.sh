#!/bin/bash
cd /opt/emcenter-web-src
git pull origin main
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d

echo "Production deployed successfully"
curl -f http://localhost:9162/health || exit 1
