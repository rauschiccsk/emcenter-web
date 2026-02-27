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
            // Bot detected — show fake success, don't send
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

        // Disable button
        submitBtn.disabled = true;
        submitBtn.textContent = "Odosielam...";

        // Send AJAX request
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/contact", true);
        xhr.setRequestHeader("Content-Type", "application/json");

        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;

            if (xhr.status === 200) {
                var resp = JSON.parse(xhr.responseText);
                if (resp.status === "ok") {
                    form.style.display = "none";
                    successMsg.style.display = "block";
                } else {
                    showError(resp.message || "Niečo sa pokazilo.");
                    resetButton();
                }
            } else {
                var errResp;
                try {
                    errResp = JSON.parse(xhr.responseText);
                } catch (_) {
                    errResp = null;
                }
                var errMsg = errResp && errResp.message
                    ? errResp.message
                    : "Niečo sa pokazilo. Skúste to prosím znova.";
                showError(errMsg);
                resetButton();
            }
        };

        xhr.onerror = function () {
            showError("Chyba pripojenia. Skontrolujte internet a skúste znova.");
            resetButton();
        };

        var payload = JSON.stringify({
            name: name,
            email: email,
            phone: phone || null,
            message: message || null
        });

        xhr.send(payload);
    });

    function showError(msg) {
        errorMsg.textContent = "✗ " + msg;
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
