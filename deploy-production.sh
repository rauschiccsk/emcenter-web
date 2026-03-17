#!/bin/bash
cd /opt/emcenter-web-src
git pull origin main
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
