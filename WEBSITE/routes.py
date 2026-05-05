"""
routes.py — URL routing layer, isolated as a Flask Blueprint.
=============================================================

WHY A BLUEPRINT INSTEAD OF DIRECT APP REGISTRATION:
Registering routes directly on the app object inside create_app() couples
route logic to the factory and makes routes untestable without
instantiating a full app. A Blueprint can be imported and tested with a
minimal test client independently.

OPEN/CLOSED FOR REDIRECTS:
Redirect routes are generated dynamically from REDIRECT_MAP in config.py.
Adding a new product redirect is a one-line config edit — zero code changes
to this file or any other.
"""

from __future__ import annotations

from flask import Blueprint, render_template, redirect
from config import SITE_CONFIG, REDIRECT_MAP

bp = Blueprint("main", __name__)


@bp.route("/")
def index() -> str:
    """
    Render the main landing page.

    SITE_CONFIG is imported directly rather than injected because it is
    a pure data constant — it never changes at runtime and requires no
    mocking in unit tests of the route itself.
    """
    return render_template("index.html", config=SITE_CONFIG)


def _register_redirect_routes() -> None:
    """
    Dynamically register one 301-redirect route per entry in REDIRECT_MAP.

    WHY DYNAMIC REGISTRATION:
    A static @bp.route per product means a code change and re-deploy for
    every new Cappyworks product. With this pattern, adding a new redirect
    is a single line in config.py's REDIRECT_MAP.

    The closure (_make_handler) is required to capture the loop variable
    by value — a classic Python loop-closure gotcha.
    """
    for slug, target_url in REDIRECT_MAP.items():
        def _make_handler(url: str):
            def handler():
                return redirect(url, code=301)
            handler.__name__ = f"redirect_{slug}"
            return handler
        bp.add_url_rule(f"/{slug}", view_func=_make_handler(target_url))


_register_redirect_routes()
