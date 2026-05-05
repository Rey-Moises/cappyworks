"""
app.py — Application factory. Wiring only — no business logic here.
====================================================================

SINGLE RESPONSIBILITY OF THIS FILE:
create_app() wires compression, cache headers, template helpers,
the routes Blueprint, and error handlers. That is all. If you find
yourself adding data or route logic here, it belongs in config.py
or routes.py respectively.

WHY A FACTORY FUNCTION:
Calling create_app() allows multiple isolated instances (test vs
production). Instantiating at module level would make parallel test
runs and environment-specific configuration impossible.
"""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv
from flask import Flask, render_template, request
from flask_compress import Compress

# Load .env before anything else so EMAIL_PASSWORD is available to routes.py
load_dotenv()

from routes import bp as main_blueprint


# ---------------------------------------------------------------------------
# Asset versioning — module-level so the lru_cache persists across requests
# ---------------------------------------------------------------------------

@lru_cache(maxsize=256)
def _asset_version(static_root: str, rel_path: str) -> str:
    """
    Return a cache-busting fingerprint for a static asset.

    WHY MTIME OVER CONTENT HASH:
    Content hashing requires reading the entire file on every cold start.
    mtime is a single syscall. For a portfolio site where assets change
    rarely, the precision of content-hashing is not worth the I/O cost.

    The @lru_cache prevents repeated disk hits per process lifetime.
    The cache invalidates on process restart, which happens on every deploy.

    Args:
        static_root: Absolute path to the Flask static folder.
        rel_path:    Path relative to static_root (e.g. "css/style.css").

    Returns:
        Unix mtime as a decimal string. Falls back to "0" if the file is
        missing — safe degradation, the asset simply won't be cache-busted.
    """
    try:
        return str(int(os.path.getmtime(os.path.join(static_root, rel_path))))
    except OSError:
        return "0"


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app() -> Flask:
    """
    Create and configure the Flask application instance.

    Returns:
        Flask: A fully configured, ready-to-serve application.
    """
    app = Flask(__name__)

    # ── Compression ───────────────────────────────────────────────────────────
    # Brotli-first, gzip fallback, applied globally to all qualifying responses.
    # WHY NOT NGINX: Cappyworks runs Waitress with no reverse proxy at current
    # scale. Flask-Compress handles compression at the WSGI boundary.
    app.config.update(
        SEND_FILE_MAX_AGE_DEFAULT = 31_536_000,      # 1 year for /static/ assets
        COMPRESS_MIMETYPES = [
            "text/html",
            "text/css",
            "application/javascript",
            "application/json",
            "image/svg+xml",
        ],
        COMPRESS_LEVEL    = 6,
        COMPRESS_BR_LEVEL = 5,
        COMPRESS_MIN_SIZE = 512,
    )
    Compress(app)

    # ── Template helpers ───────────────────────────────────────────────────────
    @app.context_processor
    def _inject_helpers() -> dict:
        """
        Expose asset_v() to all Jinja2 templates.

        WHY context_processor OVER A GLOBAL:
        A context_processor is lazy — it only runs for requests that render
        a template. A Jinja2 global would be evaluated on every import.
        """
        return {"asset_v": lambda path: _asset_version(app.static_folder, path)}

    # ── Cache headers ─────────────────────────────────────────────────────────
    @app.after_request
    def _set_cache_headers(response):
        """
        Apply HTTP cache headers per resource type.

        Strategy:
        - /static/ assets WITH ?v= fingerprint: 1-year immutable.
          These URLs change whenever the file changes, so permanent caching
          is safe. Applies to main.js, style.css (set in templates).
        - /static/ assets WITHOUT ?v= (JS module imports, images, fonts):
          no-cache + must-revalidate. The browser re-validates with the server
          on every load but gets a fast 304 Not Modified when unchanged.
          This ensures controller JS edits are always picked up immediately.
        - HTML: no-cache so stale pages are never served to returning visitors.
        """
        if request.path.startswith("/static/"):
            if request.query_string:
                # Fingerprinted asset — safe to cache forever.
                response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            else:
                # No fingerprint — revalidate on every load.
                response.headers["Cache-Control"] = "no-cache, must-revalidate"
        elif response.content_type and response.content_type.startswith("text/html"):
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
        return response

    # ── Blueprints ─────────────────────────────────────────────────────────────
    app.register_blueprint(main_blueprint)

    # ── Error handlers ─────────────────────────────────────────────────────────
    @app.errorhandler(404)
    def _not_found(error):
        try:
            return render_template("error.html", error_code=404, error_message="Page not found"), 404
        except Exception:
            return "404 — Page not found", 404

    @app.errorhandler(500)
    def _server_error(error):
        app.logger.exception("Unhandled server error: %s", error)
        try:
            return render_template("error.html", error_code=500, error_message="Something went wrong"), 500
        except Exception:
            return "500 — Internal server error", 500

    return app


if __name__ == "__main__":
    _app = create_app()
    print("🛠️  Cappyworks dev server → http://localhost:5000")
    _app.run(debug=True, host="0.0.0.0", port=5000)
