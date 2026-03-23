/**
 * EM Technológia — Landing Page JavaScript
 * Vanilla JS, no dependencies.
 * F2.2: API integration — dynamic products, cart, checkout
 * F4.4d: Lead capture + discount code validation
 */
(function () {
    "use strict";

    // Shipping prices (EUR incl. VAT)
    var SHIPPING_PRICES = {
        courier: 3.50,
        packeta_point: 2.50
    };

    // Umami analytics custom events
    function trackEvent(eventName, eventData) {
        if (typeof umami !== 'undefined') {
            umami.track(eventName, eventData);
        }
    }

    // =========================================
    // 1. Header — always visible (fixed position via CSS)
    // =========================================

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

        // Sort: regular products first, promo 3PACK second
        products.sort(function(a, b) {
            var aIs3Pack = (a.sku || '').toUpperCase().indexOf('3PACK') !== -1;
            var bIs3Pack = (b.sku || '').toUpperCase().indexOf('3PACK') !== -1;
            if (aIs3Pack === bIs3Pack) return 0;
            return aIs3Pack ? 1 : -1;
        });

        var html = "";
        for (var i = 0; i < products.length; i++) {
            var product = products[i];
            var isRecommended = product.recommended || product.sku === "EM-500-3PACK";
            var priceFormatted = parseFloat(product.price_vat).toFixed(2).replace(".", ",");
            var vatNote = product.vat_rate ? "vrátane " + product.vat_rate + "% DPH" : "s DPH";

            var sku = (product.sku || '').toUpperCase();
            var isPromo = sku.indexOf('3PACK') !== -1;
            html += '<div class="product-card fade-in' + (isRecommended ? " product-card--highlighted" : "") + '" data-sku="' + escapeHtml(product.sku || '') + '">';
            if (isRecommended) {
                html += '<div class="product-badge">NAJLEPŠIA PONUKA</div>';
            }
            if (isPromo) {
                html += '<span class="product-badge-promo">AKCIA</span>';
            }
            html += '<div class="product-image-wrap">';
            if (isPromo) {
                html += '<div class="product-img-group">';
                html += '<img src="/static/images/oasis-em1-product.jpg" alt="Oasis EM-1" class="product-img-small">';
                html += '<img src="/static/images/oasis-em1-product.jpg" alt="Oasis EM-1" class="product-img-small">';
                html += '<img src="/static/images/oasis-em1-product.jpg" alt="Oasis EM-1" class="product-img-small">';
                html += '</div>';
            } else {
                html += '<img src="/static/images/oasis-em1-product.jpg" alt="' + escapeHtml(product.name) + '" class="product-img">';
            }
            html += "</div>";
            var displayName = escapeHtml(product.name).replace(/Oasis EM-1/gi, '<span class="brand-name">Oasis EM-1</span>');
            html += "<h3>" + displayName + "</h3>";
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
    // 7. Cart Functionality (sessionStorage persisted)
    // =========================================
    var cart = [];
    var cartSection = document.getElementById("kosik");
    var cartBody = document.getElementById("cart-body");
    var cartTotalPrice = document.getElementById("cart-total-price");

    // --- Cart persistence via sessionStorage ---
    function saveCartState() {
        try {
            sessionStorage.setItem('emcenter_cart', JSON.stringify(cart));
        } catch (e) { /* quota exceeded or private mode */ }
    }

    function loadCartState() {
        try {
            var saved = sessionStorage.getItem('emcenter_cart');
            if (saved) {
                var parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    cart = parsed;
                }
            }
        } catch (e) { /* corrupted data */ }
    }

    // Load cart from sessionStorage on init
    loadCartState();

    function updateCartBadge() {
        var badge = document.getElementById("cartBadge");
        if (badge && typeof cart !== "undefined") {
            var count = cart.reduce(function (sum, item) { return sum + item.quantity; }, 0);
            badge.textContent = count;
            badge.style.display = count > 0 ? "flex" : "none";
        }
    }

    // Header cart click — scroll to checkout/cart or navigate
    var headerCartEl = document.getElementById("headerCart");
    if (headerCartEl) {
        headerCartEl.addEventListener("click", function (e) {
            e.preventDefault();
            if (window.location.pathname === '/checkout') {
                // Already on checkout — scroll to stepper
                var stepperEl = document.getElementById('checkoutStepper');
                if (stepperEl) stepperEl.scrollIntoView({ behavior: 'smooth' });
                return;
            }
            var target = document.getElementById("kosik");
            if (target && target.style.display !== "none") {
                target.scrollIntoView({ behavior: "smooth" });
            } else {
                var prodSection = document.getElementById("produkty");
                if (prodSection) prodSection.scrollIntoView({ behavior: "smooth" });
            }
        });
    }

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
        saveCartState();
        trackEvent('add-to-cart', { sku: sku || '', name: name || '', price: price || 0 });
        updateCartDisplay();
    }

    function removeFromCart(sku) {
        cart = cart.filter(function (item) { return item.sku !== sku; });
        saveCartState();
        updateCartDisplay();
    }

    function updateCartDisplay() {
        updateCartBadge();
        if (!cartSection || !cartBody) return; // Not on main page (e.g. /checkout)
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

    // Checkout button — navigate to standalone checkout page
    var checkoutBtn = document.getElementById("checkout-btn");
    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", function () {
            saveCartState();
            window.location.href = '/checkout';
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

    // Toggle account creation fields
    var createAccountEl = document.getElementById("create_account");
    if (createAccountEl) {
        createAccountEl.addEventListener("change", function () {
            document.getElementById("account-fields").style.display =
                this.checked ? "block" : "none";
        });
    }

    // =========================================
    // 8a. CHECKOUT STEPPER
    // =========================================
    var currentStep = 1;
    var totalSteps = 5;
    var stepLabels = ['Košík', 'Doprava', 'Údaje', 'Platba', 'Súhrn'];
    var stepIcons = ['🛒', '🚚', '📋', '💳', '✅'];

    function renderStepper() {
        var container = document.getElementById('checkoutStepper');
        if (!container) return;

        var html = '';
        for (var i = 1; i <= totalSteps; i++) {
            var state = i < currentStep ? 'completed' : (i === currentStep ? 'active' : '');
            var icon = i < currentStep ? '✓' : stepIcons[i - 1];

            if (i > 1) {
                var lineState = i <= currentStep ? 'completed' : '';
                html += '<div class="stepper-line ' + lineState + '"></div>';
            }

            html += '<div class="stepper-step ' + state + '"' + (state === 'completed' ? ' onclick="goToStep(' + i + ')"' : '') + '>';
            html += '<div class="stepper-circle">' + icon + '</div>';
            html += '<span class="stepper-label">' + stepLabels[i - 1] + '</span>';
            html += '</div>';
        }
        container.innerHTML = html;
    }

    // VOP consent is handled in step 4 (agree_terms) — no duplicate in step 5

    // Expose to global scope for onclick handlers
    window.goToStep = function (step) {
        if (step > currentStep) return;
        currentStep = step;
        showCurrentStep();
    };

    window.nextStep = function () {
        if (currentStep >= totalSteps) return;
        // Validation before next step
        if (currentStep === 1 && getCartItemCount() === 0) {
            alert('Košík je prázdny');
            return;
        }
        if (currentStep === 2 && !validateDeliveryStep()) {
            return;
        }
        if (currentStep === 3 && !validateContactForm()) {
            return;
        }
        if (currentStep === 4 && !validatePaymentSelection()) {
            return;
        }
        currentStep++;
        var stepNames = {1: 'cart', 2: 'delivery', 3: 'details', 4: 'payment', 5: 'summary'};
        trackEvent('checkout-step', { step: currentStep, name: stepNames[currentStep] || 'unknown' });
        showCurrentStep();
        // Build summary on step 5
        if (currentStep === 5) {
            buildOrderSummary();
        }
    };

    window.prevStep = function () {
        if (currentStep <= 1) {
            // Step 1 back → return to main page
            window.location.href = '/';
            return;
        }
        currentStep--;
        showCurrentStep();
    };

    function showCurrentStep() {
        for (var i = 1; i <= totalSteps; i++) {
            var el = document.getElementById('step-' + i);
            if (el) el.style.display = i === currentStep ? 'block' : 'none';
        }
        renderStepper();
        var stepperEl = document.getElementById('checkoutStepper');
        if (stepperEl) stepperEl.scrollIntoView({ behavior: 'smooth' });
    }

    function getCartItemCount() {
        return cart.reduce(function (sum, item) { return sum + item.quantity; }, 0);
    }

    function validateContactForm() {
        var valid = true;
        // Clear previous errors
        var errorSpans = document.querySelectorAll('#step-3 .field-error');
        for (var e = 0; e < errorSpans.length; e++) errorSpans[e].textContent = '';
        var errorGroups = document.querySelectorAll('#step-3 .form-group.error');
        for (var g = 0; g < errorGroups.length; g++) errorGroups[g].classList.remove('error');

        function setError(fieldId, message) {
            valid = false;
            var field = document.getElementById(fieldId);
            if (field) {
                var group = field.closest('.form-group');
                if (group) {
                    group.classList.add('error');
                    var span = group.querySelector('.field-error');
                    if (span) span.textContent = message;
                }
            }
        }

        var name = document.getElementById('customer_name').value.trim();
        if (!name) setError('customer_name', 'Zadajte meno a priezvisko');

        var email = document.getElementById('customer_email').value.trim();
        if (!email) setError('customer_email', 'Zadajte e-mail');
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) setError('customer_email', 'Neplatný formát e-mailu');

        var phone = document.getElementById('customer_phone').value.trim();
        if (!phone) setError('customer_phone', 'Zadajte telefón');
        else if (!/^(\+|00)[0-9]{9,15}$/.test(phone.replace(/\s/g, ''))) setError('customer_phone', 'Neplatný formát (napr. +421901234567)');

        var street = document.getElementById('billing_street').value.trim();
        if (!street) setError('billing_street', 'Zadajte ulicu a číslo');

        var city = document.getElementById('billing_city').value.trim();
        if (!city) setError('billing_city', 'Zadajte mesto');

        var zip = document.getElementById('billing_zip').value.trim();
        if (!zip) setError('billing_zip', 'Zadajte PSČ');
        else if (!/^[0-9]{5}$/.test(zip)) setError('billing_zip', 'PSČ musí mať 5 číslic');

        // Shipping address if different
        var sameShipping = document.getElementById('same_shipping').checked;
        if (!sameShipping) {
            if (!document.getElementById('shipping_name').value.trim()) setError('shipping_name', 'Zadajte meno');
            if (!document.getElementById('shipping_street').value.trim()) setError('shipping_street', 'Zadajte ulicu');
            if (!document.getElementById('shipping_city').value.trim()) setError('shipping_city', 'Zadajte mesto');
            var sZip = document.getElementById('shipping_zip').value.trim();
            if (!sZip) setError('shipping_zip', 'Zadajte PSČ');
            else if (!/^[0-9]{5}$/.test(sZip)) setError('shipping_zip', 'PSČ musí mať 5 číslic');
        }

        // Company fields validation
        var isCompanyChecked = document.getElementById('is_company') && document.getElementById('is_company').checked;
        if (isCompanyChecked) {
            var companyName = document.getElementById('company_name');
            if (companyName && !companyName.value.trim()) setError('company_name', 'Zadajte názov firmy');
            var companyIco = document.getElementById('company_ico');
            if (companyIco && !companyIco.value.trim()) setError('company_ico', 'Zadajte IČO');
        }

        // Account creation validation
        var createAccountChecked = document.getElementById('create_account') && document.getElementById('create_account').checked;
        if (createAccountChecked) {
            var pwd = document.getElementById('account_password');
            var pwdConfirm = document.getElementById('account_password_confirm');
            if (pwd && (!pwd.value || pwd.value.length < 8)) setError('account_password', 'Heslo musí mať minimálne 8 znakov');
            if (pwd && pwdConfirm && pwd.value !== pwdConfirm.value) setError('account_password_confirm', 'Heslá sa nezhodujú');
        }

        return valid;
    }

    function validatePaymentSelection() {
        var valid = true;
        // Payment method is now hardcoded to CARD — no radio selection needed
        // Check terms agreement
        var termsEl = document.getElementById('agree_terms');
        if (termsEl && !termsEl.checked) {
            var group = termsEl.closest('.form-group');
            if (group) {
                group.classList.add('error');
                var span = group.querySelector('.field-error');
                if (span) span.textContent = 'Musíte súhlasiť s VOP';
            }
            valid = false;
        } else if (termsEl) {
            var group2 = termsEl.closest('.form-group');
            if (group2) {
                group2.classList.remove('error');
                var span2 = group2.querySelector('.field-error');
                if (span2) span2.textContent = '';
            }
        }
        return valid;
    }

    function buildOrderSummary() {
        var container = document.getElementById('order-summary-final');
        if (!container) return;

        var deliveryData = getDeliveryData();
        var shippingLabel = deliveryData.delivery_method === 'packeta_point' ? 'Packeta výdajné miesto' : 'Kuriér na adresu';

        // 1) Kontaktné údaje
        var tableHtml = '<div class="summary-section"><h4>Kontaktné údaje</h4>';
        tableHtml += '<p><strong>' + escapeHtml(document.getElementById('customer_name').value.trim()) + '</strong></p>';
        tableHtml += '<p>' + escapeHtml(document.getElementById('customer_email').value.trim()) + '</p>';
        tableHtml += '<p>' + escapeHtml(document.getElementById('customer_phone').value.trim()) + '</p>';
        tableHtml += '<p>' + escapeHtml(document.getElementById('billing_street').value.trim()) + ', ';
        tableHtml += escapeHtml(document.getElementById('billing_zip').value.trim()) + ' ';
        tableHtml += escapeHtml(document.getElementById('billing_city').value.trim()) + '</p>';
        if (deliveryData.packeta_point_name) {
            tableHtml += '<p>Výdajné miesto: ' + escapeHtml(deliveryData.packeta_point_name) + '</p>';
        }
        tableHtml += '</div>';

        // 1b) Firemné údaje (only if company order)
        var isCompanySummary = document.getElementById('is_company') && document.getElementById('is_company').checked;
        if (isCompanySummary) {
            var companyNameVal = document.getElementById('company_name') ? document.getElementById('company_name').value.trim() : '';
            if (companyNameVal) {
                tableHtml += '<div class="summary-section"><h4>Firemné údaje</h4>';
                tableHtml += '<p><strong>' + escapeHtml(companyNameVal) + '</strong></p>';
                var icoVal = document.getElementById('company_ico') ? document.getElementById('company_ico').value.trim() : '';
                var dicVal = document.getElementById('company_dic') ? document.getElementById('company_dic').value.trim() : '';
                var icDphVal = document.getElementById('company_ic_dph') ? document.getElementById('company_ic_dph').value.trim() : '';
                if (icoVal) tableHtml += '<p>IČO: ' + escapeHtml(icoVal) + '</p>';
                if (dicVal) tableHtml += '<p>DIČ: ' + escapeHtml(dicVal) + '</p>';
                if (icDphVal) tableHtml += '<p>IČ DPH: ' + escapeHtml(icDphVal) + '</p>';

                // Fakturačná adresa firmy (ak je vyplnená)
                var cbStreet = document.getElementById('company_billing_street') ? document.getElementById('company_billing_street').value.trim() : '';
                var cbCity = document.getElementById('company_billing_city') ? document.getElementById('company_billing_city').value.trim() : '';
                var cbZip = document.getElementById('company_billing_postal_code') ? document.getElementById('company_billing_postal_code').value.trim() : '';
                if (cbStreet || cbCity || cbZip) {
                    tableHtml += '<div class="mt-2"><strong>Fakturačná adresa</strong></div>';
                    if (cbStreet) tableHtml += '<p>' + escapeHtml(cbStreet) + '</p>';
                    if (cbZip || cbCity) tableHtml += '<p>' + escapeHtml(cbZip) + ' ' + escapeHtml(cbCity) + '</p>';
                }
                tableHtml += '</div>';
            }
        }

        // 2) Objednané produkty + shipping ako riadok tabuľky
        var total = 0;
        tableHtml += '<div class="summary-section"><h4>Objednané produkty</h4>';
        tableHtml += '<table class="summary-table"><thead><tr><th>Produkt</th><th class="text-center">Ks</th><th class="text-end">Cena</th></tr></thead><tbody>';
        for (var i = 0; i < cart.length; i++) {
            var item = cart[i];
            var lineTotal = item.price * item.quantity;
            total += lineTotal;
            tableHtml += '<tr><td>' + escapeHtml(item.name) + '</td><td class="text-center">' + item.quantity + '</td><td class="text-end">' + formatPrice(lineTotal) + '</td></tr>';
        }
        // Shipping as proper table row
        tableHtml += '<tr><td>' + shippingLabel + '</td><td class="text-center">1</td><td class="text-end">' + formatPrice(deliveryData.shipping_price) + '</td></tr>';
        total += deliveryData.shipping_price;
        tableHtml += '</tbody></table>';
        tableHtml += '<div class="summary-total">Celkom s DPH: ' + formatPrice(total) + '</div>';
        tableHtml += '</div>';

        // 3) Spôsob platby
        tableHtml += '<div class="summary-section"><h4>Spôsob platby</h4>';
        tableHtml += '<p>Platba kartou (Comgate)</p>';
        tableHtml += '</div>';

        container.innerHTML = tableHtml;
    }

    function showCheckout() {
        if (cart.length === 0) {
            // If on checkout page with empty cart, redirect to main
            if (window.location.pathname === '/checkout') {
                window.location.href = '/';
            }
            return;
        }
        // On main page, show the inline checkout section
        var checkoutSection = document.getElementById("checkout");
        if (checkoutSection) {
            checkoutSection.style.display = "block";
        }

        // Fill order summary for step 1
        var summary = document.getElementById("checkout-summary");
        if (!summary) return;
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

        // Reset to step 1
        currentStep = 1;
        showCurrentStep();

        // Smooth scroll to checkout (stepper or section)
        var scrollTarget = document.getElementById("checkoutStepper") || checkoutSection;
        if (scrollTarget) scrollTarget.scrollIntoView({ behavior: "smooth" });
    }

    // Form validation (called on final submit — stepper already validated per-step)
    function validateCheckoutForm() {
        // Re-validate everything as a safety net
        var contactOk = validateContactForm();
        var paymentOk = validatePaymentSelection();
        return contactOk && paymentOk;
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
        var createAccount = document.getElementById("create_account") && document.getElementById("create_account").checked;

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
            is_company_order: isCompany,
            company_name: isCompany ? (document.getElementById("company_name") ? document.getElementById("company_name").value.trim() : "") : null,
            company_ico: isCompany ? document.getElementById("company_ico").value.trim() : null,
            company_dic: isCompany ? document.getElementById("company_dic").value.trim() : null,
            company_ic_dph: isCompany ? document.getElementById("company_ic_dph").value.trim() : null,
            company_billing_street: isCompany ? (document.getElementById("company_billing_street") ? document.getElementById("company_billing_street").value.trim() : "") : null,
            company_billing_city: isCompany ? (document.getElementById("company_billing_city") ? document.getElementById("company_billing_city").value.trim() : "") : null,
            company_billing_postal_code: isCompany ? (document.getElementById("company_billing_postal_code") ? document.getElementById("company_billing_postal_code").value.trim() : "") : null,
            billing_country_company: "SK",
            create_account: createAccount || false,
            account_password: createAccount ? (document.getElementById("account_password") ? document.getElementById("account_password").value : null) : null,
            items: cart.map(function (item) { return { sku: item.sku, quantity: item.quantity }; }),
            payment_method: "CARD",
            note: document.getElementById("order_note").value.trim(),
            discount_code: null,
            lang: "sk",
            delivery_method: getDeliveryData().delivery_method,
            packeta_point_id: getDeliveryData().packeta_point_id,
            packeta_point_name: getDeliveryData().packeta_point_name,
            shipping_price: getDeliveryData().shipping_price
        };

        var orderHeaders = { "Content-Type": "application/json" };
        var authToken = sessionStorage.getItem("auth_token");
        if (authToken) {
            orderHeaders["Authorization"] = "Bearer " + authToken;
        }

        fetch("/api/orders", {
            method: "POST",
            headers: orderHeaders,
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
                    trackEvent('order-submitted', { order_number: result.data.order_number || 'unknown' });
                    if (isCompany) { trackEvent('company-order'); }
                    if (createAccount) { trackEvent('account-created', { source: 'checkout' }); }
                    // Clear cart from sessionStorage after successful order
                    try { sessionStorage.removeItem('emcenter_cart'); } catch (e) {}
                    window.location.href = result.data.payment_url;
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
            phone: null,
            gdpr_consent: gdpr
        };
        try {
            var resp = await fetch("/api/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            if (resp.status === 201) {
                // Backend returns discount_code but we ignore it — e-Book pivot
                document.getElementById("leadForm").style.display = "none";
                document.getElementById("leadSuccess").style.display = "block";
                document.getElementById("leadError").style.display = "none";
                trackEvent('lead-registered', { source: 'ebook-popup' });
            } else if (resp.status === 409) {
                showLeadError("Tento email je už zaregistrovaný. Skontrolujte svoj email.");
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
    // 10. DISCOUNT CODE VALIDATION (removed — e-Book pivot)
    // =========================================

    // =========================================
    // 11. PACKETA WIDGET + DELIVERY SELECTION
    // =========================================
    var PACKETA_API_KEY = "0c3c778ce0bb1857";
    var selectedPacketaPoint = null;

    // Delivery option click handlers
    var courierRadio = document.getElementById('delivery-courier');
    var packetaRadio = document.getElementById('delivery-packeta');
    var selectPointBtn = document.getElementById('select-packeta-point');
    var deliveryContinueBtn = document.getElementById('delivery-continue-btn');
    var courierOption = document.getElementById('delivery-option-courier');
    var packetaOption = document.getElementById('delivery-option-packeta');

    if (courierRadio) {
        courierRadio.addEventListener('change', function () {
            if (this.checked) {
                if (selectPointBtn) selectPointBtn.style.display = 'none';
                document.getElementById('selected-packeta-point').style.display = 'none';
                selectedPacketaPoint = null;
                if (deliveryContinueBtn) deliveryContinueBtn.disabled = false;
                if (courierOption) courierOption.classList.add('selected');
                if (packetaOption) packetaOption.classList.remove('selected');
                trackEvent('delivery-selected', { method: 'courier' });
            }
        });
    }

    if (packetaRadio) {
        packetaRadio.addEventListener('change', function () {
            if (this.checked) {
                if (selectPointBtn) selectPointBtn.style.display = 'inline-block';
                if (deliveryContinueBtn) deliveryContinueBtn.disabled = !selectedPacketaPoint;
                if (packetaOption) packetaOption.classList.add('selected');
                if (courierOption) courierOption.classList.remove('selected');
                if (selectedPacketaPoint) {
                    document.getElementById('selected-packeta-point').style.display = 'block';
                }
            }
        });
    }

    if (selectPointBtn) {
        selectPointBtn.addEventListener('click', function () {
            if (typeof Packeta === 'undefined' || !Packeta.Widget) {
                alert('Packeta widget sa načítava, skúste znova o chvíľu.');
                return;
            }
            Packeta.Widget.pick(PACKETA_API_KEY, function (point) {
                if (point) {
                    selectedPacketaPoint = {
                        id: point.id,
                        name: point.nameStreet || point.name,
                        city: point.city,
                        zip: point.zip
                    };
                    document.getElementById('packeta-point-name').textContent =
                        selectedPacketaPoint.name + ', ' + selectedPacketaPoint.zip + ' ' + selectedPacketaPoint.city;
                    document.getElementById('selected-packeta-point').style.display = 'block';
                    if (deliveryContinueBtn) deliveryContinueBtn.disabled = false;
                    trackEvent('delivery-selected', {
                        method: 'packeta_point',
                        point_id: String(selectedPacketaPoint.id)
                    });
                }
            }, {
                country: "sk",
                language: "sk"
            });
        });
    }

    function validateDeliveryStep() {
        var checked = document.querySelector('input[name="delivery_method"]:checked');
        if (!checked) {
            alert('Vyberte spôsob dopravy.');
            return false;
        }
        if (checked.value === 'packeta_point' && !selectedPacketaPoint) {
            alert('Prosím, vyberte výdajné miesto Packeta.');
            return false;
        }
        return true;
    }

    function getDeliveryData() {
        var checked = document.querySelector('input[name="delivery_method"]:checked');
        var method = checked ? checked.value : 'courier';
        if (method === 'packeta_point' && selectedPacketaPoint) {
            return {
                delivery_method: 'packeta_point',
                packeta_point_id: selectedPacketaPoint.id,
                packeta_point_name: selectedPacketaPoint.name + ', ' + selectedPacketaPoint.zip + ' ' + selectedPacketaPoint.city,
                shipping_price: SHIPPING_PRICES.packeta_point
            };
        }
        return {
            delivery_method: 'courier',
            packeta_point_id: null,
            packeta_point_name: null,
            shipping_price: SHIPPING_PRICES.courier
        };
    }

    // =========================================
    // 12. Auth State — User Icon + Checkout Pre-fill
    // =========================================
    function updateUserIcon() {
        var token = sessionStorage.getItem('auth_token');
        var userName = sessionStorage.getItem('customer_name');
        var userIcon = document.getElementById('user-icon');
        var userNameSpan = document.getElementById('user-name');

        if (!userIcon) return;

        if (token && userName) {
            // Logged in
            userIcon.href = '/account';
            userIcon.title = 'Môj účet';
            if (userNameSpan) {
                userNameSpan.textContent = userName;
                userNameSpan.style.display = 'inline';
            }
        } else {
            // Not logged in
            userIcon.href = '/login';
            userIcon.title = 'Prihlásenie';
            if (userNameSpan) {
                userNameSpan.style.display = 'none';
            }
        }
    }

    function prefillCheckoutFromProfile() {
        var token = sessionStorage.getItem('auth_token');
        if (!token) return;

        fetch('/api/eshop/customers/profile', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function (res) {
            if (!res.ok) return null;
            return res.json();
        })
        .then(function (profile) {
            if (!profile) return;
            var nameEl = document.getElementById('customer_name');
            var emailEl = document.getElementById('customer_email');
            var phoneEl = document.getElementById('customer_phone');
            var streetEl = document.getElementById('billing_street');
            var cityEl = document.getElementById('billing_city');
            var zipEl = document.getElementById('billing_zip');

            if (nameEl && !nameEl.value && profile.name) nameEl.value = profile.name;
            if (emailEl && !emailEl.value && profile.email) emailEl.value = profile.email;
            if (phoneEl && !phoneEl.value && profile.phone) phoneEl.value = profile.phone;
            if (streetEl && !streetEl.value && profile.billing_street) streetEl.value = profile.billing_street;
            if (cityEl && !cityEl.value && profile.billing_city) cityEl.value = profile.billing_city;
            if (zipEl && !zipEl.value && profile.billing_zip) zipEl.value = profile.billing_zip;
        })
        .catch(function () { /* silently fail — prefill is a convenience */ });
    }

    // =========================================
    // 12b. Reorder Prefill — from sessionStorage (higher priority than profile)
    // =========================================
    function prefillFromReorder() {
        var reorderJson = sessionStorage.getItem('emcenter_reorder');
        if (!reorderJson) return false;

        var data;
        try {
            data = JSON.parse(reorderJson);
        } catch (e) {
            sessionStorage.removeItem('emcenter_reorder');
            return false;
        }
        sessionStorage.removeItem('emcenter_reorder'); // One-time use
        console.log('Prefilling checkout from reorder data:', data);

        // Contact details
        var nameEl = document.getElementById('customer_name');
        var emailEl = document.getElementById('customer_email');
        var phoneEl = document.getElementById('customer_phone');
        if (nameEl && data.customer_name) nameEl.value = data.customer_name;
        if (emailEl && data.customer_email) emailEl.value = data.customer_email;
        if (phoneEl && data.customer_phone) phoneEl.value = data.customer_phone;

        // Billing address
        var streetEl = document.getElementById('billing_street');
        var cityEl = document.getElementById('billing_city');
        var zipEl = document.getElementById('billing_zip');
        var countryEl = document.getElementById('billing_country');
        if (streetEl && data.billing_street) streetEl.value = data.billing_street;
        if (cityEl && data.billing_city) cityEl.value = data.billing_city;
        if (zipEl && data.billing_zip) zipEl.value = data.billing_zip;
        if (countryEl && data.billing_country) countryEl.value = data.billing_country;

        // Shipping address (if different)
        if (data.shipping_different) {
            var sameShippingCb = document.getElementById('same_shipping');
            if (sameShippingCb) {
                sameShippingCb.checked = false;
                var shippingFields = document.getElementById('shipping-address-fields');
                if (shippingFields) shippingFields.style.display = 'block';
            }
            var shipName = document.getElementById('shipping_name');
            var shipStreet = document.getElementById('shipping_street');
            var shipCity = document.getElementById('shipping_city');
            var shipZip = document.getElementById('shipping_zip');
            var shipCountry = document.getElementById('shipping_country');
            if (shipName && data.shipping_name) shipName.value = data.shipping_name;
            if (shipStreet && data.shipping_street) shipStreet.value = data.shipping_street;
            if (shipCity && data.shipping_city) shipCity.value = data.shipping_city;
            if (shipZip && data.shipping_zip) shipZip.value = data.shipping_zip;
            if (shipCountry && data.shipping_country) shipCountry.value = data.shipping_country;
        }

        // Company details
        if (data.is_company && data.company_name) {
            var compCheckbox = document.getElementById('is_company');
            if (compCheckbox) {
                compCheckbox.checked = true;
                var compFields = document.getElementById('company-fields');
                if (compFields) compFields.style.display = 'block';
            }
            var compName = document.getElementById('company_name');
            var compIco = document.getElementById('company_ico');
            var compDic = document.getElementById('company_dic');
            var compIcDph = document.getElementById('company_ic_dph');
            if (compName && data.company_name) compName.value = data.company_name;
            if (compIco && data.company_ico) compIco.value = data.company_ico;
            if (compDic && data.company_dic) compDic.value = data.company_dic;
            if (compIcDph && data.company_ic_dph) compIcDph.value = data.company_ic_dph;
        }

        // Delivery method (Step 2)
        if (data.delivery_method) {
            var radioId = data.delivery_method === 'packeta_point' ? 'delivery-packeta' : 'delivery-courier';
            var radio = document.getElementById(radioId);
            if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change'));
            }
        }

        // Order note
        var noteEl = document.getElementById('order_note');
        if (noteEl && data.order_note) noteEl.value = data.order_note;

        return true;
    }

    // Update user icon state on page load
    updateUserIcon();

    // =========================================
    // 13. Init — load products on DOMContentLoaded
    // =========================================
    loadProducts();

    // =========================================
    // 14. Auto-init checkout on /checkout page
    // =========================================
    if (window.location.pathname === '/checkout') {
        // Restore cart from sessionStorage and auto-show checkout
        loadCartState();
        if (cart.length > 0) {
            showCheckout();
            // Pre-fill: reorder data has priority, then profile
            var didReorderPrefill = prefillFromReorder();
            if (!didReorderPrefill) {
                prefillCheckoutFromProfile();
            }
        }
    } else {
        // On main page, restore cart display if items exist
        if (cart.length > 0) {
            updateCartDisplay();
        }
    }

})();
