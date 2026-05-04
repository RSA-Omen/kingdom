"""
Kingdom Error Reporter — drop this into any village to enable error reporting.

Usage:
    from error_reporter import report_error

    try:
        risky_operation()
    except Exception as e:
        report_error("what failed", exc=e)
"""
import requests
import traceback
import os

KINGDOM_API = os.getenv("KINGDOM_API", "http://localhost:5001")
VILLAGE_NAME = os.getenv("VILLAGE_NAME", "unknown")


def report_error(message: str, exc: Exception = None, severity: str = "error") -> None:
    """Report an error to the Kingdom. Never raises — error reporting must not break the app."""
    try:
        requests.post(
            f"{KINGDOM_API}/api/errors",
            json={
                "village": VILLAGE_NAME,
                "message": message,
                "stack": traceback.format_exc() if exc else "",
                "severity": severity,
            },
            timeout=2,
        )
    except Exception:
        pass  # Silent — never let reporting break the app
