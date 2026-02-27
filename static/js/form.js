/**
 * EM Center — Contact form AJAX handler
 * Vanilla JS, no dependencies.
 */
(function () {
    "use strict";

    var form = document.getElementById("contactForm");
    var submitBtn = document.getElementById("submitBtn");
    var successMsg = document.getElementById("successMessage");
    var errorMsg = document.getElementById("errorMessage");

    if (!form) return;

    form.addEventListener("submit", function (e) {
        e.preventDefault();

        // Reset messages
        successMsg.style.display = "none";
        errorMsg.style.display = "none";

        // Honeypot check
        var honeypot = form.querySelector('input[name="website"]');
        if (honeypot && honeypot.value) {
            form.style.display = "none";
            successMsg.style.display = "block";
            return;
        }

        // Collect form data
        var name = form.querySelector("#name").value.trim();
        var email = form.querySelector("#email").value.trim();
        var phone = form.querySelector("#phone").value.trim();
        var message = form.querySelector("#message").value.trim();

        // Client-side validation
        if (!name) {
            showError("Prosím, vyplňte vaše meno.");
            return;
        }
        if (!email || !isValidEmail(email)) {
            showError("Prosím, zadajte platný e-mail.");
            return;
        }
        if (message && message.length > 500) {
            showError("Správa môže mať maximálne 500 znakov.");
            return;
        }

        // Disable button
        submitBtn.disabled = true;
        submitBtn.textContent = "Odosielam...";

        // Send AJAX request
        fetch("/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name,
                email: email,
                phone: phone || null,
                message: message || null
            })
        })
        .then(function (response) {
            return response.json().then(function (data) {
                return { ok: response.ok, data: data };
            });
        })
        .then(function (result) {
            if (result.ok && result.data.success) {
                form.style.display = "none";
                successMsg.textContent = result.data.message;
                successMsg.style.display = "block";
            } else {
                showError(result.data.detail || result.data.message || "Nastala chyba. Skúste to prosím znova.");
                resetButton();
            }
        })
        .catch(function () {
            showError("Nastala chyba pripojenia. Skúste to prosím znova.");
            resetButton();
        });
    });

    function showError(msg) {
        errorMsg.textContent = msg;
        errorMsg.style.display = "block";
    }

    function resetButton() {
        submitBtn.disabled = false;
        submitBtn.textContent = "Chcem byť informovaný/á";
    }

    function isValidEmail(email) {
        return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email);
    }
})();
