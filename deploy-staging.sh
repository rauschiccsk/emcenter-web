#!/bin/bash
cd /opt/emcenter-web-src
git pull origin develop
docker compose -f docker-compose.staging.yml build
docker compose -f docker-compose.staging.yml up -d

echo "Staging deployed successfully"
curl -f http://localhost:9163/health || exit 1
