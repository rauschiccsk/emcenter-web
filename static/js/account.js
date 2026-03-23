/**
 * EM Technológia — Account Page
 * Profile edit, company details, password change, orders.
 */
(function () {
    "use strict";

    var STATUS_MAP = {
        "new": "Nová",
        "pending": "Čaká na platbu",
        "paid": "Zaplatená",
        "processing": "Spracováva sa",
        "shipped": "Odoslaná",
        "delivered": "Doručená",
        "cancelled": "Zrušená",
        "failed": "Neúspešná",
        "refunded": "Vrátená"
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

    // --- Expandable order detail state ---
    var expandedOrders = {};

    function loadOrderDetail(orderNumber) {
        return fetch("/api/eshop/customers/orders/" + orderNumber, {
            headers: { "Authorization": "Bearer " + token }
        })
        .then(function (resp) {
            if (!resp.ok) throw new Error("Failed to load order detail");
            return resp.json();
        })
        .catch(function (err) {
            console.error("Error loading order detail:", err);
            return null;
        });
    }

    window.retryPayment = function (orderNumber, btn) {
        btn.disabled = true;
        btn.textContent = "Presmerovávam na platbu...";

        fetch("/api/eshop/customers/orders/" + orderNumber + "/pay", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            }
        })
        .then(function (resp) {
            return resp.json().then(function (data) {
                if (resp.ok && data.redirect_url) {
                    window.location.href = data.redirect_url;
                } else {
                    alert(data.detail || "Chyba pri vytváraní platby");
                    btn.disabled = false;
                    btn.textContent = "Zaplatiť objednávku";
                }
            });
        })
        .catch(function () {
            alert("Chyba pri vytváraní platby");
            btn.disabled = false;
            btn.textContent = "Zaplatiť objednávku";
        });
    };

    function buildOrderDetailHTML(order) {
        var html = '<div class="order-detail-content">';

        // Items table — filter out shipping items
        var items = (order.items || []).filter(function (item) {
            return item.item_type !== "shipping";
        });
        html += '<h4>Objednané produkty</h4>';
        html += '<table class="order-items-table">';
        html += '<thead><tr><th>Produkt</th><th>Množstvo</th><th>Cena</th></tr></thead>';
        html += '<tbody>';

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var itemTotal = (item.unit_price_vat !== undefined && item.unit_price_vat !== null)
                ? (parseFloat(item.unit_price_vat) * (item.quantity || 1)).toFixed(2).replace(".", ",")
                : "-";
            html += '<tr>';
            html += '<td>' + escapeHtml(item.name || item.product_name || "-") + '</td>';
            html += '<td class="text-center">' + (item.quantity || 1) + '</td>';
            html += '<td class="text-right">' + itemTotal + ' €</td>';
            html += '</tr>';
        }

        html += '</tbody></table>';

        // Shipping address (use shipping_name or fallback to billing)
        var shipName = (order.shipping_name || order.shipping_first_name || "").trim();
        var shipName2 = (order.shipping_name2 || order.shipping_last_name || "").trim();
        var shipStreet = order.shipping_street || "";
        var shipCity = order.shipping_city || "";
        var shipZip = order.shipping_zip || order.shipping_postal_code || "";
        var shipCountry = order.shipping_country || "";

        // If shipping address is empty, fall back to billing
        if (!shipName && !shipStreet) {
            shipName = (order.billing_name || order.billing_first_name || "").trim();
            shipName2 = (order.billing_name2 || order.billing_last_name || "").trim();
            shipStreet = order.billing_street || "";
            shipCity = order.billing_city || "";
            shipZip = order.billing_zip || order.billing_postal_code || "";
            shipCountry = order.billing_country || "";
        }

        html += '<div class="order-addresses">';
        html += '<div class="address-block">';
        html += '<h4>Dodacia adresa</h4>';
        html += '<p>';
        html += escapeHtml((shipName + " " + shipName2).trim()) + '<br>';
        if (shipStreet) html += escapeHtml(shipStreet) + '<br>';
        html += escapeHtml((shipZip + " " + shipCity).trim()) + '<br>';
        html += escapeHtml(shipCountry);
        html += '</p>';
        html += '</div>';

        // Billing address — show if different from shipping
        var billName = (order.billing_name || order.billing_first_name || "").trim();
        var billStreet = order.billing_street || "";
        var billCity = order.billing_city || "";
        var billZip = order.billing_zip || order.billing_postal_code || "";
        var billCountry = order.billing_country || "";

        if (billStreet && (billStreet !== shipStreet || billCity !== shipCity)) {
            html += '<div class="address-block">';
            html += '<h4>Fakturačná adresa</h4>';
            html += '<p>';
            html += escapeHtml((billName + " " + (order.billing_name2 || "")).trim()) + '<br>';
            html += escapeHtml(billStreet) + '<br>';
            html += escapeHtml((billZip + " " + billCity).trim()) + '<br>';
            html += escapeHtml(billCountry);
            html += '</p>';
            html += '</div>';
        }

        html += '</div>'; // .order-addresses

        // Company details
        if (order.company_name) {
            html += '<div class="company-details">';
            html += '<h4>Firemné údaje</h4>';
            html += '<p>';
            html += '<strong>' + escapeHtml(order.company_name) + '</strong><br>';
            html += 'IČO: ' + escapeHtml(order.company_ico || order.ico || "-") + '<br>';
            html += 'DIČ: ' + escapeHtml(order.company_dic || order.dic || "-") + '<br>';
            html += 'IČ DPH: ' + escapeHtml(order.company_ic_dph || order.eu_vat_number || "-");
            html += '</p>';
            html += '</div>';
        }

        // Order notes
        var notes = order.note || order.order_notes || "";
        if (notes) {
            html += '<div class="order-notes">';
            html += '<h4>Poznámka k objednávke</h4>';
            html += '<p>' + escapeHtml(notes) + '</p>';
            html += '</div>';
        }

        // Shipping & Payment
        html += '<div class="order-meta">';
        var shippingLabel = order.shipping_type || order.shipping_method || "-";
        var paymentLabel = order.payment_method || "-";
        if (paymentLabel === "CARD" || paymentLabel === "card") paymentLabel = "Platobná karta";
        html += '<p><strong>Doprava:</strong> ' + escapeHtml(shippingLabel) + '</p>';
        html += '<p><strong>Platba:</strong> ' + escapeHtml(paymentLabel) + '</p>';
        html += '</div>';

        // Action buttons
        html += '<div class="order-detail-actions">';

        // Retry payment button
        if (order.payment_status === "pending" || order.status === "new") {
            html += '<button class="btn btn-primary" onclick="retryPayment(\'' + escapeHtml(order.order_number) + '\', this)">Zaplatiť objednávku</button>';
        }

        // Reorder button — always visible
        html += '<button class="btn btn-reorder" onclick="reorderOrder(\'' + escapeHtml(order.order_number) + '\', this)">';
        html += '\uD83D\uDD04 Objednať znova</button>';

        html += '</div>'; // .order-detail-actions

        html += '</div>'; // .order-detail-content

        return html;
    }

    window.toggleOrderDetail = function (orderNumber, rowElement) {
        var detailRow = rowElement.nextElementSibling;

        if (expandedOrders[orderNumber]) {
            // Collapse
            delete expandedOrders[orderNumber];
            if (detailRow && detailRow.classList.contains("order-detail-row")) {
                detailRow.remove();
            }
            rowElement.classList.remove("expanded");
        } else {
            // Expand
            expandedOrders[orderNumber] = true;
            rowElement.classList.add("expanded");

            // Insert loading row
            var loadingRow = document.createElement("tr");
            loadingRow.className = "order-detail-row";
            loadingRow.innerHTML = '<td colspan="4"><div class="order-detail-content"><p>Načítavam...</p></div></td>';
            rowElement.after(loadingRow);

            loadOrderDetail(orderNumber).then(function (detail) {
                if (!detail) {
                    alert("Chyba pri načítaní detailu objednávky");
                    delete expandedOrders[orderNumber];
                    rowElement.classList.remove("expanded");
                    loadingRow.remove();
                    return;
                }

                loadingRow.innerHTML = '<td colspan="4">' + buildOrderDetailHTML(detail) + '</td>';
            });
        }
    };

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
                ordersEl.innerHTML = "<p>Zatiaľ nemáte žiadne objednávky.</p>";
                return;
            }

            var html = '<div class="orders-table-wrap"><table class="orders-table">';
            html += '<thead><tr><th>Číslo</th><th>Dátum</th><th>Suma</th><th>Stav</th></tr></thead><tbody>';

            for (var i = 0; i < orders.length; i++) {
                var order = orders[i];
                var orderNum = order.order_number || order.id || "-";
                var date = order.created_at ? new Date(order.created_at).toLocaleDateString("sk-SK") : "-";
                var total = formatPrice(order.total_amount_vat || order.total_amount || order.total_price, order.currency === "EUR" ? "\u20ac" : order.currency);
                var rawStatus = order.payment_status || order.status || "-";
                var status = escapeHtml(translateStatus(rawStatus));

                html += '<tr class="order-row" data-order-number="' + escapeHtml(orderNum) + '">';
                html += '<td><a href="#" class="order-number-link" onclick="event.preventDefault(); toggleOrderDetail(\'' + escapeHtml(orderNum) + '\', this.closest(\'tr\'));"><span class="expand-indicator">▶</span> ' + escapeHtml(orderNum) + '</a></td>';
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
            if (ordersEl) ordersEl.innerHTML = "<p>Nepodarilo sa načítať objednávky.</p>";
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

    // --- Reorder: add order items to cart with CURRENT prices ---
    window.reorderOrder = function (orderNumber, btn) {
        btn.disabled = true;
        var originalText = btn.textContent;
        btn.textContent = "Načítavam\u2026";

        // We may already have detail cached in the DOM, but fetch fresh to be safe
        loadOrderDetail(orderNumber).then(function (detail) {
            if (!detail || !detail.items) {
                alert("Nepodarilo sa načítať detail objednávky");
                btn.disabled = false;
                btn.textContent = originalText;
                return;
            }

            // Fetch current product catalog
            return fetch("/api/products")
                .then(function (resp) {
                    if (!resp.ok) throw new Error("HTTP " + resp.status);
                    return resp.json();
                })
                .then(function (data) {
                    var products = data.products || data;
                    if (!Array.isArray(products)) {
                        throw new Error("Invalid products response");
                    }

                    // Build SKU → product map
                    var productMap = {};
                    for (var i = 0; i < products.length; i++) {
                        productMap[products[i].sku] = products[i];
                    }

                    // Build new cart with CURRENT prices
                    var cart = [];
                    var unavailable = [];

                    var orderItems = detail.items.filter(function (item) {
                        return item.item_type !== "shipping";
                    });

                    for (var j = 0; j < orderItems.length; j++) {
                        var item = orderItems[j];
                        var product = productMap[item.sku];

                        if (!product || !product.is_active) {
                            unavailable.push(item.name || item.sku);
                            continue;
                        }

                        if (product.stock_quantity !== undefined && product.stock_quantity !== null && product.stock_quantity < item.quantity) {
                            if (product.stock_quantity <= 0) {
                                unavailable.push(item.name || item.sku);
                                continue;
                            }
                            // Partial: add what's available
                            cart.push({
                                sku: product.sku,
                                name: product.name,
                                price: product.price_vat,
                                quantity: product.stock_quantity
                            });
                            unavailable.push((item.name || item.sku) + " (len " + product.stock_quantity + " ks)");
                            continue;
                        }

                        cart.push({
                            sku: product.sku,
                            name: product.name,
                            price: product.price_vat,
                            quantity: item.quantity
                        });
                    }

                    if (cart.length === 0) {
                        alert("Žiadny produkt z tejto objednávky nie je momentálne dostupný.");
                        btn.disabled = false;
                        btn.textContent = originalText;
                        return;
                    }

                    // Replace cart in sessionStorage (key = emcenter_cart)
                    sessionStorage.setItem("emcenter_cart", JSON.stringify(cart));

                    // Notify about unavailable products
                    if (unavailable.length > 0) {
                        alert("Niektoré produkty neboli pridané do košíka:\n\n" + unavailable.join("\n"));
                    }

                    // Save reorder data for checkout prefill
                    var shippingTypeMap = {
                        "Kuriér na adresu": "courier",
                        "kuriér na adresu": "courier",
                        "courier": "courier",
                        "Packeta": "packeta_point",
                        "packeta_point": "packeta_point",
                        "Výdajné miesto Packeta": "packeta_point"
                    };
                    var reorderData = {
                        customer_name: detail.customer_name || detail.billing_name || "",
                        customer_email: detail.customer_email || "",
                        customer_phone: detail.customer_phone || "",
                        billing_street: detail.billing_street || "",
                        billing_city: detail.billing_city || "",
                        billing_zip: detail.billing_zip || "",
                        billing_country: detail.billing_country || "SK",
                        shipping_different: !!(detail.shipping_street && detail.shipping_street !== detail.billing_street),
                        shipping_name: detail.shipping_name || "",
                        shipping_street: detail.shipping_street || "",
                        shipping_city: detail.shipping_city || "",
                        shipping_zip: detail.shipping_zip || "",
                        shipping_country: detail.shipping_country || "SK",
                        is_company: !!(detail.company_name),
                        company_name: detail.company_name || "",
                        company_ico: detail.company_ico || detail.ico || "",
                        company_dic: detail.company_dic || detail.dic || "",
                        company_ic_dph: detail.company_ic_dph || detail.eu_vat_number || "",
                        delivery_method: shippingTypeMap[detail.shipping_type] || "courier",
                        order_note: detail.note || ""
                    };
                    sessionStorage.setItem("emcenter_reorder", JSON.stringify(reorderData));
                    console.log("Reorder data saved:", reorderData);

                    // Redirect to main page — main.js will pick up the cart
                    window.location.href = "/?reorder=1";
                });
        }).catch(function (err) {
            console.error("Reorder error:", err);
            alert("Nastala chyba pri opakovaní objednávky");
            btn.disabled = false;
            btn.textContent = originalText;
        });
    };

    // --- Init ---
    loadProfile();
    loadOrders();

})();
