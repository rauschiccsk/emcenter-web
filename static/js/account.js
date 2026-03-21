/**
 * EM Center — Account Page
 * Profile edit, company details, password change, orders.
 */
(function () {
    "use strict";

    var STATUS_MAP = {
        "new": "Nova",
        "pending": "Caka na platbu",
        "paid": "Zaplatena",
        "processing": "Spracovava sa",
        "shipped": "Odoslana",
        "delivered": "Dorucena",
        "cancelled": "Zrusena",
        "failed": "Neuspesna",
        "refunded": "Vratena"
    };

    function translateStatus(status) {
        if (!status) return "-";
        return STATUS_MAP[status.toLowerCase()] || status;
    }

    function formatPrice(amount, currency) {
        if (amount === null || amount === undefined) return "-";
        var num = parseFloat(amount);
        if (isNaN(num)) return "-";
        return num.toFixed(2).replace(".", ",") + " " + (currency || "\u20ac");
    }

    function escapeHtml(str) {
        var div = document.createElement("div");
        div.textContent = str || "";
        return div.innerHTML;
    }

    var token = sessionStorage.getItem("auth_token");

    // Redirect to login if not authenticated
    if (!token) {
        window.location.href = "/login";
        return;
    }

    // --- Load Profile ---
    function loadProfile() {
        fetch("/api/eshop/customers/profile", {
            headers: { "Authorization": "Bearer " + token }
        })
        .then(function (resp) {
            if (resp.status === 401) {
                sessionStorage.clear();
                window.location.href = "/login";
                return null;
            }
            return resp.json();
        })
        .then(function (profile) {
            if (!profile) return;

            // Update header name display
            var fullName = ((profile.first_name || "") + " " + (profile.last_name || "")).trim();
            var nameDisplay = document.getElementById("user-name-display");
            if (nameDisplay) nameDisplay.textContent = fullName;

            // Fill personal details
            setValue("first_name", profile.first_name);
            setValue("last_name", profile.last_name);
            setValue("email", profile.email);
            setValue("phone", profile.phone);
            setValue("street", profile.street);
            setValue("city", profile.city);
            setValue("postal_code", profile.postal_code);
            setValue("country", profile.country || "SK");

            // Fill company details if present
            if (profile.company_name) {
                var checkbox = document.getElementById("is_company");
                if (checkbox) checkbox.checked = true;
                setValue("company_name", profile.company_name);
                setValue("company_ico", profile.company_ico);
                setValue("company_dic", profile.company_dic);
                setValue("company_ic_dph", profile.company_ic_dph);
                toggleCompanyFields();
            }
        })
        .catch(function (err) {
            console.error("Error loading profile:", err);
            showMessage("profile-message", "Chyba pri nacitani profilu", "error");
        });
    }

    function setValue(id, value) {
        var el = document.getElementById(id);
        if (el) el.value = value || "";
    }

    // --- Toggle Company Fields ---
    function toggleCompanyFields() {
        var isCompany = document.getElementById("is_company").checked;
        var companyFields = document.getElementById("company-fields");
        if (companyFields) {
            companyFields.style.display = isCompany ? "block" : "none";
        }
        // Clear company fields if unchecked
        if (!isCompany) {
            setValue("company_name", "");
            setValue("company_ico", "");
            setValue("company_dic", "");
            setValue("company_ic_dph", "");
        }
    }

    // --- Save Profile ---
    function saveProfile() {
        var btn = document.getElementById("save-profile-btn");
        btn.disabled = true;
        btn.textContent = "Ukladam...";

        var isCompany = document.getElementById("is_company").checked;

        var data = {
            first_name: getVal("first_name"),
            last_name: getVal("last_name"),
            phone: getVal("phone"),
            street: getVal("street"),
            city: getVal("city"),
            postal_code: getVal("postal_code"),
            country: getVal("country"),
            company_name: isCompany ? getVal("company_name") : null,
            company_ico: isCompany ? getVal("company_ico") : null,
            company_dic: isCompany ? getVal("company_dic") : null,
            company_ic_dph: isCompany ? getVal("company_ic_dph") : null
        };

        // Validation
        if (!data.first_name || !data.last_name) {
            showMessage("profile-message", "Meno a priezvisko su povinne", "error");
            btn.disabled = false;
            btn.textContent = "Ulozit udaje";
            return;
        }

        if (isCompany && (!data.company_name || !data.company_ico)) {
            showMessage("profile-message", "Nazov firmy a ICO su povinne", "error");
            btn.disabled = false;
            btn.textContent = "Ulozit udaje";
            return;
        }

        fetch("/api/eshop/customers/profile", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify(data)
        })
        .then(function (resp) {
            if (!resp.ok) {
                return resp.json().then(function (err) {
                    throw new Error(err.detail || "Update failed");
                });
            }
            return resp.json();
        })
        .then(function () {
            showMessage("profile-message", "Udaje boli uspesne ulozene", "success");
            // Update sessionStorage for checkout prefill
            sessionStorage.setItem("customerProfile", JSON.stringify(data));
            // Reload profile to refresh header name
            loadProfile();
        })
        .catch(function (err) {
            console.error("Save profile error:", err);
            showMessage("profile-message", err.message || "Chyba pri ukladani", "error");
        })
        .finally(function () {
            btn.disabled = false;
            btn.textContent = "Ulozit udaje";
        });
    }

    function getVal(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : "";
    }

    // --- Change Password ---
    function changePassword(e) {
        e.preventDefault();

        var btn = document.getElementById("change-password-btn");
        btn.disabled = true;
        btn.textContent = "Menim...";

        var currentPassword = getVal("current_password");
        var newPassword = getVal("new_password");
        var confirmPassword = getVal("confirm_password");

        // Frontend validation
        if (newPassword !== confirmPassword) {
            showMessage("password-message", "Nove hesla sa nezhoduju", "error");
            btn.disabled = false;
            btn.textContent = "Zmenit heslo";
            return;
        }

        if (newPassword.length < 8) {
            showMessage("password-message", "Nove heslo musi mat aspon 8 znakov", "error");
            btn.disabled = false;
            btn.textContent = "Zmenit heslo";
            return;
        }

        fetch("/api/eshop/customers/password", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        })
        .then(function (resp) {
            if (!resp.ok) {
                return resp.json().then(function (err) {
                    throw new Error(err.detail || "Password change failed");
                });
            }
            return resp.json();
        })
        .then(function () {
            showMessage("password-message", "Heslo bolo uspesne zmenene", "success");
            // Clear form
            var form = document.getElementById("password-form");
            if (form) form.reset();
        })
        .catch(function (err) {
            console.error("Change password error:", err);
            showMessage("password-message", err.message || "Chyba pri zmene hesla", "error");
        })
        .finally(function () {
            btn.disabled = false;
            btn.textContent = "Zmenit heslo";
        });
    }

    // --- Load Orders ---
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
                ordersEl.innerHTML = "<p>Zatial nemate ziadne objednavky.</p>";
                return;
            }

            var html = '<div class="orders-table-wrap"><table class="orders-table">';
            html += "<thead><tr><th>Cislo</th><th>Datum</th><th>Suma</th><th>Stav</th></tr></thead><tbody>";

            for (var i = 0; i < orders.length; i++) {
                var order = orders[i];
                var date = order.created_at ? new Date(order.created_at).toLocaleDateString("sk-SK") : "-";
                var total = formatPrice(order.total_amount_vat || order.total_amount || order.total_price, order.currency === "EUR" ? "\u20ac" : order.currency);
                var rawStatus = order.payment_status || order.status || "-";
                var status = escapeHtml(translateStatus(rawStatus));

                html += "<tr>";
                html += "<td>" + escapeHtml(order.order_number || order.id || "-") + "</td>";
                html += "<td>" + date + "</td>";
                html += "<td>" + total + "</td>";
                html += "<td><span class='order-status order-status--" + escapeHtml(rawStatus) + "'>" + status + "</span></td>";
                html += "</tr>";
            }

            html += "</tbody></table></div>";
            ordersEl.innerHTML = html;
        })
        .catch(function (err) {
            console.error("Error loading orders:", err);
            var ordersEl = document.getElementById("orders-data");
            if (ordersEl) ordersEl.innerHTML = "<p>Nepodarilo sa nacitat objednavky.</p>";
        });
    }

    // --- Show Message ---
    function showMessage(elementId, message, type) {
        var messageEl = document.getElementById(elementId);
        if (!messageEl) return;
        messageEl.textContent = message;
        messageEl.className = "message " + type;
        messageEl.style.display = "block";

        setTimeout(function () {
            messageEl.style.display = "none";
        }, 5000);
    }

    // --- Event Listeners ---
    var companyCheckbox = document.getElementById("is_company");
    if (companyCheckbox) {
        companyCheckbox.addEventListener("change", toggleCompanyFields);
    }

    var saveBtn = document.getElementById("save-profile-btn");
    if (saveBtn) {
        saveBtn.addEventListener("click", saveProfile);
    }

    var passwordForm = document.getElementById("password-form");
    if (passwordForm) {
        passwordForm.addEventListener("submit", changePassword);
    }

    var logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", function (e) {
            e.preventDefault();
            sessionStorage.removeItem("auth_token");
            sessionStorage.removeItem("customer_name");
            sessionStorage.removeItem("customer_email");
            sessionStorage.removeItem("customerProfile");
            window.location.href = "/";
        });
    }

    // --- Init ---
    loadProfile();
    loadOrders();

})();
