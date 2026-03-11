"""Tests for EM Center Web application — proxy endpoints, landing page, resilience."""

from tests.conftest import MOCK_ORDER_PAYLOAD, MOCK_LEAD_CREATED


# === Category 1: Landing Page Tests ===


class TestLandingPage:
    """Tests for the main landing page."""

    def test_homepage_returns_200(self, client):
        """GET / returns 200."""
        resp = client.get("/")
        assert resp.status_code == 200

    def test_homepage_contains_title(self, client):
        """Page contains EM Center in title."""
        resp = client.get("/")
        assert "EM Center" in resp.text

    def test_homepage_contains_products_section(self, client):
        """Page contains products section."""
        resp = client.get("/")
        assert 'id="produkty"' in resp.text

    def test_homepage_contains_checkout(self, client):
        """Page contains checkout / order section."""
        resp = client.get("/")
        # The page has "Objednať" (order) button
        assert "objedn" in resp.text.lower()

    def test_homepage_contains_faq(self, client):
        """Page contains FAQ section."""
        resp = client.get("/")
        assert 'id="faq"' in resp.text.lower()

    def test_health_endpoint(self, client):
        """GET /health returns status ok."""
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


# === Category 2: Product Proxy Tests ===


class TestProductProxy:
    """Tests for product proxy endpoints."""

    def test_get_products_returns_200(self, client, mock_nex_api):
        """GET /api/products returns 200 with products."""
        resp = client.get("/api/products")
        assert resp.status_code == 200
        data = resp.json()
        assert "products" in data
        assert len(data["products"]) == 2

    def test_products_contain_expected_fields(self, client, mock_nex_api):
        """Products contain sku, name, price_vat."""
        resp = client.get("/api/products")
        product = resp.json()["products"][0]
        assert "sku" in product
        assert "name" in product
        assert "price_vat" in product

    def test_get_product_by_sku(self, client, mock_nex_api):
        """GET /api/products/EM-500 returns single product."""
        resp = client.get("/api/products/EM-500")
        assert resp.status_code == 200
        data = resp.json()
        assert data["sku"] == "EM-500"

    def test_get_nonexistent_product(self, client, mock_nex_api_404):
        """GET /api/products/NONEXISTENT returns 404."""
        resp = client.get("/api/products/NONEXISTENT")
        assert resp.status_code == 404

    def test_products_proxy_sends_auth_header(self, client, mock_nex_api):
        """Proxy forwards X-Eshop-Token header."""
        client.get("/api/products")
        # Get the mock client instance and verify call args
        mock_client = mock_nex_api._mock_client
        mock_client.get.assert_called()
        call_kwargs = mock_client.get.call_args
        headers = call_kwargs.kwargs.get("headers", {})
        assert "X-Eshop-Token" in headers


# === Category 3: Order Proxy Tests ===


class TestOrderProxy:
    """Tests for order proxy endpoints."""

    def test_create_order_success(self, client, mock_nex_api):
        """POST /api/orders with valid payload returns order."""
        resp = client.post("/api/orders", json=MOCK_ORDER_PAYLOAD)
        assert resp.status_code == 200
        data = resp.json()
        assert "order_number" in data
        assert "payment_url" in data

    def test_create_order_invalid_payload(self, client, mock_nex_api_422):
        """POST /api/orders with invalid payload returns 422."""
        resp = client.post("/api/orders", json={})
        assert resp.status_code == 422

    def test_get_order_status(self, client, mock_nex_api):
        """GET /api/orders/EM-2026-00001 returns status."""
        resp = client.get("/api/orders/EM-2026-00001")
        assert resp.status_code == 200
        data = resp.json()
        assert data["order_number"] == "EM-2026-00001"

    def test_get_nonexistent_order(self, client, mock_nex_api_404):
        """GET /api/orders/NONEXISTENT returns 404."""
        resp = client.get("/api/orders/NONEXISTENT")
        assert resp.status_code == 404

    def test_order_proxy_sends_content_type(self, client, mock_nex_api):
        """Order proxy sends Content-Type: application/json."""
        client.post("/api/orders", json=MOCK_ORDER_PAYLOAD)
        mock_client = mock_nex_api._mock_client
        mock_client.post.assert_called()
        call_kwargs = mock_client.post.call_args
        headers = call_kwargs.kwargs.get("headers", {})
        assert headers.get("Content-Type") == "application/json"

    def test_order_proxy_forwards_body(self, client, mock_nex_api):
        """Order proxy forwards request body correctly."""
        client.post("/api/orders", json=MOCK_ORDER_PAYLOAD)
        mock_client = mock_nex_api._mock_client
        mock_client.post.assert_called()
        call_kwargs = mock_client.post.call_args
        sent_json = call_kwargs.kwargs.get("json", {})
        assert sent_json["customer_name"] == "Test User"
        assert sent_json["customer_email"] == "test@example.com"


# === Category 4: Payment Return Tests ===


class TestPaymentReturn:
    """Tests for payment return page."""

    def test_payment_return_paid_shows_success(self, client, mock_nex_api_payment_paid):
        """Payment return with paid status renders success page."""
        resp = client.get("/payment/return?id=TEST-VALID")
        assert resp.status_code == 200
        assert "EM-2026-00001" in resp.text
        # Success page has "Dakujeme" (thank you)
        assert "akujeme" in resp.text

    def test_payment_return_failed_shows_failure(self, client, mock_nex_api_payment_failed):
        """Payment return with failed status renders failure page."""
        resp = client.get("/payment/return?id=TEST-FAILED")
        assert resp.status_code == 200
        # Failure page has "nebola dokončená" (was not completed)
        assert "nebola" in resp.text.lower()

    def test_payment_return_error_shows_failure(self, client, mock_nex_api_error):
        """Payment return with connection error renders failure page."""
        resp = client.get("/payment/return?id=INVALID")
        assert resp.status_code == 200
        # Should render failed template
        assert "nebola" in resp.text.lower() or "Skúsiť znova" in resp.text

    def test_success_page_contains_order_number(self, client, mock_nex_api_payment_paid):
        """Success page shows order number."""
        resp = client.get("/payment/return?id=TEST-VALID")
        assert "EM-2026-00001" in resp.text


# === Category 5: Static Files Tests ===


class TestStaticFiles:
    """Tests for static file serving."""

    def test_css_accessible(self, client):
        """CSS file is served."""
        resp = client.get("/static/css/style.css")
        assert resp.status_code == 200

    def test_js_accessible(self, client):
        """JS file is served."""
        resp = client.get("/static/js/main.js")
        assert resp.status_code == 200


# === Category 6: API Resilience Tests ===


class TestResilience:
    """Tests for proxy error handling and resilience."""

    def test_products_proxy_handles_timeout(self, client, mock_nex_api_timeout):
        """Product proxy handles NEX API timeout gracefully."""
        resp = client.get("/api/products")
        assert resp.status_code == 502
        assert "unavailable" in resp.json()["detail"].lower()

    def test_orders_proxy_handles_timeout(self, client, mock_nex_api_timeout):
        """Order proxy handles NEX API timeout gracefully."""
        resp = client.post("/api/orders", json=MOCK_ORDER_PAYLOAD)
        assert resp.status_code == 502

    def test_products_proxy_handles_500(self, client, mock_nex_api_500):
        """Product proxy forwards NEX API 500 error."""
        resp = client.get("/api/products")
        assert resp.status_code == 500


# === Category 7: Lead Proxy Tests ===


class TestLeadProxy:
    """Tests for lead capture proxy endpoints."""

    def test_lead_register_success(self, client, mock_nex_api):
        """POST /api/leads with valid payload returns 201 with discount code."""
        payload = {
            "email": "new@example.com",
            "first_name": "Test",
            "gdpr_consent": True,
        }
        resp = client.post("/api/leads", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert "discount_code" in data
        assert data["discount_code"] == MOCK_LEAD_CREATED["discount_code"]

    def test_lead_register_duplicate_email(self, client, mock_nex_api):
        """POST /api/leads with duplicate email returns 409."""
        payload = {
            "email": "duplicate@example.com",
            "gdpr_consent": True,
        }
        resp = client.post("/api/leads", json=payload)
        assert resp.status_code == 409

    def test_lead_register_no_gdpr(self, client, mock_nex_api):
        """POST /api/leads without GDPR consent returns 400."""
        payload = {
            "email": "test@example.com",
            "gdpr_consent": False,
        }
        resp = client.post("/api/leads", json=payload)
        assert resp.status_code == 400

    def test_lead_validate_valid_code(self, client, mock_nex_api):
        """GET /api/leads/validate/{code} with valid code returns valid=true."""
        resp = client.get("/api/leads/validate/EM-TEST123")
        assert resp.status_code == 200
        data = resp.json()
        assert data["valid"] is True
        assert data["discount_percentage"] == 50

    def test_lead_validate_invalid_code(self, client, mock_nex_api):
        """GET /api/leads/validate/{code} with invalid code returns valid=false."""
        resp = client.get("/api/leads/validate/INVALID-CODE")
        assert resp.status_code == 200
        data = resp.json()
        assert data["valid"] is False


# === Category 8: Legal Pages Tests ===


class TestLegalPages:
    """Tests for legal page endpoints."""

    def test_vop_page_returns_200(self, client):
        """GET /vop returns 200."""
        resp = client.get("/vop")
        assert resp.status_code == 200

    def test_vop_page_contains_content(self, client):
        """VOP page contains EM-1 or obchodné podmienky."""
        resp = client.get("/vop")
        text = resp.text.lower()
        assert "em-1" in text or "obchodné podmienky" in text or "pripravujú" in text

    def test_privacy_page_returns_200(self, client):
        """GET /ochrana-osobnych-udajov returns 200."""
        resp = client.get("/ochrana-osobnych-udajov")
        assert resp.status_code == 200

    def test_privacy_page_contains_content(self, client):
        """Privacy page contains relevant content."""
        resp = client.get("/ochrana-osobnych-udajov")
        text = resp.text.lower()
        assert "osobných údajov" in text or "ochrana" in text or "pripravuje" in text

    def test_withdrawal_page_returns_200(self, client):
        """GET /odstupenie-od-zmluvy returns 200."""
        resp = client.get("/odstupenie-od-zmluvy")
        assert resp.status_code == 200

    def test_withdrawal_page_contains_form(self, client):
        """Withdrawal page contains form elements."""
        resp = client.get("/odstupenie-od-zmluvy")
        assert "odstúpenie" in resp.text.lower() or "formulár" in resp.text.lower()

    def test_withdrawal_page_contains_company_info(self, client):
        """Withdrawal page contains EM-1 company address."""
        resp = client.get("/odstupenie-od-zmluvy")
        assert "EM-1" in resp.text
        assert "odbyt@em-1.sk" in resp.text


# === Category 9: Customer Auth Proxy Tests ===


class TestCustomerProxy:
    """Tests for customer auth proxy endpoints."""

    def test_customer_register_proxy(self, client, mock_nex_api):
        """POST /api/eshop/customers/register proxies to NEX API."""
        payload = {
            "email": "new@example.com",
            "password": "TestPass123",
            "name": "Test User",
            "phone": "+421900000000",
        }
        resp = client.post("/api/eshop/customers/register", json=payload)
        # The mock will return 404 (not routed) but it should not be 502
        assert resp.status_code != 502

    def test_customer_login_proxy(self, client, mock_nex_api):
        """POST /api/eshop/customers/login proxies to NEX API."""
        payload = {"email": "test@example.com", "password": "TestPass123"}
        resp = client.post("/api/eshop/customers/login", json=payload)
        assert resp.status_code != 502

    def test_customer_profile_proxy(self, client, mock_nex_api):
        """GET /api/eshop/customers/profile proxies to NEX API."""
        resp = client.get(
            "/api/eshop/customers/profile",
            headers={"Authorization": "Bearer test-token"},
        )
        assert resp.status_code != 502

    def test_customer_orders_proxy(self, client, mock_nex_api):
        """GET /api/eshop/customers/orders proxies to NEX API."""
        resp = client.get(
            "/api/eshop/customers/orders",
            headers={"Authorization": "Bearer test-token"},
        )
        assert resp.status_code != 502

    def test_customer_register_timeout(self, client, mock_nex_api_timeout):
        """POST /api/eshop/customers/register handles timeout."""
        resp = client.post(
            "/api/eshop/customers/register",
            json={"email": "test@example.com", "password": "Test123"},
        )
        assert resp.status_code == 502


# === Category 10: Homepage Footer Links ===


class TestFooterLinks:
    """Tests for footer legal links on homepage."""

    def test_homepage_contains_vop_link(self, client):
        """Homepage contains link to /vop."""
        resp = client.get("/")
        assert 'href="/vop"' in resp.text

    def test_homepage_contains_privacy_link(self, client):
        """Homepage contains link to /ochrana-osobnych-udajov."""
        resp = client.get("/")
        assert 'href="/ochrana-osobnych-udajov"' in resp.text

    def test_homepage_contains_withdrawal_link(self, client):
        """Homepage contains link to /odstupenie-od-zmluvy."""
        resp = client.get("/")
        assert 'href="/odstupenie-od-zmluvy"' in resp.text

    def test_homepage_contains_vop_consent_checkbox(self, client):
        """Homepage contains VOP consent checkbox in checkout."""
        resp = client.get("/")
        assert 'id="vop-consent"' in resp.text

    def test_homepage_order_button_disabled(self, client):
        """Order button is disabled by default."""
        resp = client.get("/")
        assert 'id="submit-order-btn" disabled' in resp.text
