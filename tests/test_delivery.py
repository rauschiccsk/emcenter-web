"""Delivery method tests for emcenter-web proxy.

4 testy overujúce delivery_method (courier / packeta_point) cez proxy endpoint.
Používajú mock fixtures z conftest.py — žiadne reálne API volania.
"""

from tests.conftest import MOCK_ORDER_PAYLOAD


class TestDeliveryProxy:
    """Tests for delivery method handling in order proxy."""

    def test_order_with_courier(self, client, mock_nex_api):
        """POST /api/orders with delivery_method=courier returns 200."""
        payload = {
            **MOCK_ORDER_PAYLOAD,
            "delivery_method": "courier",
        }
        resp = client.post("/api/orders", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "order_number" in data
        assert "payment_url" in data

        # Verify proxy forwarded delivery_method in body
        mock_client = mock_nex_api._mock_client
        mock_client.post.assert_called()
        sent_json = mock_client.post.call_args.kwargs.get("json", {})
        assert sent_json["delivery_method"] == "courier"

    def test_order_with_packeta(self, client, mock_nex_api):
        """POST /api/orders with delivery_method=packeta_point + point data returns 200."""
        payload = {
            **MOCK_ORDER_PAYLOAD,
            "delivery_method": "packeta_point",
            "packeta_point_id": "12345",
            "packeta_point_name": "Z-BOX Komárno, Eötvösova 1",
        }
        resp = client.post("/api/orders", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "order_number" in data

        # Verify proxy forwarded packeta fields
        mock_client = mock_nex_api._mock_client
        sent_json = mock_client.post.call_args.kwargs.get("json", {})
        assert sent_json["delivery_method"] == "packeta_point"
        assert sent_json["packeta_point_id"] == "12345"
        assert sent_json["packeta_point_name"] == "Z-BOX Komárno, Eötvösova 1"

    def test_order_without_delivery_method(self, client, mock_nex_api):
        """POST /api/orders without delivery_method still succeeds (proxy forwards as-is)."""
        payload = {**MOCK_ORDER_PAYLOAD}
        # Ensure no delivery_method key
        payload.pop("delivery_method", None)
        resp = client.post("/api/orders", json=payload)
        # Proxy transparently forwards → backend accepts (mock returns 200)
        assert resp.status_code == 200
        data = resp.json()
        assert "order_number" in data

    def test_order_packeta_missing_point_id(self, client, mock_nex_api):
        """POST /api/orders with packeta_point but missing point_id still proxied."""
        payload = {
            **MOCK_ORDER_PAYLOAD,
            "delivery_method": "packeta_point",
            # packeta_point_id intentionally missing
        }
        resp = client.post("/api/orders", json=payload)
        # Proxy forwards everything — mock backend returns 200
        # Real backend may reject (400/422), but proxy layer should not fail
        assert resp.status_code == 200

        # Verify delivery_method was forwarded without point_id
        mock_client = mock_nex_api._mock_client
        sent_json = mock_client.post.call_args.kwargs.get("json", {})
        assert sent_json["delivery_method"] == "packeta_point"
        assert "packeta_point_id" not in sent_json
