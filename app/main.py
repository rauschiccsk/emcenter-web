"""EM Technológia Web — OASIS EM-1 landing page."""

import logging
import os
import re
import smtplib
import subprocess
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional

import httpx
import markdown
import pg8000
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, field_validator
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("emcenter")

# --- Rate limiter (slowapi) ---
limiter = Limiter(key_func=get_remote_address)

# --- FastAPI app ---
app = FastAPI(title="EM Technológia Web", docs_url=None, redoc_url=None)
app.state.limiter = limiter

# CORS middleware
ALLOWED_ORIGINS = [
    "https://emcenter.isnex.eu",
    "https://emcenter.sk",
    "https://www.emcenter.sk",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["*"],
)


# Rate limit error handler
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "detail": "Príliš veľa požiadaviek. Skúste to o chvíľu.",
        },
    )


# Static files & templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="app/templates")


# --- DB connection (pg8000) ---
def get_db_connection():
    """Create a new pg8000 database connection."""
    return pg8000.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", "9150")),
        database=os.environ.get("DB_NAME", "emcenter_db"),
        user=os.environ.get("DB_USER", "emcenter_user"),
        password=os.environ.get("DB_PASSWORD", ""),
    )


def init_db():
    """Create table if not exists."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS emcenter_contacts (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                message TEXT,
                ip_address VARCHAR(45),
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_emcenter_contacts_email
            ON emcenter_contacts(email)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_emcenter_contacts_created
            ON emcenter_contacts(created_at)
        """)
        conn.commit()
        cursor.close()
        conn.close()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error("Failed to initialize database: %s", e)


# --- SMTP ---
# --- NEX Automat ESHOP API ---
NEX_API_BASE = os.environ.get("ESHOP_API_URL", os.environ.get("NEX_API_BASE", "http://localhost:9110"))
ESHOP_TOKEN = os.environ.get("ESHOP_API_TOKEN", os.environ.get("ESHOP_TOKEN", ""))

ENVIRONMENT = os.environ.get("ENVIRONMENT", "production")

UMAMI_WEBSITE_ID = os.environ.get("UMAMI_WEBSITE_ID", "")
UMAMI_SCRIPT_URL = os.environ.get("UMAMI_SCRIPT_URL", "")

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "noreply@em-1.sk")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "odbyt@em-1.sk")


def smtp_available() -> bool:
    """Check if SMTP is configured."""
    return bool(SMTP_HOST)


def send_notification_email(name: str, email: str, phone: str, message: str):
    """Send email notification about new contact form submission."""
    if not smtp_available():
        logger.warning("SMTP not configured, skipping email notification")
        return

    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_FROM
        msg["To"] = ADMIN_EMAIL
        msg["Subject"] = f"Nový kontakt z emcenter.sk: {name}"

        body = (
            f"Nový kontakt z holding page emcenter.sk:\n\n"
            f"Meno: {name}\n"
            f"E-mail: {email}\n"
            f"Telefón: {phone or 'neuvedený'}\n"
            f"Správa: {message or 'žiadna'}\n"
            f"Čas: {time.strftime('%Y-%m-%d %H:%M:%S')}\n"
        )
        msg.attach(MIMEText(body, "plain", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            if SMTP_PORT == 587:
                server.starttls()
                server.ehlo()
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [ADMIN_EMAIL], msg.as_string())

        logger.info("Notification email sent for contact: %s", email)
    except Exception as e:
        logger.error("Failed to send email notification: %s", e)


# --- Pydantic model ---
class ContactForm(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    message: Optional[str] = None
    website: Optional[str] = None  # honeypot

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Meno je povinné")
        return v.strip()

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        v = v.strip()
        pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
        if not re.match(pattern, v):
            raise ValueError("Neplatný formát e-mailu")
        return v

    @field_validator("message")
    @classmethod
    def message_length(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v.strip()) > 500:
            raise ValueError("Správa môže mať maximálne 500 znakov")
        return v.strip() if v else v


# --- Startup ---
@app.on_event("startup")
def on_startup():
    logger.info("EM Technológia Web starting up...")
    if not smtp_available():
        logger.warning(
            "SMTP is not configured. Email notifications will be disabled. "
            "Set SMTP_HOST environment variable to enable."
        )
    else:
        logger.info("SMTP configured: %s:%s", SMTP_HOST, SMTP_PORT)
    init_db()


# --- Endpoints ---
@app.get("/", response_class=HTMLResponse)
async def homepage(request: Request):
    """Render OASIS EM-1 conversion landing page."""
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "umami_website_id": UMAMI_WEBSITE_ID,
            "umami_script_url": UMAMI_SCRIPT_URL,
            "version": _get_git_version(),
        },
    )


@app.get("/checkout", response_class=HTMLResponse)
async def checkout_page(request: Request):
    """Standalone checkout page — minimal header/footer, no marketing content."""
    return templates.TemplateResponse(
        "checkout.html",
        {
            "request": request,
            "umami_website_id": UMAMI_WEBSITE_ID,
            "umami_script_url": UMAMI_SCRIPT_URL,
        },
    )


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    """Customer login page."""
    return templates.TemplateResponse(
        "login.html",
        {
            "request": request,
            "umami_website_id": UMAMI_WEBSITE_ID,
            "umami_script_url": UMAMI_SCRIPT_URL,
        },
    )


@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    """Customer registration page."""
    return templates.TemplateResponse(
        "register.html",
        {
            "request": request,
            "umami_website_id": UMAMI_WEBSITE_ID,
            "umami_script_url": UMAMI_SCRIPT_URL,
        },
    )


@app.get("/account", response_class=HTMLResponse)
async def account_page(request: Request):
    """Customer account page (profile + orders)."""
    return templates.TemplateResponse(
        "account.html",
        {
            "request": request,
            "umami_website_id": UMAMI_WEBSITE_ID,
            "umami_script_url": UMAMI_SCRIPT_URL,
        },
    )


@app.get("/terms", response_class=HTMLResponse)
async def terms(request: Request):
    """Render terms and conditions page."""
    return templates.TemplateResponse("terms.html", {"request": request})


@app.get("/privacy", response_class=HTMLResponse)
async def privacy(request: Request):
    """Render privacy policy page."""
    return templates.TemplateResponse("privacy.html", {"request": request})


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "emcenter-web"}


# --- Version ---
def _get_git_version() -> str:
    """Get application version from ENV or git describe."""
    # Primary: read from ENV (set by Docker build args)
    env_version = os.environ.get("APP_VERSION")
    if env_version and env_version != "dev":
        return env_version

    # Fallback: git describe (local dev only)
    try:
        result = subprocess.run(
            ["git", "describe", "--tags", "--abbrev=0"],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "0.1.0"


def _get_git_commit() -> str:
    """Get git commit hash from ENV or git rev-parse."""
    # Primary: read from ENV
    env_commit = os.environ.get("APP_COMMIT")
    if env_commit and env_commit != "unknown":
        return env_commit

    # Fallback: git rev-parse (local dev only)
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown"


@app.get("/version")
async def get_version():
    """Return current version from git tag + commit hash."""
    return {"version": _get_git_version(), "commit": _get_git_commit()}


@app.post("/api/contact")
@limiter.limit("5/minute")
async def contact(request: Request, form: ContactForm):
    """Handle contact form submission."""
    client_ip = request.client.host if request.client else "unknown"

    # Origin validation
    origin = request.headers.get("origin", "")
    if origin and origin not in ALLOWED_ORIGINS:
        logger.warning("Rejected request from origin: %s (IP: %s)", origin, client_ip)
        return JSONResponse(
            status_code=403,
            content={"success": False, "detail": "Nepovolený prístup."},
        )

    # Honeypot check
    if form.website:
        logger.info("Honeypot triggered from IP: %s", client_ip)
        return JSONResponse(
            content={"success": True, "message": "Ďakujeme! Budeme vás kontaktovať."}
        )

    # Save to DB
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO emcenter_contacts (name, email, phone, message, ip_address)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (form.name, form.email, form.phone, form.message, client_ip),
        )
        conn.commit()
        cursor.close()
        conn.close()
        logger.info(
            "Contact saved: %s <%s> from %s", form.name, form.email, client_ip
        )
    except Exception as e:
        logger.error("Failed to save contact to DB: %s", e)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "detail": "Chyba pri ukladaní. Skúste to prosím znova.",
            },
        )

    # Send email notification (failure doesn't affect response)
    try:
        send_notification_email(
            form.name, form.email, form.phone or "", form.message or ""
        )
    except Exception as e:
        logger.error("Email notification failed: %s", e)

    return JSONResponse(
        content={
            "success": True,
            "message": "Ďakujeme! Budeme vás kontaktovať.",
        }
    )


# --- NEX Automat ESHOP API Proxy ---

@app.get("/api/products")
async def get_products():
    """Proxy to NEX Automat — list products."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{NEX_API_BASE}/api/eshop/products",
                headers={"X-Eshop-Token": ESHOP_TOKEN},
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type="application/json",
            )
    except (httpx.TimeoutException, httpx.ConnectError):
        logger.error("NEX API unavailable: GET /api/eshop/products")
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )
    except Exception as e:
        logger.error("Proxy error GET /api/products: %s", e)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )


@app.get("/api/products/{sku}")
async def get_product(sku: str):
    """Proxy to NEX Automat — product detail."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{NEX_API_BASE}/api/eshop/products/{sku}",
                headers={"X-Eshop-Token": ESHOP_TOKEN},
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type="application/json",
            )
    except (httpx.TimeoutException, httpx.ConnectError):
        logger.error("NEX API unavailable: GET /api/eshop/products/%s", sku)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )
    except Exception as e:
        logger.error("Proxy error GET /api/products/%s: %s", sku, e)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )


@app.post("/api/orders")
async def create_order(request: Request):
    """Proxy to NEX Automat — create order."""
    try:
        body = await request.json()
        # Staging test marker — automaticky pridaj order_notes na non-production
        if ENVIRONMENT != "production":
            body.setdefault(
                "order_notes",
                "TESTOVACIA OBJEDNAVKA – emcenter.isnex.eu staging",
            )
        # Forward Authorization header for customer_id resolution
        backend_headers = {
            "X-Eshop-Token": ESHOP_TOKEN,
            "Content-Type": "application/json",
        }
        auth_header = request.headers.get("Authorization")
        if auth_header:
            backend_headers["Authorization"] = auth_header

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{NEX_API_BASE}/api/eshop/orders",
                headers=backend_headers,
                json=body,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type="application/json",
            )
    except (httpx.TimeoutException, httpx.ConnectError):
        logger.error("NEX API unavailable: POST /api/eshop/orders")
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )
    except Exception as e:
        logger.error("Proxy error POST /api/orders: %s", e)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )


@app.get("/api/orders/{order_number}")
async def get_order_status(order_number: str):
    """Proxy to NEX Automat — order status."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{NEX_API_BASE}/api/eshop/orders/{order_number}",
                headers={"X-Eshop-Token": ESHOP_TOKEN},
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type="application/json",
            )
    except (httpx.TimeoutException, httpx.ConnectError):
        logger.error("NEX API unavailable: GET /api/eshop/orders/%s", order_number)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )
    except Exception as e:
        logger.error("Proxy error GET /api/orders/%s: %s", order_number, e)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )


@app.post("/api/leads")
async def proxy_lead_register(request: Request):
    """Proxy pre lead registráciu → NEX Automat API."""
    try:
        body = await request.json()
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{NEX_API_BASE}/api/eshop/leads",
                headers={
                    "X-Eshop-Token": ESHOP_TOKEN,
                    "Content-Type": "application/json",
                },
                json=body,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type="application/json",
            )
    except (httpx.TimeoutException, httpx.ConnectError):
        logger.error("NEX API unavailable: POST /api/eshop/leads")
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )
    except Exception as e:
        logger.error("Proxy error POST /api/leads: %s", e)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )


@app.get("/api/leads/validate/{discount_code}")
async def proxy_lead_validate(discount_code: str):
    """Proxy pre validáciu discount kódu."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{NEX_API_BASE}/api/eshop/leads/validate/{discount_code}",
                headers={"X-Eshop-Token": ESHOP_TOKEN},
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type="application/json",
            )
    except (httpx.TimeoutException, httpx.ConnectError):
        logger.error(
            "NEX API unavailable: GET /api/eshop/leads/validate/%s", discount_code
        )
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )
    except Exception as e:
        logger.error("Proxy error GET /api/leads/validate/%s: %s", discount_code, e)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )


# --- Customer Auth Proxy Endpoints ---


@app.post("/api/eshop/customers/register")
async def proxy_customer_register(request: Request):
    """Proxy to NEX Automat — customer registration."""
    try:
        body = await request.json()
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{NEX_API_BASE}/api/eshop/customers/register",
                headers={
                    "X-Eshop-Token": ESHOP_TOKEN,
                    "Content-Type": "application/json",
                },
                json=body,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type="application/json",
            )
    except (httpx.TimeoutException, httpx.ConnectError):
        logger.error("NEX API unavailable: POST /api/eshop/customers/register")
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )
    except Exception as e:
        logger.error("Proxy error POST /api/eshop/customers/register: %s", e)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )


@app.post("/api/eshop/customers/login")
async def proxy_customer_login(request: Request):
    """Proxy to NEX Automat — customer login."""
    try:
        body = await request.json()
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{NEX_API_BASE}/api/eshop/customers/login",
                headers={
                    "X-Eshop-Token": ESHOP_TOKEN,
                    "Content-Type": "application/json",
                },
                json=body,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type="application/json",
            )
    except (httpx.TimeoutException, httpx.ConnectError):
        logger.error("NEX API unavailable: POST /api/eshop/customers/login")
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )
    except Exception as e:
        logger.error("Proxy error POST /api/eshop/customers/login: %s", e)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )


@app.get("/api/eshop/customers/profile")
async def proxy_customer_profile(request: Request):
    """Proxy to NEX Automat — customer profile."""
    try:
        fwd_headers = {"X-Eshop-Token": ESHOP_TOKEN}
        auth = request.headers.get("Authorization")
        if auth:
            fwd_headers["Authorization"] = auth
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{NEX_API_BASE}/api/eshop/customers/profile",
                headers=fwd_headers,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type="application/json",
            )
    except (httpx.TimeoutException, httpx.ConnectError):
        logger.error("NEX API unavailable: GET /api/eshop/customers/profile")
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )
    except Exception as e:
        logger.error("Proxy error GET /api/eshop/customers/profile: %s", e)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )


@app.get("/api/eshop/customers/orders")
async def proxy_customer_orders(request: Request):
    """Proxy to NEX Automat — customer orders."""
    try:
        fwd_headers = {"X-Eshop-Token": ESHOP_TOKEN}
        auth = request.headers.get("Authorization")
        if auth:
            fwd_headers["Authorization"] = auth
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{NEX_API_BASE}/api/eshop/customers/orders",
                headers=fwd_headers,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type="application/json",
            )
    except (httpx.TimeoutException, httpx.ConnectError):
        logger.error("NEX API unavailable: GET /api/eshop/customers/orders")
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )
    except Exception as e:
        logger.error("Proxy error GET /api/eshop/customers/orders: %s", e)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )


@app.put("/api/eshop/customers/profile")
async def proxy_update_customer_profile(request: Request):
    """Proxy PUT request to backend — update customer profile."""
    try:
        body = await request.json()
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.put(
                f"{NEX_API_BASE}/api/eshop/customers/profile",
                json=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Eshop-Token": ESHOP_TOKEN,
                    "Authorization": request.headers.get("Authorization", ""),
                },
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type="application/json",
            )
    except (httpx.TimeoutException, httpx.ConnectError):
        logger.error("NEX API unavailable: PUT /api/eshop/customers/profile")
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )
    except Exception as e:
        logger.error("Proxy error PUT /api/eshop/customers/profile: %s", e)
        return JSONResponse(
            status_code=502,
            content={"detail": "Proxy error"},
        )


@app.put("/api/eshop/customers/password")
async def proxy_change_customer_password(request: Request):
    """Proxy PUT request to backend — change customer password."""
    try:
        body = await request.json()
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.put(
                f"{NEX_API_BASE}/api/eshop/customers/password",
                json=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Eshop-Token": ESHOP_TOKEN,
                    "Authorization": request.headers.get("Authorization", ""),
                },
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type="application/json",
            )
    except (httpx.TimeoutException, httpx.ConnectError):
        logger.error("NEX API unavailable: PUT /api/eshop/customers/password")
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )
    except Exception as e:
        logger.error("Proxy error PUT /api/eshop/customers/password: %s", e)
        return JSONResponse(
            status_code=502,
            content={"detail": "Proxy error"},
        )


@app.get("/api/eshop/customers/orders/{order_number}")
async def proxy_customer_order_detail(order_number: str, request: Request):
    """Proxy to NEX Automat — customer order detail."""
    try:
        fwd_headers = {"X-Eshop-Token": ESHOP_TOKEN}
        auth = request.headers.get("Authorization")
        if auth:
            fwd_headers["Authorization"] = auth
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{NEX_API_BASE}/api/eshop/customers/orders/{order_number}",
                headers=fwd_headers,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type="application/json",
            )
    except (httpx.TimeoutException, httpx.ConnectError):
        logger.error("NEX API unavailable: GET /api/eshop/customers/orders/%s", order_number)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )
    except Exception as e:
        logger.error("Proxy error GET /api/eshop/customers/orders/%s: %s", order_number, e)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )


@app.post("/api/eshop/customers/orders/{order_number}/pay")
async def proxy_customer_order_retry_payment(order_number: str, request: Request):
    """Proxy to NEX Automat — retry customer order payment."""
    try:
        fwd_headers = {"X-Eshop-Token": ESHOP_TOKEN}
        auth = request.headers.get("Authorization")
        if auth:
            fwd_headers["Authorization"] = auth
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{NEX_API_BASE}/api/eshop/customers/orders/{order_number}/pay",
                headers=fwd_headers,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type="application/json",
            )
    except (httpx.TimeoutException, httpx.ConnectError):
        logger.error("NEX API unavailable: POST /api/eshop/customers/orders/%s/pay", order_number)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )
    except Exception as e:
        logger.error("Proxy error POST /api/eshop/customers/orders/%s/pay: %s", order_number, e)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )


@app.get("/api/eshop/customers/orders/{order_number}/invoice/check")
async def proxy_customer_invoice_check(order_number: str, request: Request):
    """Proxy to NEX Automat — check if invoice PDF is available."""
    try:
        fwd_headers = {"X-Eshop-Token": ESHOP_TOKEN}
        auth = request.headers.get("Authorization")
        if auth:
            fwd_headers["Authorization"] = auth
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{NEX_API_BASE}/api/eshop/customers/orders/{order_number}/invoice/check",
                headers=fwd_headers,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type="application/json",
            )
    except (httpx.TimeoutException, httpx.ConnectError):
        logger.error("NEX API unavailable: GET /api/eshop/customers/orders/%s/invoice/check", order_number)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )
    except Exception as e:
        logger.error("Proxy error GET /api/eshop/customers/orders/%s/invoice/check: %s", order_number, e)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )


@app.get("/api/eshop/customers/orders/{order_number}/invoice")
async def proxy_customer_invoice_download(order_number: str, request: Request):
    """Proxy to NEX Automat — download invoice PDF."""
    try:
        fwd_headers = {"X-Eshop-Token": ESHOP_TOKEN}
        auth = request.headers.get("Authorization")
        if auth:
            fwd_headers["Authorization"] = auth
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{NEX_API_BASE}/api/eshop/customers/orders/{order_number}/invoice",
                headers=fwd_headers,
            )
            content_type = resp.headers.get("content-type", "application/octet-stream")
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=content_type,
                headers={
                    k: v
                    for k, v in resp.headers.items()
                    if k.lower() in ("content-disposition",)
                },
            )
    except (httpx.TimeoutException, httpx.ConnectError):
        logger.error("NEX API unavailable: GET /api/eshop/customers/orders/%s/invoice", order_number)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )
    except Exception as e:
        logger.error("Proxy error GET /api/eshop/customers/orders/%s/invoice: %s", order_number, e)
        return JSONResponse(
            status_code=502,
            content={"detail": "Backend service unavailable"},
        )


# --- Legal Pages ---

# Path to knowledge base markdown files
_KB_DIR = Path("/home/icc/knowledge/projects/emcenter-web")


def _md_to_html(md_path: Path) -> str:
    """Convert a markdown file to HTML, or return empty string if not found."""
    if md_path.exists():
        return markdown.markdown(md_path.read_text(encoding="utf-8"), extensions=["tables"])
    return ""


@app.get("/vop", response_class=HTMLResponse)
async def vop_page(request: Request):
    """Všeobecné obchodné podmienky."""
    content = _md_to_html(_KB_DIR / "VOP.md")
    return templates.TemplateResponse(
        "vop.html",
        {"request": request, "vop_content": content},
    )


@app.get("/ochrana-osobnych-udajov", response_class=HTMLResponse)
async def privacy_page(request: Request):
    """Ochrana osobných údajov."""
    content = _md_to_html(_KB_DIR / "PRIVACY_POLICY.md")
    return templates.TemplateResponse(
        "privacy.html",
        {"request": request, "privacy_content": content},
    )


@app.get("/odstupenie-od-zmluvy", response_class=HTMLResponse)
async def withdrawal_page(request: Request):
    """Odstúpenie od zmluvy — formulár."""
    return templates.TemplateResponse(
        "withdrawal.html",
        {"request": request},
    )


@app.post("/api/eshop/payment/callback")
async def payment_callback(request: Request):
    """Comgate payment callback proxy (public, no auth).

    Comgate sends POST with application/x-www-form-urlencoded body.
    We forward it as-is to the NEX Automat backend and return the response.
    Expected backend response: ``code=0&message=OK``
    """
    try:
        body = await request.body()
        fwd_headers = {
            "Content-Type": request.headers.get(
                "content-type", "application/x-www-form-urlencoded"
            ),
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{NEX_API_BASE}/api/eshop/payment/callback",
                headers=fwd_headers,
                content=body,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("content-type", "text/plain"),
            )
    except (httpx.TimeoutException, httpx.ConnectError):
        logger.error("NEX API unavailable: POST /api/eshop/payment/callback")
        return Response(content=b"code=1&message=Backend unavailable", status_code=502)
    except Exception as e:
        logger.error("Proxy error POST /api/eshop/payment/callback: %s", e)
        return Response(content=b"code=1&message=Proxy error", status_code=502)


@app.get("/payment/return")
async def payment_return(request: Request):
    """Comgate redirect after payment — show thank you or failure page."""
    trans_id = request.query_params.get("id", "")
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{NEX_API_BASE}/api/eshop/payment/return",
                headers={"X-Eshop-Token": ESHOP_TOKEN},
                params={"id": trans_id},
            )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("payment_status") == "paid":
                return templates.TemplateResponse(
                    "order_success.html",
                    {
                        "request": request,
                        "order_number": data.get("order_number", ""),
                        "status": data.get("status", ""),
                    },
                )
            else:
                return templates.TemplateResponse(
                    "order_failed.html",
                    {
                        "request": request,
                        "order_number": data.get("order_number", ""),
                    },
                )
    except Exception:
        pass
    return templates.TemplateResponse(
        "order_failed.html",
        {"request": request, "order_number": ""},
    )
