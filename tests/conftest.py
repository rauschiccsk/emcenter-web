"""Fixtures for EM Technológia Web tests."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """FastAPI TestClient."""
    return TestClient(app)


# === MOCK RESPONSE DATA ===

MOCK_PRODUCTS = {
    "products": [
        {
            "product_id": 1,
            "sku": "EM-500",
            "name": "OASIS EM-1 500ml",
            "price": 8.25,
            "price_vat": 9.90,
            "vat_rate": 20.0,
            "stock_quantity": 150,
            "is_active": True,
            "image_url": None,
            "short_description": "Trial balenie",
        },
        {
            "product_id": 2,
            "sku": "EM-5L",
            "name": "OASIS EM-1 5L",
            "price": 33.25,
            "price_vat": 39.90,
            "vat_rate": 20.0,
            "stock_quantity": 80,
            "is_active": True,
            "image_url": None,
            "short_description": "Odporúčané balenie",
        },
    ]
}

MOCK_PRODUCT_DETAIL = MOCK_PRODUCTS["products"][0]

MOCK_ORDER_CREATED = {
    "order_number": "EM-2026-00001",
    "status": "new",
    "total_amount_vat": 39.90,
    "currency": "EUR",
    "payment_url": "https://payments.comgate.cz/client/instructions/index?id=TEST-XXXX",
}

MOCK_ORDER_STATUS = {
    "order_number": "EM-2026-00001",
    "status": "paid",
    "payment_status": "paid",
    "tracking_number": "",
    "tracking_link": "",
}

MOCK_PAYMENT_PAID = {
    "order_number": "EM-2026-00001",
    "status": "paid",
    "payment_status": "paid",
}

MOCK_PAYMENT_FAILED = {
    "order_number": "EM-2026-00001",
    "status": "new",
    "payment_status": "failed",
}

MOCK_LEAD_CREATED = {
    "id": 1,
    "email": "test@example.com",
    "first_name": "Test",
    "discount_code": "EM-TEST123",
    "discount_percentage": 50,
    "expires_at": "2026-06-10T00:00:00",
}

MOCK_LEAD_DUPLICATE = {
    "detail": "Email already registered",
}

MOCK_LEAD_VALIDATION_VALID = {
    "valid": True,
    "discount_code": "EM-TEST123",
    "discount_percentage": 50,
    "message": "Discount code is valid",
}

MOCK_LEAD_VALIDATION_INVALID = {
    "valid": False,
    "discount_code": "INVALID",
    "discount_percentage": 0,
    "message": "Discount code is expired or invalid",
}

MOCK_CALLBACK_OK = b"code=0&message=OK"

MOCK_ORDER_PAYLOAD = {
    "customer_name": "Test User",
    "customer_email": "test@example.com",
    "customer_phone": "+421900000000",
    "billing_name": "Test User",
    "billing_street": "Testovacia 1",
    "billing_city": "Bratislava",
    "billing_zip": "81101",
    "billing_country": "SK",
    "items": [{"sku": "EM-500", "quantity": 2}],
    "payment_method": "CARD",
    "note": "",
    "lang": "sk",
}


# === MOCK HELPERS ===


def _make_response(data: dict, status_code: int = 200) -> MagicMock:
    """Create a mock httpx.Response with required attributes."""
    content = json.dumps(data).encode("utf-8")
    resp = MagicMock()
    resp.status_code = status_code
    resp.content = content
    resp.text = content.decode("utf-8")
    resp.json.return_value = data
    return resp


def _make_error_response(status_code: int, detail: str = "Error") -> MagicMock:
    """Create a mock error response."""
    return _make_response({"detail": detail}, status_code)


def _route_request(url: str, method: str = "GET", **kwargs) -> MagicMock:
    """Route mock requests by URL pattern and return appropriate response."""
    url = str(url)

    if "/api/eshop/payment/callback" in url and method == "POST":
        resp = MagicMock()
        resp.status_code = 200
        resp.content = MOCK_CALLBACK_OK
        resp.headers = {"content-type": "text/plain"}
        resp.text = "code=0&message=OK"
        return resp

    if "/api/eshop/payment/return" in url:
        # Check params for payment return
        params = kwargs.get("params", {})
        trans_id = params.get("id", "")
        if trans_id == "TEST-FAILED":
            return _make_response(MOCK_PAYMENT_FAILED)
        return _make_response(MOCK_PAYMENT_PAID)

    if "/api/eshop/products/" in url:
        # Product detail by SKU
        return _make_response(MOCK_PRODUCT_DETAIL)

    if "/api/eshop/products" in url and method == "GET":
        return _make_response(MOCK_PRODUCTS)

    if "/api/eshop/orders" in url and method == "POST":
        return _make_response(MOCK_ORDER_CREATED)

    if "/api/eshop/orders/" in url and method == "GET":
        return _make_response(MOCK_ORDER_STATUS)

    if "/api/eshop/leads/validate/" in url and method == "GET":
        if "INVALID" in url or "NEEXISTUJE" in url:
            return _make_response(MOCK_LEAD_VALIDATION_INVALID)
        return _make_response(MOCK_LEAD_VALIDATION_VALID)

    if "/api/eshop/leads" in url and method == "POST":
        # Check body for duplicate test
        json_body = kwargs.get("json", {})
        if json_body and json_body.get("email") == "duplicate@example.com":
            return _make_response(MOCK_LEAD_DUPLICATE, 409)
        if json_body and not json_body.get("gdpr_consent"):
            return _make_error_response(400, "GDPR consent is required")
        return _make_response(MOCK_LEAD_CREATED, 201)

    return _make_error_response(404, "Not found")


def _route_request_404(url: str, method: str = "GET", **kwargs) -> MagicMock:
    """Route mock requests — returns 404 for everything."""
    return _make_error_response(404, "Not found")


def _route_request_422(url: str, method: str = "GET", **kwargs) -> MagicMock:
    """Route mock requests — returns 422 for POST, normal for GET."""
    if method == "POST":
        return _make_error_response(422, "Validation error")
    return _route_request(url, method, **kwargs)


def _route_request_500(url: str, method: str = "GET", **kwargs) -> MagicMock:
    """Route mock requests — returns 500 for everything."""
    return _make_error_response(500, "Internal server error")


def _create_mock_client(router_func):
    """Create a mock httpx.AsyncClient context manager with given router."""
    mock_client_instance = AsyncMock()

    async def mock_get(url, **kwargs):
        return router_func(str(url), "GET", **kwargs)

    async def mock_post(url, **kwargs):
        return router_func(str(url), "POST", **kwargs)

    mock_client_instance.get = AsyncMock(side_effect=mock_get)
    mock_client_instance.post = AsyncMock(side_effect=mock_post)

    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_cm.__aexit__ = AsyncMock(return_value=False)

    return mock_cm, mock_client_instance


# === FIXTURES ===


@pytest.fixture
def mock_nex_api():
    """Mock httpx.AsyncClient — returns normal responses."""
    mock_cm, mock_client_instance = _create_mock_client(_route_request)
    with patch("app.main.httpx.AsyncClient", return_value=mock_cm) as mock_cls:
        mock_cls._mock_client = mock_client_instance
        yield mock_cls


@pytest.fixture
def mock_nex_api_404():
    """Mock httpx.AsyncClient — returns 404 for all requests."""
    mock_cm, _ = _create_mock_client(_route_request_404)
    with patch("app.main.httpx.AsyncClient", return_value=mock_cm):
        yield


@pytest.fixture
def mock_nex_api_422():
    """Mock httpx.AsyncClient — returns 422 for POST requests."""
    mock_cm, _ = _create_mock_client(_route_request_422)
    with patch("app.main.httpx.AsyncClient", return_value=mock_cm):
        yield


@pytest.fixture
def mock_nex_api_500():
    """Mock httpx.AsyncClient — returns 500 for all requests."""
    mock_cm, _ = _create_mock_client(_route_request_500)
    with patch("app.main.httpx.AsyncClient", return_value=mock_cm):
        yield


@pytest.fixture
def mock_nex_api_timeout():
    """Mock httpx.AsyncClient — raises TimeoutException."""
    mock_client_instance = AsyncMock()
    mock_client_instance.get = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))
    mock_client_instance.post = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))

    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_cm.__aexit__ = AsyncMock(return_value=False)

    with patch("app.main.httpx.AsyncClient", return_value=mock_cm):
        yield


@pytest.fixture
def mock_nex_api_payment_paid():
    """Mock httpx.AsyncClient — payment return with paid status."""

    def router(url, method="GET", **kwargs):
        if "/api/eshop/payment/return" in str(url):
            return _make_response(MOCK_PAYMENT_PAID)
        return _route_request(url, method, **kwargs)

    mock_cm, _ = _create_mock_client(router)
    with patch("app.main.httpx.AsyncClient", return_value=mock_cm):
        yield


@pytest.fixture
def mock_nex_api_payment_failed():
    """Mock httpx.AsyncClient — payment return with failed status."""

    def router(url, method="GET", **kwargs):
        if "/api/eshop/payment/return" in str(url):
            return _make_response(MOCK_PAYMENT_FAILED)
        return _route_request(url, method, **kwargs)

    mock_cm, _ = _create_mock_client(router)
    with patch("app.main.httpx.AsyncClient", return_value=mock_cm):
        yield


@pytest.fixture
def mock_nex_api_error():
    """Mock httpx.AsyncClient — raises exception for payment return."""
    mock_client_instance = AsyncMock()
    mock_client_instance.get = AsyncMock(
        side_effect=httpx.ConnectError("Connection refused")
    )
    mock_client_instance.post = AsyncMock(
        side_effect=httpx.ConnectError("Connection refused")
    )

    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_cm.__aexit__ = AsyncMock(return_value=False)

    with patch("app.main.httpx.AsyncClient", return_value=mock_cm):
        yield
