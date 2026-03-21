/**
 * EM Center — Account Page
 * Loads profile & orders, handles logout.
 */
(function () {
    "use strict";

    var token = sessionStorage.getItem("auth_token");

    // Redirect to login if not authenticated
    if (!token) {
        window.location.href = "/login";
        return;
    }

    function escapeHtml(str) {
        var div = document.createElement("div");
        div.textContent = str || "";
        return div.innerHTML;
    }

    // Load profile
    function loadProfile() {
        fetch("/api/eshop/customers/profile", {
            headers: { "Authorization": "Bearer " + token }
        })
        .then(function (resp) {
            if (resp.status === 401) {
                // Token expired or invalid
                sessionStorage.clear();
                window.location.href = "/login";
                return null;
            }
            return resp.json();
        })
        .then(function (profile) {
            if (!profile) return;

            // Update header
            var nameDisplay = document.getElementById("user-name-display");
            if (nameDisplay) nameDisplay.textContent = profile.name || "";

            // Update profile section
            var profileEl = document.getElementById("profile-data");
            if (profileEl) {
                var html = "";
                html += "<p><strong>Meno:</strong> " + escapeHtml(profile.name) + "</p>";
                html += "<p><strong>Email:</strong> " + escapeHtml(profile.email) + "</p>";
                if (profile.phone) {
                    html += "<p><strong>Telefón:</strong> " + escapeHtml(profile.phone) + "</p>";
                }
                if (profile.billing_street) {
                    html += "<p><strong>Adresa:</strong> " + escapeHtml(profile.billing_street);
                    if (profile.billing_city) html += ", " + escapeHtml(profile.billing_zip || "") + " " + escapeHtml(profile.billing_city);
                    html += "</p>";
                }
                profileEl.innerHTML = html;
            }
        })
        .catch(function (err) {
            console.error("Error loading profile:", err);
            var profileEl = document.getElementById("profile-data");
            if (profileEl) profileEl.innerHTML = "<p>Nepodarilo sa načítať údaje.</p>";
        });
    }

    // Load orders
    function loadOrders() {
        fetch("/api/eshop/customers/orders", {
            headers: { "Authorization": "Bearer " + token }
        })
        .then(function (resp) {
            if (resp.status === 401) return null;
            return resp.json();
        })
        .then(function (data) {
            if (!data) return;

            var ordersEl = document.getElementById("orders-data");
            if (!ordersEl) return;

            var orders = data.orders || data;
            if (!Array.isArray(orders) || orders.length === 0) {
                ordersEl.innerHTML = "<p>Zatiaľ nemáte žiadne objednávky.</p>";
                return;
            }

            var html = '<div class="orders-table-wrap"><table class="orders-table">';
            html += "<thead><tr><th>Číslo</th><th>Dátum</th><th>Suma</th><th>Stav</th></tr></thead><tbody>";

            for (var i = 0; i < orders.length; i++) {
                var order = orders[i];
                var date = order.created_at ? new Date(order.created_at).toLocaleDateString("sk-SK") : "-";
                var total = order.total_price ? parseFloat(order.total_price).toFixed(2).replace(".", ",") + " \u20ac" : "-";
                var status = escapeHtml(order.payment_status || order.status || "-");

                html += "<tr>";
                html += "<td>" + escapeHtml(order.order_number || order.id || "-") + "</td>";
                html += "<td>" + date + "</td>";
                html += "<td>" + total + "</td>";
                html += "<td><span class='order-status order-status--" + escapeHtml(order.payment_status || "unknown") + "'>" + status + "</span></td>";
                html += "</tr>";
            }

            html += "</tbody></table></div>";
            ordersEl.innerHTML = html;
        })
        .catch(function (err) {
            console.error("Error loading orders:", err);
            var ordersEl = document.getElementById("orders-data");
            if (ordersEl) ordersEl.innerHTML = "<p>Nepodarilo sa načítať objednávky.</p>";
        });
    }

    // Logout
    var logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", function (e) {
            e.preventDefault();
            sessionStorage.removeItem("auth_token");
            sessionStorage.removeItem("customer_name");
            sessionStorage.removeItem("customer_email");
            window.location.href = "/";
        });
    }

    // Init
    loadProfile();
    loadOrders();

})();
