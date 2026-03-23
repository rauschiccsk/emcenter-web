/**
 * EM Technológia — Authentication (Login + Registration)
 * Handles login and registration forms, sessionStorage-based token persistence.
 */
(function () {
    "use strict";

    // --- Helpers ---

    /**
     * Extracts a human-readable error message from API response data.
     * Handles: string detail, array of validation errors, message field.
     */
    function extractErrorMessage(data, fallback) {
        if (!data) return fallback || "Nastala neočakávaná chyba.";
        // FastAPI string detail (e.g. 409 duplicate)
        if (typeof data.detail === "string") return data.detail;
        // FastAPI validation errors — array of {msg, loc, type}
        if (Array.isArray(data.detail)) {
            return data.detail.map(function (e) {
                if (typeof e === "string") return e;
                return e.msg || e.message || JSON.stringify(e);
            }).join(", ");
        }
        if (typeof data.error === "string") return data.error;
        if (typeof data.message === "string") return data.message;
        return fallback || "Nastala neočakávaná chyba.";
    }

    function showError(containerId, message) {
        var el = document.getElementById(containerId);
        if (el) {
            el.textContent = message;
            el.style.display = "block";
        }
    }

    function hideError(containerId) {
        var el = document.getElementById(containerId);
        if (el) {
            el.style.display = "none";
        }
    }

    function setFieldError(fieldId, message) {
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

    function clearFieldErrors(formId) {
        var form = document.getElementById(formId);
        if (!form) return;
        var errorSpans = form.querySelectorAll(".field-error");
        for (var i = 0; i < errorSpans.length; i++) errorSpans[i].textContent = "";
        var errorGroups = form.querySelectorAll(".form-group.error");
        for (var j = 0; j < errorGroups.length; j++) errorGroups[j].classList.remove("error");
    }

    // --- LOGIN ---
    var loginForm = document.getElementById("login-form");
    if (loginForm) {
        // If already logged in, redirect to account
        if (sessionStorage.getItem("auth_token")) {
            window.location.href = "/account";
            return;
        }

        loginForm.addEventListener("submit", function (e) {
            e.preventDefault();
            clearFieldErrors("login-form");
            hideError("login-error");

            var email = document.getElementById("email").value.trim();
            var password = document.getElementById("password").value;
            var valid = true;

            if (!email) { setFieldError("email", "Zadajte e-mail"); valid = false; }
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError("email", "Neplatný formát e-mailu"); valid = false; }
            if (!password) { setFieldError("password", "Zadajte heslo"); valid = false; }

            if (!valid) return;

            var submitBtn = document.getElementById("login-submit-btn");
            submitBtn.disabled = true;
            submitBtn.textContent = "Prihlasovanie...";

            fetch("/api/eshop/customers/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email, password: password })
            })
            .then(function (resp) {
                return resp.json().then(function (data) {
                    return { ok: resp.ok, status: resp.status, data: data };
                });
            })
            .then(function (result) {
                if (result.ok && result.data.token) {
                    sessionStorage.setItem("auth_token", result.data.token);
                    var customerName = result.data.name || ((result.data.first_name || "") + " " + (result.data.last_name || "")).trim();
                    sessionStorage.setItem("customer_name", customerName);
                    sessionStorage.setItem("customer_email", result.data.email || email);
                    window.location.href = "/account";
                } else {
                    showError("login-error", extractErrorMessage(result.data, "Nesprávny email alebo heslo"));
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Prihlásiť sa";
                }
            })
            .catch(function () {
                showError("login-error", "Chyba pri prihlasovaní. Skúste to znova.");
                submitBtn.disabled = false;
                submitBtn.textContent = "Prihlásiť sa";
            });
        });
    }

    // --- REGISTRATION ---
    var registerForm = document.getElementById("register-form");
    if (registerForm) {
        // If already logged in, redirect to account
        if (sessionStorage.getItem("auth_token")) {
            window.location.href = "/account";
            return;
        }

        registerForm.addEventListener("submit", function (e) {
            e.preventDefault();
            clearFieldErrors("register-form");
            hideError("register-error");

            var name = document.getElementById("name").value.trim();
            var email = document.getElementById("email").value.trim();
            var phone = document.getElementById("phone").value.trim();
            var password = document.getElementById("password").value;
            var passwordConfirm = document.getElementById("password-confirm").value;
            var valid = true;

            if (!name) { setFieldError("name", "Zadajte meno a priezvisko"); valid = false; }
            if (!email) { setFieldError("email", "Zadajte e-mail"); valid = false; }
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError("email", "Neplatný formát e-mailu"); valid = false; }
            if (!password) { setFieldError("password", "Zadajte heslo"); valid = false; }
            else if (password.length < 8) { setFieldError("password", "Heslo musí mať minimálne 8 znakov"); valid = false; }
            if (!passwordConfirm) { setFieldError("password-confirm", "Zopakujte heslo"); valid = false; }
            else if (password !== passwordConfirm) { setFieldError("password-confirm", "Heslá sa nezhodujú"); valid = false; }

            if (!valid) return;

            var submitBtn = document.getElementById("register-submit-btn");
            submitBtn.disabled = true;
            submitBtn.textContent = "Registrácia...";

            // Split "Meno a priezvisko" into first_name / last_name
            var nameParts = name.split(/\s+/);
            var firstName = nameParts[0] || "";
            var lastName = nameParts.slice(1).join(" ") || "";

            fetch("/api/eshop/customers/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    email: email,
                    phone: phone || null,
                    password: password
                })
            })
            .then(function (resp) {
                return resp.json().then(function (data) {
                    return { ok: resp.ok, status: resp.status, data: data };
                });
            })
            .then(function (result) {
                if (result.ok && result.data.token) {
                    // Auto-login after registration
                    sessionStorage.setItem("auth_token", result.data.token);
                    var regName = result.data.name || ((result.data.first_name || "") + " " + (result.data.last_name || "")).trim() || name;
                    sessionStorage.setItem("customer_name", regName);
                    sessionStorage.setItem("customer_email", result.data.email || email);
                    window.location.href = "/account";
                } else if (result.status === 409) {
                    showError("register-error", "Účet s týmto e-mailom už existuje. Skúste sa prihlásiť.");
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Zaregistrovať sa";
                } else {
                    showError("register-error", extractErrorMessage(result.data, "Chyba pri registrácii"));
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Zaregistrovať sa";
                }
            })
            .catch(function () {
                showError("register-error", "Chyba pri registrácii. Skúste to znova.");
                submitBtn.disabled = false;
                submitBtn.textContent = "Zaregistrovať sa";
            });
        });
    }

})();
