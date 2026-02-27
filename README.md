# EM Center Web — Coming Soon

Dočasná holding page pre emcenter.sk počas migrácie e-shopu OASIS EM-1.

## Stack
- Python 3.12 + FastAPI + pg8000
- PostgreSQL (emcenter_db)
- Docker + Nginx reverse proxy

## Spustenie
docker compose up -d --build

## Port
- Aplikácia: 9162
- Interný: 8000 (uvicorn)

## Endpointy
- GET / — landing page
- POST /api/contact — kontaktný formulár
- GET /health — health check
