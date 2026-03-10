/**
 * EM Center — Landing Page JavaScript
 * Vanilla JS, no dependencies.
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
    // 5. Quantity Selectors
    // =========================================
    var productCards = document.querySelectorAll(".product-card");

    for (var p = 0; p < productCards.length; p++) {
        (function (card) {
            var minusBtn = card.querySelector(".qty-minus");
            var plusBtn = card.querySelector(".qty-plus");
            var qtyDisplay = card.querySelector(".qty-value");

            if (minusBtn && plusBtn && qtyDisplay) {
                minusBtn.addEventListener("click", function () {
                    var current = parseInt(qtyDisplay.textContent, 10);
                    if (current > 1) {
                        qtyDisplay.textContent = current - 1;
                    }
                });

                plusBtn.addEventListener("click", function () {
                    var current = parseInt(qtyDisplay.textContent, 10);
                    if (current < 99) {
                        qtyDisplay.textContent = current + 1;
                    }
                });
            }
        })(productCards[p]);
    }

    // =========================================
    // 6. Cart Functionality
    // =========================================
    var cart = {};
    var cartSection = document.getElementById("kosik");
    var cartBody = document.getElementById("cart-body");
    var cartTotalPrice = document.getElementById("cart-total-price");

    function addToCart(productId, price, name, qty) {
        if (cart[productId]) {
            cart[productId].qty += qty;
        } else {
            cart[productId] = {
                name: name,
                price: price,
                qty: qty
            };
        }
        updateCart();
    }

    function removeFromCart(productId) {
        delete cart[productId];
        updateCart();
    }

    function updateCart() {
        var keys = Object.keys(cart);
        if (keys.length === 0) {
            cartSection.style.display = "none";
            return;
        }

        cartSection.style.display = "block";
        cartBody.innerHTML = "";
        var total = 0;

        for (var i = 0; i < keys.length; i++) {
            var item = cart[keys[i]];
            var lineTotal = item.price * item.qty;
            total += lineTotal;

            var tr = document.createElement("tr");
            tr.innerHTML =
                "<td>" + escapeHtml(item.name) + "</td>" +
                "<td>" + item.qty + "</td>" +
                "<td>" + formatPrice(lineTotal) + "</td>" +
                '<td><button class="cart-remove" data-product-id="' + keys[i] + '">Odstrániť</button></td>';
            cartBody.appendChild(tr);
        }

        cartTotalPrice.textContent = formatPrice(total);

        // Bind remove buttons
        var removeBtns = cartBody.querySelectorAll(".cart-remove");
        for (var r = 0; r < removeBtns.length; r++) {
            removeBtns[r].addEventListener("click", function () {
                removeFromCart(this.getAttribute("data-product-id"));
            });
        }

        // Smooth scroll to cart
        cartSection.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function formatPrice(amount) {
        return amount.toFixed(2).replace(".", ",") + " €";
    }

    function escapeHtml(str) {
        var div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    // Add to cart buttons
    var addButtons = document.querySelectorAll(".add-to-cart");
    for (var a = 0; a < addButtons.length; a++) {
        addButtons[a].addEventListener("click", function () {
            var card = this.closest(".product-card");
            var productId = card.getAttribute("data-product-id");
            var price = parseFloat(card.getAttribute("data-price"));
            var name = card.querySelector("h3").textContent;
            var qty = parseInt(card.querySelector(".qty-value").textContent, 10);
            addToCart(productId, price, name, qty);

            // Visual feedback
            var originalText = this.textContent;
            this.textContent = "✓ Pridané";
            this.disabled = true;
            var btn = this;
            setTimeout(function () {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 1500);
        });
    }

    // =========================================
    // 7. Fade-in Animations (IntersectionObserver)
    // =========================================
    if ("IntersectionObserver" in window) {
        var fadeElements = document.querySelectorAll(".fade-in");
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
})();
