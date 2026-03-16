"""
E2E tests for delivery step in checkout flow.

4 scenáre pokrývajúce step-2 (Doprava) v 5-krokovom checkout:
  1. Delivery step je viditeľný v checkout flow
  2. Kuriér je default delivery method
  3. Pokračovať button funguje po výbere dopravy
  4. 5-step checkout flow — všetkých 5 krokov
"""

import pytest
from playwright.sync_api import Page, expect


# ---------------------------------------------------------------------------
# helpers (zdieľané s test_eshop_e2e.py pattern)
# ---------------------------------------------------------------------------

def _open_and_wait_for_products(page: Page, base_url: str):
    """Navigate to base_url and wait until real product cards render."""
    page.goto(base_url, wait_until="domcontentloaded")
    page.wait_for_selector(".product-card[data-sku]", timeout=10_000)


def _add_product_to_cart(page: Page, sku: str = "EM-500"):
    """Click 'Pridať do košíka' for a given SKU."""
    btn = page.locator(f'.product-card[data-sku="{sku}"] .add-to-cart')
    btn.click()
    page.wait_for_timeout(300)


def _open_checkout(page: Page):
    """Click 'Pokračovať k objednávke' in the order-summary section."""
    page.locator("#checkout-btn").click()
    page.wait_for_selector("#checkout", state="visible", timeout=5_000)
    page.wait_for_timeout(300)


def _go_to_delivery_step(page: Page, base_url: str):
    """Navigate to step-2 (Doprava) in checkout flow."""
    _open_and_wait_for_products(page, base_url)
    _add_product_to_cart(page, "EM-500")
    page.wait_for_timeout(500)
    _open_checkout(page)
    # Step 1 (Košík) → Step 2 (Doprava)
    page.locator("#step-1 .btn-step-next").click()
    page.wait_for_timeout(500)


# ===========================================================================
# SCENARIO 1: Delivery step is visible in checkout
# ===========================================================================
@pytest.mark.e2e
def test_delivery_step_visible(page: Page, base_url: str):
    """Test that delivery step (step-2) is visible and labelled 'Doprava'."""
    _go_to_delivery_step(page, base_url)

    step2 = page.locator("#step-2")
    expect(step2).to_be_visible()

    # Step title should mention delivery
    step_title = step2.locator(".form-group-title").text_content()
    assert "doprav" in step_title.lower(), f"Step 2 title: {step_title}"

    # Stepper label should be "Doprava"
    active_label = page.locator(".stepper-step.active .stepper-label").text_content()
    assert "Doprava" in active_label, f"Active stepper label: {active_label}"


# ===========================================================================
# SCENARIO 2: Courier is default delivery method
# ===========================================================================
@pytest.mark.e2e
def test_delivery_courier_default(page: Page, base_url: str):
    """Test that courier delivery method is selected by default."""
    _go_to_delivery_step(page, base_url)

    courier_radio = page.locator('input[name="delivery_method"][value="courier"]')
    expect(courier_radio).to_be_checked()

    # Packeta should NOT be checked
    packeta_radio = page.locator('input[name="delivery_method"][value="packeta_point"]')
    expect(packeta_radio).not_to_be_checked()


# ===========================================================================
# SCENARIO 3: Continue button works after delivery selection
# ===========================================================================
@pytest.mark.e2e
def test_delivery_continue_to_step3(page: Page, base_url: str):
    """Test that continue button advances from delivery (step-2) to údaje (step-3)."""
    _go_to_delivery_step(page, base_url)

    # With courier selected by default, continue button should work
    next_btn = page.locator("#step-2 .btn-step-next")
    expect(next_btn).to_be_visible()
    next_btn.click()
    page.wait_for_timeout(500)

    # Should be on step-3 (Údaje)
    step3 = page.locator("#step-3")
    expect(step3).to_be_visible()

    active_label = page.locator(".stepper-step.active .stepper-label").text_content()
    assert "Údaje" in active_label, f"Expected Údaje, got: {active_label}"


# ===========================================================================
# SCENARIO 4: Complete 5-step checkout flow
# ===========================================================================
@pytest.mark.e2e
def test_checkout_5_steps(page: Page, base_url: str):
    """Test complete 5-step checkout flow — verify all steps are present."""
    _go_to_delivery_step(page, base_url)

    # Verify stepper has 5 steps
    stepper_steps = page.locator(".stepper-step")
    assert stepper_steps.count() == 5, f"Expected 5 stepper steps, got {stepper_steps.count()}"

    # Verify step labels
    labels = [stepper_steps.nth(i).locator(".stepper-label").text_content() for i in range(5)]
    expected = ["Košík", "Doprava", "Údaje", "Platba", "Súhrn"]
    for exp, actual in zip(expected, labels):
        assert exp in actual, f"Expected '{exp}' in label, got '{actual}'"

    # Step 2 (Doprava) → Step 3 (Údaje)
    page.locator("#step-2 .btn-step-next").click()
    page.wait_for_timeout(500)
    expect(page.locator("#step-3")).to_be_visible()

    # Fill step 3 (Údaje)
    page.fill("#customer_name", "E2E Delivery Test")
    page.fill("#customer_email", "e2e-delivery@example.com")
    page.fill("#customer_phone", "+421900000000")
    page.fill("#billing_street", "Testová 1")
    page.fill("#billing_city", "Bratislava")
    page.fill("#billing_zip", "81101")
    page.locator("#step-3 .btn-step-next").click()
    page.wait_for_timeout(500)

    # Step 4 (Platba) should be visible
    expect(page.locator("#step-4")).to_be_visible()

    # Check terms and continue to step 5
    page.locator("#agree_terms").check()
    page.locator("#step-4 .btn-step-next").click()
    page.wait_for_timeout(500)

    # Step 5 (Súhrn) should be visible
    expect(page.locator("#step-5")).to_be_visible()
    active_label = page.locator(".stepper-step.active .stepper-label").text_content()
    assert "Súhrn" in active_label, f"Expected Súhrn, got: {active_label}"

    # DO NOT click submit — we don't want real orders
