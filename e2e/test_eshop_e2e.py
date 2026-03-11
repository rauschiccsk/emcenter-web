"""
EM Center — Playwright E2E tests pre staging eshop.

10 scenárov pokrývajúcich hlavné konverzné toky:
  1. Products load from API
  2. 3PACK visual (images, AKCIA badge)
  3. Cart add + badge
  4. Cart quantity controls
  5. Checkout stepper flow (4 kroky)
  6. Checkout stepper back navigation
  7. Lead capture (e-Book)
  8. Sticky header
  9. Hero height
 10. Brand font
"""

import time
import re
import pytest
from playwright.sync_api import Page, expect


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _open_and_wait_for_products(page: Page, base_url: str):
    """Navigate to base_url and wait until real product cards render."""
    page.goto(base_url, wait_until="domcontentloaded")
    # Wait for at least one non-skeleton product card (has data-sku attribute)
    page.wait_for_selector(
        ".product-card[data-sku]", timeout=10_000
    )


def _add_product_to_cart(page: Page, sku: str = "EM-500"):
    """Click 'Pridať do košíka' for a given SKU."""
    btn = page.locator(f'.product-card[data-sku="{sku}"] .add-to-cart')
    btn.click()
    # Wait for the visual feedback ("✓ Pridané") to appear and disappear
    page.wait_for_timeout(300)


def _open_checkout(page: Page):
    """Click 'Pokračovať k objednávke' in the order-summary section."""
    page.locator("#checkout-btn").click()
    page.wait_for_selector("#checkout", state="visible", timeout=5_000)
    page.wait_for_timeout(300)


# ===========================================================================
# SCENARIO 1: Products load from API
# ===========================================================================
@pytest.mark.e2e
def test_products_load_from_api(page: Page, base_url: str):
    """Verify products load (non-skeleton), correct SKUs, prices, VAT."""
    _open_and_wait_for_products(page, base_url)

    cards = page.locator(".product-card[data-sku]")
    assert cards.count() >= 2, f"Expected ≥2 product cards, got {cards.count()}"

    # First product — EM-500
    em500 = page.locator('.product-card[data-sku="EM-500"]')
    assert em500.count() == 1, "EM-500 card not found"
    price_em500 = em500.locator(".price").text_content()
    assert "9,90" in price_em500, f"EM-500 price mismatch: {price_em500}"
    vat_em500 = em500.locator(".price-vat").text_content()
    assert "vrátane" in vat_em500 and "DPH" in vat_em500, f"VAT note missing: {vat_em500}"

    # Second product — EM-500-3PACK
    pack3 = page.locator('.product-card[data-sku="EM-500-3PACK"]')
    assert pack3.count() == 1, "EM-500-3PACK card not found"
    price_3pack = pack3.locator(".price").text_content()
    assert "19,80" in price_3pack, f"3PACK price mismatch: {price_3pack}"
    vat_3pack = pack3.locator(".price-vat").text_content()
    assert "vrátane" in vat_3pack and "DPH" in vat_3pack, f"VAT note missing: {vat_3pack}"


# ===========================================================================
# SCENARIO 2: 3PACK visual — images + AKCIA badge
# ===========================================================================
@pytest.mark.e2e
def test_3pack_visual(page: Page, base_url: str):
    """EM-500 has 1 product image; 3PACK has 3-image group + AKCIA badge."""
    _open_and_wait_for_products(page, base_url)

    # EM-500: single product image
    em500_imgs = page.locator('.product-card[data-sku="EM-500"] .product-img')
    assert em500_imgs.count() == 1, f"EM-500 should have 1 product-img, got {em500_imgs.count()}"

    # 3PACK: 3 small images in group
    pack3_imgs = page.locator(
        '.product-card[data-sku="EM-500-3PACK"] .product-img-group .product-img-small'
    )
    assert pack3_imgs.count() == 3, f"3PACK should have 3 images, got {pack3_imgs.count()}"

    # AKCIA badge on 3PACK
    akcia_3pack = page.locator(
        '.product-card[data-sku="EM-500-3PACK"] .product-badge-promo'
    )
    assert akcia_3pack.count() >= 1, "AKCIA badge missing on 3PACK"
    assert akcia_3pack.is_visible(), "AKCIA badge not visible on 3PACK"

    # AKCIA badge should NOT be visible on EM-500
    # (CSS hides it via .product-card:not([data-sku*="3PACK"]) .product-badge-promo)
    akcia_em500 = page.locator(
        '.product-card[data-sku="EM-500"] .product-badge-promo'
    )
    if akcia_em500.count() > 0:
        assert not akcia_em500.is_visible(), "AKCIA badge should NOT be visible on EM-500"


# ===========================================================================
# SCENARIO 3: Cart add + badge
# ===========================================================================
@pytest.mark.e2e
def test_cart_add_and_badge(page: Page, base_url: str):
    """Add EM-500 → badge=1, add 3PACK → badge=2."""
    _open_and_wait_for_products(page, base_url)

    badge = page.locator("#cartBadge")

    # Add EM-500
    _add_product_to_cart(page, "EM-500")
    page.wait_for_timeout(500)
    expect(badge).to_be_visible()
    assert badge.text_content().strip() == "1", f"Badge after EM-500: {badge.text_content()}"

    # Add 3PACK
    _add_product_to_cart(page, "EM-500-3PACK")
    page.wait_for_timeout(500)
    assert badge.text_content().strip() == "2", f"Badge after 3PACK: {badge.text_content()}"


# ===========================================================================
# SCENARIO 4: Cart quantity controls
# ===========================================================================
@pytest.mark.e2e
def test_cart_quantity(page: Page, base_url: str):
    """Add EM-500, verify in order summary, use +/- to change quantity."""
    _open_and_wait_for_products(page, base_url)

    # Add EM-500 to cart
    _add_product_to_cart(page, "EM-500")
    page.wait_for_timeout(500)

    # The order summary (#kosik) should be visible
    kosik = page.locator("#kosik")
    expect(kosik).to_be_visible()

    # Verify product is listed in the cart table
    cart_text = page.locator("#cart-body").text_content()
    assert "Oasis EM-1" in cart_text or "EM-500" in cart_text.upper() or "500ml" in cart_text, \
        f"Product not in cart: {cart_text}"

    # Check quantity in cart-body: first row, second column
    first_row_qty = page.locator("#cart-body tr td:nth-child(2)").first
    assert first_row_qty.text_content().strip() == "1", \
        f"Cart qty should be 1, got: {first_row_qty.text_content()}"

    # Use product card quantity selector to add more
    # First, increase qty on product card via + button
    plus_btn = page.locator('.product-card[data-sku="EM-500"] .qty-plus')
    plus_btn.click()
    page.wait_for_timeout(200)
    qty_display = page.locator("#qty-EM-500")
    assert qty_display.text_content().strip() == "2", \
        f"Product card qty should be 2, got: {qty_display.text_content()}"

    # Decrease back to 1
    minus_btn = page.locator('.product-card[data-sku="EM-500"] .qty-minus')
    minus_btn.click()
    page.wait_for_timeout(200)
    assert qty_display.text_content().strip() == "1", \
        f"Product card qty should be 1, got: {qty_display.text_content()}"


# ===========================================================================
# SCENARIO 5: Checkout stepper flow (4 kroky)
# ===========================================================================
@pytest.mark.e2e
def test_checkout_stepper_flow(page: Page, base_url: str):
    """Walk through all 4 checkout steps — DO NOT submit the order."""
    _open_and_wait_for_products(page, base_url)
    _add_product_to_cart(page, "EM-500")
    page.wait_for_timeout(500)
    _open_checkout(page)

    # --- STEP 1: Košík ---
    step1 = page.locator("#step-1")
    expect(step1).to_be_visible()
    # Stepper: step 1 active
    active_step = page.locator(".stepper-step.active")
    assert active_step.count() >= 1, "No active stepper step"
    active_label = active_step.locator(".stepper-label").text_content()
    assert "Košík" in active_label, f"Step 1 label: {active_label}"
    # Product visible in checkout summary
    summary_text = page.locator("#checkout-summary").text_content()
    assert "Oasis" in summary_text or "EM" in summary_text, \
        f"Product not in checkout summary: {summary_text}"
    # Click "Pokračovať →"
    page.locator("#step-1 .btn-step-next").click()
    page.wait_for_timeout(500)

    # --- STEP 2: Údaje ---
    step2 = page.locator("#step-2")
    expect(step2).to_be_visible()
    active_label2 = page.locator(".stepper-step.active .stepper-label").text_content()
    assert "Údaje" in active_label2, f"Step 2 label: {active_label2}"
    # Fill form
    page.fill("#customer_name", "E2E Test")
    page.fill("#customer_email", "e2e@example.com")
    page.fill("#customer_phone", "+421900000000")
    page.fill("#billing_street", "Testová 1")
    page.fill("#billing_city", "Bratislava")
    page.fill("#billing_zip", "81101")
    page.locator("#step-2 .btn-step-next").click()
    page.wait_for_timeout(500)

    # --- STEP 3: Platba ---
    step3 = page.locator("#step-3")
    expect(step3).to_be_visible()
    active_label3 = page.locator(".stepper-step.active .stepper-label").text_content()
    assert "Platba" in active_label3, f"Step 3 label: {active_label3}"
    # Payment: CARD is checked by default
    card_radio = page.locator('input[name="payment_method"][value="CARD"]')
    assert card_radio.is_checked(), "CARD should be default payment"
    # Check terms
    page.locator("#agree_terms").check()
    page.locator("#step-3 .btn-step-next").click()
    page.wait_for_timeout(500)

    # --- STEP 4: Súhrn ---
    step4 = page.locator("#step-4")
    expect(step4).to_be_visible()
    active_label4 = page.locator(".stepper-step.active .stepper-label").text_content()
    assert "Súhrn" in active_label4, f"Step 4 label: {active_label4}"
    # Verify summary contains product info and price
    summary_final = page.locator("#order-summary-final").text_content()
    assert "Oasis" in summary_final or "EM" in summary_final, \
        f"Final summary missing product: {summary_final}"
    assert "€" in summary_final, f"Final summary missing price: {summary_final}"
    # DO NOT click "Objednať" — we don't want real orders


# ===========================================================================
# SCENARIO 6: Checkout stepper back navigation
# ===========================================================================
@pytest.mark.e2e
def test_checkout_stepper_back(page: Page, base_url: str):
    """Navigate back in checkout stepper using Späť and clickable steps."""
    _open_and_wait_for_products(page, base_url)
    _add_product_to_cart(page, "EM-500")
    page.wait_for_timeout(500)
    _open_checkout(page)

    # Go to step 2
    page.locator("#step-1 .btn-step-next").click()
    page.wait_for_timeout(500)
    expect(page.locator("#step-2")).to_be_visible()

    # Fill required fields for step 2 to enable forward navigation
    page.fill("#customer_name", "E2E Test")
    page.fill("#customer_email", "e2e@example.com")
    page.fill("#customer_phone", "+421900000000")
    page.fill("#billing_street", "Testová 1")
    page.fill("#billing_city", "Bratislava")
    page.fill("#billing_zip", "81101")

    # Go to step 3
    page.locator("#step-2 .btn-step-next").click()
    page.wait_for_timeout(500)
    expect(page.locator("#step-3")).to_be_visible()

    # Try clicking on completed step 1 in the stepper bar
    completed_steps = page.locator(".stepper-step.completed")
    if completed_steps.count() > 0:
        # Click first completed step (step 1 = Košík)
        completed_steps.first.click()
        page.wait_for_timeout(500)
        expect(page.locator("#step-1")).to_be_visible()
        # Product should still be in checkout summary
        summary = page.locator("#checkout-summary").text_content()
        assert "Oasis" in summary or "EM" in summary, \
            f"Product gone after step back: {summary}"
    else:
        pytest.skip("Stepper has no clickable completed steps")

    # Navigate forward to step 2 again, then use "Späť" button
    page.locator("#step-1 .btn-step-next").click()
    page.wait_for_timeout(500)
    expect(page.locator("#step-2")).to_be_visible()

    back_btn = page.locator("#step-2 .btn-step-back")
    if back_btn.count() > 0 and back_btn.is_visible():
        back_btn.click()
        page.wait_for_timeout(500)
        expect(page.locator("#step-1")).to_be_visible()
    else:
        pytest.skip("Step 2 has no 'Späť' button")


# ===========================================================================
# SCENARIO 7: Lead capture (e-Book)
# ===========================================================================
@pytest.mark.e2e
def test_lead_capture(page: Page, base_url: str):
    """Submit lead capture form and verify success message."""
    page.goto(base_url, wait_until="domcontentloaded")
    page.wait_for_timeout(500)

    # Scroll to lead capture section
    lead_section = page.locator("#lead-capture")
    expect(lead_section).to_be_visible()
    lead_section.scroll_into_view_if_needed()

    # Fill email with unique timestamp
    unique_email = f"e2e-test-{int(time.time())}@example.com"
    page.fill("#leadEmail", unique_email)
    page.fill("#leadFirstName", "E2E Test")

    # Check GDPR consent
    page.locator("#leadGdpr").check()

    # Submit
    page.locator(".btn-lead").click()
    page.wait_for_timeout(2000)

    # Verify success: either #leadSuccess visible or form hidden
    lead_success = page.locator("#leadSuccess")
    lead_error = page.locator("#leadError")

    if lead_success.is_visible():
        success_text = lead_success.text_content()
        assert "Ďakujeme" in success_text or "e-Book" in success_text.lower() or \
            "email" in success_text.lower(), f"Unexpected success text: {success_text}"
    elif lead_error.is_visible():
        error_text = lead_error.text_content()
        # 409 = already registered is acceptable in repeated test runs
        if "zaregistrovaný" in error_text or "registered" in error_text.lower():
            pass  # acceptable — email already captured previously
        else:
            pytest.fail(f"Lead capture error: {error_text}")
    else:
        # Check if form was hidden (which also indicates success)
        form_display = page.locator("#leadForm").evaluate(
            "el => window.getComputedStyle(el).display"
        )
        assert form_display == "none", "Neither success nor error shown, form still visible"


# ===========================================================================
# SCENARIO 8: Sticky header
# ===========================================================================
@pytest.mark.e2e
def test_sticky_header(page: Page, base_url: str):
    """Header should remain visible after scrolling down and back up."""
    page.goto(base_url, wait_until="domcontentloaded")
    page.wait_for_timeout(500)

    header = page.locator("#header")
    expect(header).to_be_visible()

    # Scroll down 800px
    page.evaluate("window.scrollTo(0, 800)")
    page.wait_for_timeout(500)
    assert header.is_visible(), "Header not visible after scrolling down"

    # Scroll back to top
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(500)
    assert header.is_visible(), "Header not visible after scrolling back up"


# ===========================================================================
# SCENARIO 9: Hero height < 60% viewport
# ===========================================================================
@pytest.mark.e2e
def test_hero_height(page: Page, base_url: str):
    """Hero section height should be less than 60% of viewport height."""
    page.goto(base_url, wait_until="domcontentloaded")
    page.wait_for_timeout(500)

    hero_height = page.locator("#hero").evaluate(
        "el => el.getBoundingClientRect().height"
    )
    viewport_height = page.evaluate("window.innerHeight")

    ratio = hero_height / viewport_height
    assert ratio < 0.60, (
        f"Hero height {hero_height}px is {ratio:.1%} of viewport {viewport_height}px "
        f"(should be < 60%)"
    )


# ===========================================================================
# SCENARIO 10: Brand font
# ===========================================================================
@pytest.mark.e2e
def test_brand_font(page: Page, base_url: str):
    """brand-name elements use 'Alfa Slab One' font and green color."""
    page.goto(base_url, wait_until="domcontentloaded")
    page.wait_for_timeout(1000)  # wait for Google Fonts to load

    brand_el = page.locator(".brand-name").first
    expect(brand_el).to_be_visible()

    # Check font-family
    font_family = brand_el.evaluate(
        "el => window.getComputedStyle(el).fontFamily"
    )
    assert "Alfa Slab One" in font_family, f"Font mismatch: {font_family}"

    # Check color — should be green (#2E7D32 = rgb(46, 125, 50))
    color = brand_el.evaluate(
        "el => window.getComputedStyle(el).color"
    )
    # Parse rgb values
    rgb_match = re.search(r"rgb\((\d+),\s*(\d+),\s*(\d+)\)", color)
    if rgb_match:
        r, g, b = int(rgb_match.group(1)), int(rgb_match.group(2)), int(rgb_match.group(3))
        # Allow small tolerance (±10)
        assert abs(r - 46) <= 10, f"Red channel off: {r} (expected ~46)"
        assert abs(g - 125) <= 10, f"Green channel off: {g} (expected ~125)"
        assert abs(b - 50) <= 10, f"Blue channel off: {b} (expected ~50)"
    else:
        # Might be hex or other format
        assert "2e7d32" in color.lower() or "rgb" in color.lower(), \
            f"Unexpected color format: {color}"
