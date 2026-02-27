"""EM Center Web — Coming Soon holding page."""

import logging
import os
import re
import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

import pg8000
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, field_validator

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("emcenter")

# --- FastAPI app ---
app = FastAPI(title="EM Center Web", docs_url=None, redoc_url=None)

# Static files & templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# --- Rate limiting (in-memory) ---
rate_limit_store: dict[str, list[float]] = {}
RATE_LIMIT_MAX = 5
RATE_LIMIT_WINDOW = 60  # seconds


def is_rate_limited(ip: str) -> bool:
    """Check if IP exceeded rate limit."""
    now = time.time()
    if ip not in rate_limit_store:
        rate_limit_store[ip] = []

    # Clean old entries
    rate_limit_store[ip] = [
        ts for ts in rate_limit_store[ip] if now - ts < RATE_LIMIT_WINDOW
    ]

    if len(rate_limit_store[ip]) >= RATE_LIMIT_MAX:
        return True

    rate_limit_store[ip].append(now)
    return False


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
        # Create indexes if they don't exist
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
SMTP_TO = os.environ.get("SMTP_TO", "odbyt@em-1.sk")


def smtp_available() -> bool:
    """Check if SMTP is configured."""
    return bool(SMTP_HOST and SMTP_USER)


def send_notification_email(name: str, email: str, phone: str, message: str):
    """Send email notification about new contact form submission."""
    if not smtp_available():
        logger.warning("SMTP not configured, skipping email notification")
        return

    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_FROM
        msg["To"] = SMTP_TO
        msg["Subject"] = f"EM Center — Nový kontakt: {name}"

        body = f"""Nový kontakt z holding page emcenter.sk:

Meno: {name}
E-mail: {email}
Telefón: {phone or 'neuvedený'}
Správa: {message or 'žiadna'}
"""
        msg.attach(MIMEText(body, "plain", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            if SMTP_PORT == 587:
                server.starttls()
                server.ehlo()
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [SMTP_TO], msg.as_string())

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


# --- Startup ---
@app.on_event("startup")
def on_startup():
    logger.info("EM Center Web starting up...")
    if not smtp_available():
        logger.warning(
            "SMTP is not configured. Email notifications will be disabled. "
            "Set SMTP_HOST and SMTP_USER environment variables to enable."
        )
    else:
        logger.info("SMTP configured: %s:%s", SMTP_HOST, SMTP_PORT)
    init_db()


# --- Endpoints ---
@app.get("/", response_class=HTMLResponse)
async def homepage(request: Request):
    """Render landing page."""
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/api/contact")
async def contact(request: Request, form: ContactForm):
    """Handle contact form submission."""
    client_ip = request.client.host if request.client else "unknown"

    # Honeypot check
    if form.website:
        logger.info("Honeypot triggered from IP: %s", client_ip)
        # Return fake success to not alert bots
        return JSONResponse(
            content={"status": "ok", "message": "Ďakujeme!"}
        )

    # Rate limiting
    if is_rate_limited(client_ip):
        logger.warning("Rate limit exceeded for IP: %s", client_ip)
        return JSONResponse(
            status_code=429,
            content={
                "status": "error",
                "message": "Príliš veľa požiadaviek. Skúste to o chvíľu.",
            },
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
        logger.info("Contact saved: %s <%s> from %s", form.name, form.email, client_ip)
    except Exception as e:
        logger.error("Failed to save contact to DB: %s", e)
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": "Chyba pri ukladaní. Skúste to prosím znova.",
            },
        )

    # Send email notification (non-blocking — failure doesn't affect response)
    try:
        send_notification_email(
            form.name, form.email, form.phone or "", form.message or ""
        )
    except Exception as e:
        logger.error("Email notification failed: %s", e)

    return JSONResponse(content={"status": "ok", "message": "Ďakujeme!"})


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "service": "emcenter-web"}
