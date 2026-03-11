import pytest
import os


@pytest.fixture(scope="session")
def base_url():
    """Base URL pre E2E testy — staging kontajner."""
    return os.environ.get("E2E_BASE_URL", "http://localhost:9163")


@pytest.fixture(scope="session")
def api_url():
    """Backend API URL."""
    return os.environ.get("E2E_API_URL", "http://localhost:9110")


@pytest.fixture(scope="session")
def eshop_token():
    """Staging tenant token (test-only, nie produkcia)."""
    return os.environ.get(
        "ESHOP_API_TOKEN", "P5U3OlpPvd5iKyAmBpQUKNizpO00VEd1rZJ8UPqu3No"
    )


@pytest.fixture(scope="session")
def browser_type_launch_args():
    """Launch Chromium headless s extra args."""
    return {
        "headless": True,
        "args": ["--no-sandbox", "--disable-gpu"],
    }
