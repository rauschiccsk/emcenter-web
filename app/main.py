"""EM Center Web — Coming Soon holding page."""

import logging
import os
import re
import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import pg8000
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
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
app = FastAPI(title="EM Center Web", docs_url=None, redoc_url=None)
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
    allow_methods=["GET", "POST"],
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
    logger.info("EM Center Web starting up...")
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
    """Render landing page."""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "emcenter-web"}


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
