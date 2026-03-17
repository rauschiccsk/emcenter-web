#!/bin/bash
cd /opt/emcenter-web-src
git pull origin develop
docker compose -f docker-compose.staging.yml build
docker compose -f docker-compose.staging.yml up -d
