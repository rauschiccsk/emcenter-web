/**
 * EM Center — Landing Page JavaScript
 * Vanilla JS, no dependencies.
 * F2.2: API integration — dynamic products, cart, checkout
 * F4.4d: Lead capture + discount code validation
 */
(function () {
    "use strict";

    // =========================================
    // 1. Sticky Header — show after 100px scroll
    // =========================================
    var header = document.getElementById("header");
    var lastScrollY = 0;

    function handleScroll() {
        var scrollY = window.scrollY || window.pageYOffset;
        if (scrollY > 100) {
            header.classList.add("visible");
        } else {
            header.classList.remove("visible");
        }
        lastScrollY = scrollY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    // =========================================
    // 2. Mobile Hamburger Menu Toggle
    // =========================================
    var hamburger = document.getElementById("hamburger");
    var nav = document.getElementById("nav");

    if (hamburger && nav) {
        hamburger.addEventListener("click", function () {
            hamburger.classList.toggle("active");
            nav.classList.toggle("open");
        });

        // Close menu when nav link is clicked
        var navLinks = nav.querySelectorAll(".nav-link, .nav-cta");
        for (var i = 0; i < navLinks.length; i++) {
            navLinks[i].addEventListener("click", function () {
                hamburger.classList.remove("active");
                nav.classList.remove("open");
            });
        }
    }

    // =========================================
    // 3. Smooth Scroll for Anchor Links
    // =========================================
    var anchorLinks = document.querySelectorAll('a[href^="#"]');
    for (var j = 0; j < anchorLinks.length; j++) {
        anchorLinks[j].addEventListener("click", function (e) {
            var targetId = this.getAttribute("href");
            if (targetId === "#") return;
            var target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                var headerOffset = 70;
                var elementPosition = target.getBoundingClientRect().top + window.scrollY;
                var offsetPosition = elementPosition - headerOffset;
                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        });
    }

    // =========================================
    // 4. FAQ Accordion
    // =========================================
    var faqItems = document.querySelectorAll(".faq-item");

    for (var k = 0; k < faqItems.length; k++) {
        var questionBtn = faqItems[k].querySelector(".faq-question");
        if (questionBtn) {
            questionBtn.addEventListener("click", function () {
                var parentItem = this.closest(".faq-item");
                var isActive = parentItem.classList.contains("active");

                // Close all
                for (var m = 0; m < faqItems.length; m++) {
                    faqItems[m].classList.remove("active");
                    var btn = faqItems[m].querySelector(".faq-question");
                    if (btn) btn.setAttribute("aria-expanded", "false");
                }

                // Open clicked (if it was closed)
                if (!isActive) {
                    parentItem.classList.add("active");
                    this.setAttribute("aria-expanded", "true");
                }
            });
        }
    }

    // =========================================
    // 5. Fade-in Animations (IntersectionObserver)
    // =========================================
    function initFadeAnimations() {
        if ("IntersectionObserver" in window) {
            var fadeElements = document.querySelectorAll(".fade-in:not(.visible)");
            var observer = new IntersectionObserver(
                function (entries) {
                    for (var i = 0; i < entries.length; i++) {
                        if (entries[i].isIntersecting) {
                            entries[i].target.classList.add("visible");
                            observer.unobserve(entries[i].target);
                        }
                    }
                },
                {
                    threshold: 0.1,
                    rootMargin: "0px 0px -40px 0px"
                }
            );

            for (var f = 0; f < fadeElements.length; f++) {
                observer.observe(fadeElements[f]);
            }
        } else {
            // Fallback: show all elements immediately
            var allFadeIns = document.querySelectorAll(".fade-in");
            for (var ff = 0; ff < allFadeIns.length; ff++) {
                allFadeIns[ff].classList.add("visible");
            }
        }
    }

    initFadeAnimations();

    // =========================================
    // 6. PRODUCT LOADING (API + Fallback)
    // =========================================

    var FALLBACK_PRODUCTS = [
        {
            sku: "EM-500",
            name: "Oasis EM-1 - 500ml",
            short_description: "Koncentrát efektívnych mikroorganizmov. Certifikovaná pôdna pomocná látka ÚKSÚP.",
            price_vat: 9.90,
            vat_rate: 23,
            recommended: false
        },
        {
            sku: "EM-500-3PACK",
            name: "Akcia 2+1 zadarmo",
            short_description: "3\u00d7 500ml balenie za cenu dvoch. Ušetríte 9,90 \u20ac!",
            price_vat: 19.80,
            original_price: 29.70,
            vat_rate: 23,
            recommended: true
        }
    ];

    function loadProducts() {
        fetch("/api/products")
            .then(function (resp) {
                if (!resp.ok) throw new Error("HTTP " + resp.status);
                return resp.json();
            })
            .then(function (data) {
                var products = data.products || data;
                if (Array.isArray(products) && products.length > 0) {
                    renderProducts(products);
                } else {
                    renderProducts(FALLBACK_PRODUCTS);
                }
            })
            .catch(function (error) {
                console.warn("API nedostupné, používam fallback produkty:", error.message);
                renderProducts(FALLBACK_PRODUCTS);
            });
    }

    function renderProducts(products) {
        var container = document.getElementById("products-container");
        if (!container) return;

        var html = "";
        for (var i = 0; i < products.length; i++) {
            var product = products[i];
            var isRecommended = product.recommended || product.sku === "EM-500-3PACK";
            var priceFormatted = parseFloat(product.price_vat).toFixed(2).replace(".", ",");
            var vatNote = product.vat_rate ? "vrátane " + product.vat_rate + "% DPH" : "s DPH";

            html += '<div class="product-card fade-in' + (isRecommended ? " product-card--highlighted" : "") + '" data-sku="' + escapeHtml(product.sku) + '">';
            if (isRecommended) {
                html += '<div class="product-badge">NAJLEPŠIA PONUKA</div>';
            }
            html += '<div class="product-image-wrap">';
            html += '<img src="/static/images/oasis-em1-product.jpg" alt="' + escapeHtml(product.name) + '" class="product-img">';
            html += "</div>";
            html += "<h3>" + escapeHtml(product.name) + "</h3>";
            html += '<p class="product-subtitle">' + escapeHtml(product.short_description || "") + "</p>";
            html += '<div class="product-price">';
            if (product.original_price) {
                var origFormatted = parseFloat(product.original_price).toFixed(2).replace(".", ",");
                html += '<span class="price-original">' + origFormatted + " \u20ac</span> ";
            }
            html += '<span class="price">' + priceFormatted + " \u20ac</span>";
            html += '<span class="price-vat">' + vatNote + "</span>";
            html += "</div>";
            html += '<div class="quantity-selector">';
            html += '<button class="qty-btn qty-minus" data-sku="' + escapeHtml(product.sku) + '" aria-label="Znížiť množstvo">\u2212</button>';
            html += '<span class="qty-value" id="qty-' + escapeHtml(product.sku) + '">1</span>';
            html += '<button class="qty-btn qty-plus" data-sku="' + escapeHtml(product.sku) + '" aria-label="Zvýšiť množstvo">+</button>';
            html += "</div>";
            html += '<button class="btn ' + (isRecommended ? "btn-primary" : "btn-outline") + ' add-to-cart"';
            html += ' data-sku="' + escapeHtml(product.sku) + '"';
            html += ' data-name="' + escapeHtml(product.name) + '"';
            html += ' data-price="' + product.price_vat + '">';
            html += "Pridať do košíka</button>";
            html += "</div>";
        }

        container.innerHTML = html;

        // Re-attach event listeners
        attachProductEventListeners();

        // Trigger fade-in for newly rendered products
        initFadeAnimations();
    }

    function attachProductEventListeners() {
        // Quantity +/- buttons
        var minusBtns = document.querySelectorAll(".qty-minus");
        for (var i = 0; i < minusBtns.length; i++) {
            minusBtns[i].addEventListener("click", function () {
                var sku = this.getAttribute("data-sku");
                var display = document.getElementById("qty-" + sku);
                if (display) {
                    var current = parseInt(display.textContent, 10);
                    if (current > 1) display.textContent = current - 1;
                }
            });
        }

        var plusBtns = document.querySelectorAll(".qty-plus");
        for (var j = 0; j < plusBtns.length; j++) {
            plusBtns[j].addEventListener("click", function () {
                var sku = this.getAttribute("data-sku");
                var display = document.getElementById("qty-" + sku);
                if (display) {
                    var current = parseInt(display.textContent, 10);
                    if (current < 99) display.textContent = current + 1;
                }
            });
        }

        // Add to cart buttons
        var addBtns = document.querySelectorAll(".add-to-cart");
        for (var a = 0; a < addBtns.length; a++) {
            addBtns[a].addEventListener("click", function () {
                var sku = this.getAttribute("data-sku");
                var name = this.getAttribute("data-name");
                var price = parseFloat(this.getAttribute("data-price"));
                var qtyEl = document.getElementById("qty-" + sku);
                var qty = qtyEl ? parseInt(qtyEl.textContent, 10) : 1;
                addToCart(sku, name, price, qty);

                // Visual feedback
                var originalText = this.textContent;
                this.textContent = "\u2713 Pridané";
                this.disabled = true;
                var btn = this;
                setTimeout(function () {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }, 1500);
            });
        }
    }

    // =========================================
    // 7. Cart Functionality
    // =========================================
    var cart = [];
    var cartSection = document.getElementById("kosik");
    var cartBody = document.getElementById("cart-body");
    var cartTotalPrice = document.getElementById("cart-total-price");

    function addToCart(sku, name, price, quantity) {
        // Check if SKU already in cart
        var found = false;
        for (var i = 0; i < cart.length; i++) {
            if (cart[i].sku === sku) {
                cart[i].quantity += quantity;
                found = true;
                break;
            }
        }
        if (!found) {
            cart.push({ sku: sku, name: name, price: price, quantity: quantity });
        }
        updateCartDisplay();
    }

    function removeFromCart(sku) {
        cart = cart.filter(function (item) { return item.sku !== sku; });
        updateCartDisplay();
    }

    function updateCartDisplay() {
        if (cart.length === 0) {
            cartSection.style.display = "none";
            // Hide checkout if cart is empty
            var checkoutSection = document.getElementById("checkout");
            if (checkoutSection) checkoutSection.style.display = "none";
            return;
        }

        cartSection.style.display = "block";
        cartBody.innerHTML = "";
        var total = 0;

        for (var i = 0; i < cart.length; i++) {
            var item = cart[i];
            var lineTotal = item.price * item.quantity;
            total += lineTotal;

            var tr = document.createElement("tr");
            tr.innerHTML =
                "<td>" + escapeHtml(item.name) + "</td>" +
                "<td>" + item.quantity + "</td>" +
                "<td>" + formatPrice(lineTotal) + "</td>" +
                '<td><button class="cart-remove" data-sku="' + escapeHtml(item.sku) + '">Odstrániť</button></td>';
            cartBody.appendChild(tr);
        }

        cartTotalPrice.textContent = formatPrice(total);

        // Bind remove buttons
        var removeBtns = cartBody.querySelectorAll(".cart-remove");
        for (var r = 0; r < removeBtns.length; r++) {
            removeBtns[r].addEventListener("click", function () {
                removeFromCart(this.getAttribute("data-sku"));
            });
        }

        // Smooth scroll to cart
        cartSection.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function formatPrice(amount) {
        return amount.toFixed(2).replace(".", ",") + " \u20ac";
    }

    function escapeHtml(str) {
        var div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    // Checkout button — scroll to checkout form
    var checkoutBtn = document.getElementById("checkout-btn");
    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", function () {
            showCheckout();
        });
    }

    // =========================================
    // 8. CHECKOUT
    // =========================================

    // Toggle shipping address fields
    var sameShippingEl = document.getElementById("same_shipping");
    if (sameShippingEl) {
        sameShippingEl.addEventListener("change", function () {
            document.getElementById("shipping-address-fields").style.display =
                this.checked ? "none" : "block";
        });
    }

    // Toggle company fields
    var isCompanyEl = document.getElementById("is_company");
    if (isCompanyEl) {
        isCompanyEl.addEventListener("change", function () {
            document.getElementById("company-fields").style.display =
                this.checked ? "block" : "none";
        });
    }

    function showCheckout() {
        if (cart.length === 0) return;
        var checkoutSection = document.getElementById("checkout");
        if (!checkoutSection) return;
        checkoutSection.style.display = "block";

        // Fill order summary
        var summary = document.getElementById("checkout-summary");
        var total = 0;
        var tableHtml = '<table class="checkout-table"><thead><tr><th>Produkt</th><th>Ks</th><th>Cena</th></tr></thead><tbody>';
        for (var i = 0; i < cart.length; i++) {
            var item = cart[i];
            var lineTotal = item.price * item.quantity;
            total += lineTotal;
            tableHtml += "<tr><td>" + escapeHtml(item.name) + "</td><td>" + item.quantity + "</td><td>" + formatPrice(lineTotal) + "</td></tr>";
        }
        tableHtml += "</tbody></table>";
        summary.innerHTML = tableHtml;
        document.getElementById("checkout-total-price").textContent = formatPrice(total);

        // Smooth scroll to checkout
        checkoutSection.scrollIntoView({ behavior: "smooth" });
    }

    // Form validation
    function validateCheckoutForm() {
        var valid = true;

        // Clear previous errors
        var errorSpans = document.querySelectorAll(".field-error");
        for (var e = 0; e < errorSpans.length; e++) errorSpans[e].textContent = "";
        var errorGroups = document.querySelectorAll(".form-group.error");
        for (var g = 0; g < errorGroups.length; g++) errorGroups[g].classList.remove("error");

        function setError(fieldId, message) {
            valid = false;
            var field = document.getElementById(fieldId);
            if (field) {
                var group = field.closest(".form-group");
                if (group) {
                    group.classList.add("error");
                    var span = group.querySelector(".field-error");
                    if (span) span.textContent = message;
                }
            }
        }

        // Required fields
        var name = document.getElementById("customer_name").value.trim();
        if (!name) setError("customer_name", "Zadajte meno a priezvisko");

        var email = document.getElementById("customer_email").value.trim();
        if (!email) setError("customer_email", "Zadajte e-mail");
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) setError("customer_email", "Neplatný formát e-mailu");

        var phone = document.getElementById("customer_phone").value.trim();
        if (!phone) setError("customer_phone", "Zadajte telefón");
        else if (!/^(\+|00)[0-9]{9,15}$/.test(phone.replace(/\s/g, ""))) setError("customer_phone", "Neplatný formát (napr. +421901234567)");

        var street = document.getElementById("billing_street").value.trim();
        if (!street) setError("billing_street", "Zadajte ulicu a číslo");

        var city = document.getElementById("billing_city").value.trim();
        if (!city) setError("billing_city", "Zadajte mesto");

        var zip = document.getElementById("billing_zip").value.trim();
        if (!zip) setError("billing_zip", "Zadajte PSČ");
        else if (!/^[0-9]{5}$/.test(zip)) setError("billing_zip", "PSČ musí mať 5 číslic");

        // Shipping address if different
        var sameShipping = document.getElementById("same_shipping").checked;
        if (!sameShipping) {
            if (!document.getElementById("shipping_name").value.trim()) setError("shipping_name", "Zadajte meno");
            if (!document.getElementById("shipping_street").value.trim()) setError("shipping_street", "Zadajte ulicu");
            if (!document.getElementById("shipping_city").value.trim()) setError("shipping_city", "Zadajte mesto");
            var sZip = document.getElementById("shipping_zip").value.trim();
            if (!sZip) setError("shipping_zip", "Zadajte PSČ");
            else if (!/^[0-9]{5}$/.test(sZip)) setError("shipping_zip", "PSČ musí mať 5 číslic");
        }

        // Terms agreement
        if (!document.getElementById("agree_terms").checked) {
            setError("agree_terms", "Musíte súhlasiť s VOP");
        }

        return valid;
    }

    // Submit order
    function submitOrder(e) {
        e.preventDefault();

        if (!validateCheckoutForm()) return;
        if (cart.length === 0) return;

        var submitBtn = document.getElementById("submit-order-btn");
        submitBtn.disabled = true;
        submitBtn.textContent = "Odosielam...";
        document.getElementById("order-error").style.display = "none";

        var sameShipping = document.getElementById("same_shipping").checked;
        var isCompany = document.getElementById("is_company").checked;

        var payload = {
            customer_name: document.getElementById("customer_name").value.trim(),
            customer_email: document.getElementById("customer_email").value.trim(),
            customer_phone: document.getElementById("customer_phone").value.trim().replace(/\s/g, ""),
            billing_name: document.getElementById("customer_name").value.trim(),
            billing_street: document.getElementById("billing_street").value.trim(),
            billing_city: document.getElementById("billing_city").value.trim(),
            billing_zip: document.getElementById("billing_zip").value.trim(),
            billing_country: document.getElementById("billing_country").value,
            shipping_name: sameShipping ? "" : document.getElementById("shipping_name").value.trim(),
            shipping_street: sameShipping ? "" : document.getElementById("shipping_street").value.trim(),
            shipping_city: sameShipping ? "" : document.getElementById("shipping_city").value.trim(),
            shipping_zip: sameShipping ? "" : document.getElementById("shipping_zip").value.trim(),
            shipping_country: sameShipping ? document.getElementById("billing_country").value : document.getElementById("shipping_country").value,
            company_ico: isCompany ? document.getElementById("company_ico").value.trim() : "",
            company_dic: isCompany ? document.getElementById("company_dic").value.trim() : "",
            company_ic_dph: isCompany ? document.getElementById("company_ic_dph").value.trim() : "",
            items: cart.map(function (item) { return { sku: item.sku, quantity: item.quantity }; }),
            payment_method: document.querySelector('input[name="payment_method"]:checked').value,
            note: document.getElementById("order_note").value.trim(),
            discount_code: window._discountCode || null,
            lang: "sk"
        };

        fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
            .then(function (resp) {
                return resp.json().then(function (data) {
                    return { ok: resp.ok, data: data };
                });
            })
            .then(function (result) {
                if (result.ok && result.data.payment_url) {
                    // CARD payment — redirect to Comgate
                    window.location.href = result.data.payment_url;
                } else if (result.ok && !result.data.payment_url) {
                    // BANK payment — show bank transfer info
                    document.getElementById("checkout-form").style.display = "none";
                    var bankInfo = document.getElementById("bank-transfer-info");
                    document.getElementById("bank-order-number").textContent = result.data.order_number || "";
                    document.getElementById("bank-amount").textContent = formatPrice(result.data.total_amount_vat || 0);
                    document.getElementById("bank-vs").textContent = result.data.order_number || "";
                    bankInfo.style.display = "block";
                    bankInfo.scrollIntoView({ behavior: "smooth" });
                } else {
                    showOrderError(result.data.detail || "Chyba pri vytváraní objednávky.");
                }
            })
            .catch(function () {
                showOrderError("Nepodarilo sa odoslať objednávku. Skúste to prosím znova.");
            })
            .finally(function () {
                submitBtn.disabled = false;
                submitBtn.textContent = "Záväzne objednať a zaplatiť";
            });
    }

    function showOrderError(message) {
        var errorDiv = document.getElementById("order-error");
        errorDiv.textContent = message;
        errorDiv.style.display = "block";
        errorDiv.scrollIntoView({ behavior: "smooth" });
    }

    // Attach form submit
    var checkoutForm = document.getElementById("checkout-form");
    if (checkoutForm) {
        checkoutForm.addEventListener("submit", submitOrder);
    }

    // =========================================
    // 9. LEAD CAPTURE
    // =========================================

    document.getElementById("leadForm")?.addEventListener("submit", async function (e) {
        e.preventDefault();
        var email = document.getElementById("leadEmail").value.trim();
        var gdpr = document.getElementById("leadGdpr").checked;
        if (!email || !gdpr) {
            showLeadError("Vyplňte email a súhlas s GDPR.");
            return;
        }
        var body = {
            email: email,
            first_name: document.getElementById("leadFirstName").value.trim() || null,
            phone: document.getElementById("leadPhone").value.trim() || null,
            gdpr_consent: gdpr
        };
        try {
            var resp = await fetch("/api/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            if (resp.status === 201) {
                var data = await resp.json();
                document.getElementById("discountCode").textContent = data.discount_code;
                document.getElementById("discountExpiry").textContent =
                    new Date(data.expires_at).toLocaleDateString("sk-SK");
                document.getElementById("leadForm").style.display = "none";
                document.getElementById("leadSuccess").style.display = "block";
                document.getElementById("leadError").style.display = "none";
            } else if (resp.status === 409) {
                showLeadError("Tento email je už zaregistrovaný. Skontrolujte svoj email pre zľavový kód.");
            } else {
                var errData = await resp.json();
                showLeadError(errData.detail || "Nastala chyba. Skúste to znova.");
            }
        } catch (err) {
            showLeadError("Nepodarilo sa spojiť so serverom. Skúste to znova neskôr.");
        }
    });

    function showLeadError(msg) {
        var el = document.getElementById("leadError");
        if (!el) return;
        el.textContent = msg;
        el.style.display = "block";
        setTimeout(function () { el.style.display = "none"; }, 5000);
    }

    // =========================================
    // 10. DISCOUNT CODE VALIDATION
    // =========================================

    document.getElementById("validateDiscount")?.addEventListener("click", async function () {
        var code = document.getElementById("discountCodeInput").value.trim();
        if (!code) return;
        try {
            var resp = await fetch("/api/leads/validate/" + encodeURIComponent(code));
            var data = await resp.json();
            var status = document.getElementById("discountStatus");
            if (data.valid) {
                status.textContent = "\u2705 Zľava " + data.discount_percentage + "% bude aplikovaná";
                status.className = "discount-valid";
                window._discountCode = code;
            } else {
                status.textContent = "\u274c " + data.message;
                status.className = "discount-invalid";
                window._discountCode = null;
            }
        } catch (err) {
            document.getElementById("discountStatus").textContent = "\u274c Chyba pri overení";
        }
    });

    // =========================================
    // 11. Init — load products on DOMContentLoaded
    // =========================================
    loadProducts();

})();
