# EM Center Web — Coming Soon

Dočasná holding page pre emcenter.sk počas migrácie e-shopu OASIS EM-1.

## Stack
- Python 3.12 + FastAPI + pg8000
- PostgreSQL (emcenter_db)
- Docker + Nginx reverse proxy

## Deploy workflow

### Staging (develop vetva)
```bash
./deploy-staging.sh
```
- Branch: `develop`
- Port: **9163**
- Compose: `docker-compose.staging.yml`

### Production (main vetva)
```bash
./deploy-production.sh
```
- Branch: `main`
- Port: **9162**
- Compose: `docker-compose.production.yml`

### Postup nasadenia
1. Vývoj prebieha na vetve `develop`
2. Deploy na staging: `./deploy-staging.sh` (port 9163)
3. Po overení na stagingu — merge `develop` → `main`
4. Deploy na production: `./deploy-production.sh` (port 9162)

## Spustenie (default = staging)
```bash
docker compose up -d --build
```

## Porty
- Staging: 9163
- Production: 9162
- Interný: 8000 (uvicorn)

## Endpointy
- GET / — landing page
- POST /api/contact — kontaktný formulár
- GET /health — health check
