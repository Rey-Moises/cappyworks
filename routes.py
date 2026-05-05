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

EMAIL SETUP (required for /api/inquiry):
Set two environment variables before starting the server:
  EMAIL_USER     — Gmail address (defaults to the studio address)
  EMAIL_PASSWORD — Gmail App Password (not your regular password).
                   Generate at: myaccount.google.com → Security → App Passwords
                   Requires 2-Step Verification to be enabled on the account.
"""

from __future__ import annotations

import html
import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from flask import Blueprint, render_template, redirect, request, jsonify
from config import SITE_CONFIG, REDIRECT_MAP

bp = Blueprint("main", __name__)

# ---------------------------------------------------------------------------
# Email constants
# ---------------------------------------------------------------------------

_STUDIO_EMAIL = "official.cappyworks.services@gmail.com"
_SMTP_HOST    = "smtp.gmail.com"
_SMTP_PORT    = 587


# ---------------------------------------------------------------------------
# Email helpers
# ---------------------------------------------------------------------------

def _esc(value: str) -> str:
    """HTML-escape a user-supplied string for safe inline insertion."""
    return html.escape(str(value), quote=True)


def _build_notification_html(name: str, email: str, message: str,
                              services: list[str], budget_fine: str) -> str:
    """Internal notification email sent to the Cappyworks inbox."""
    services_str = ", ".join(services) if services else "None selected"
    rows = f"""
        <tr>
          <td style="padding:10px 14px;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;width:110px;">Name</td>
          <td style="padding:10px 14px;color:#1a1a1a;">{_esc(name)}</td>
        </tr>
        <tr style="background:#fafaf8;">
          <td style="padding:10px 14px;font-weight:600;color:#555;vertical-align:top;">Email</td>
          <td style="padding:10px 14px;">
            <a href="mailto:{_esc(email)}" style="color:#8c9e7a;text-decoration:none;">{_esc(email)}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:600;color:#555;vertical-align:top;">Services</td>
          <td style="padding:10px 14px;color:#1a1a1a;">{_esc(services_str)}</td>
        </tr>"""
    if budget_fine:
        rows += f"""
        <tr style="background:#fafaf8;">
          <td style="padding:10px 14px;font-weight:600;color:#555;vertical-align:top;">Budget</td>
          <td style="padding:10px 14px;color:#1a1a1a;">{_esc(budget_fine)}</td>
        </tr>"""
    if message:
        rows += f"""
        <tr>
          <td style="padding:10px 14px;font-weight:600;color:#555;vertical-align:top;">Message</td>
          <td style="padding:10px 14px;color:#1a1a1a;white-space:pre-wrap;">{_esc(message)}</td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f5f5f0;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;
              overflow:hidden;border:1px solid #e8e8e0;">
    <div style="background:#8c9e7a;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">
        New Studio Inquiry
      </h1>
    </div>
    <div style="padding:32px;">
      <table cellpadding="0" cellspacing="0" width="100%"
             style="border-collapse:collapse;border-radius:8px;overflow:hidden;
                    border:1px solid #e8e8e0;">
        {rows}
      </table>
      <p style="margin:20px 0 0;color:#aaa;font-size:12px;">
        Reply directly to this email to respond to {_esc(name)}.
      </p>
    </div>
  </div>
</body>
</html>"""


def _build_autoreply_html(name: str, services: list[str],
                           budget_fine: str, message: str) -> str:
    """Branded auto-reply confirmation sent to the client."""
    summary_rows = ""
    if services:
        summary_rows += f"""
        <tr>
          <td style="padding:7px 0;color:#888;font-size:13px;width:110px;vertical-align:top;">Services</td>
          <td style="padding:7px 0;color:#333;font-size:13px;">{_esc(", ".join(services))}</td>
        </tr>"""
    if budget_fine:
        summary_rows += f"""
        <tr>
          <td style="padding:7px 0;color:#888;font-size:13px;vertical-align:top;">Budget</td>
          <td style="padding:7px 0;color:#333;font-size:13px;">{_esc(budget_fine)}</td>
        </tr>"""
    if message:
        summary_rows += f"""
        <tr>
          <td style="padding:7px 0;color:#888;font-size:13px;vertical-align:top;">Message</td>
          <td style="padding:7px 0;color:#333;font-size:13px;white-space:pre-wrap;">{_esc(message)}</td>
        </tr>"""

    summary_block = ""
    if summary_rows:
        summary_block = f"""
        <div style="background:#f5f5f0;border-radius:8px;padding:20px 24px;margin:24px 0;">
          <p style="margin:0 0 12px;color:#1a1a1a;font-size:11px;font-weight:700;
                    text-transform:uppercase;letter-spacing:1px;">Your Inquiry Summary</p>
          <table cellpadding="0" cellspacing="0" width="100%">{summary_rows}</table>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:40px 20px;background:#f5f5f0;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="max-width:600px;background:#ffffff;border-radius:12px;
                    overflow:hidden;border:1px solid #e8e8e0;">
        <!-- Header -->
        <tr>
          <td style="background:#8c9e7a;padding:28px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;
                        letter-spacing:-0.5px;">Cappyworks.</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 14px;color:#1a1a1a;font-size:21px;font-weight:600;">
              We received your inquiry, {_esc(name)}.
            </h2>
            <p style="margin:0;color:#666;line-height:1.7;font-size:15px;">
              Thank you for reaching out to Cappyworks. We'll review your project details
              and get back to you within <strong style="color:#1a1a1a;">24 hours</strong>.
            </p>
            {summary_block}
            <p style="margin:0;color:#aaa;font-size:13px;line-height:1.6;">
              Questions in the meantime? Email us at
              <a href="mailto:{_STUDIO_EMAIL}" style="color:#8c9e7a;text-decoration:none;">
                {_STUDIO_EMAIL}
              </a>.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #e8e8e0;">
            <p style="margin:0;color:#ccc;font-size:12px;">
              &copy; 2026 Cappyworks. Engineered in Cavite.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _send_inquiry_emails(name: str, email: str, message: str,
                          services: list[str], budget_fine: str) -> None:
    """
    Open a single authenticated SMTP session and send two emails:
      1. Internal notification (reply-to set to the client's address).
      2. Branded auto-reply confirmation to the client.

    Raises RuntimeError when EMAIL_PASSWORD is not configured.
    Raises smtplib.SMTPException (or subclasses) on delivery failure.
    """
    smtp_user = os.environ.get("EMAIL_USER", _STUDIO_EMAIL)
    smtp_pass = os.environ.get("EMAIL_PASSWORD", "")

    if not smtp_pass:
        raise RuntimeError(
            "EMAIL_PASSWORD is not set. Generate a Gmail App Password and export it "
            "as EMAIL_PASSWORD before starting the server."
        )

    ctx = ssl.create_default_context()

    with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as server:
        server.ehlo()
        server.starttls(context=ctx)
        server.login(smtp_user, smtp_pass)

        # ── 1. Notification to studio ──────────────────────────────────────
        notify = MIMEMultipart("alternative")
        notify["Subject"]  = f"New Studio Inquiry — {name}"
        notify["From"]     = smtp_user
        notify["To"]       = _STUDIO_EMAIL
        notify["Reply-To"] = email
        notify.attach(MIMEText(
            _build_notification_html(name, email, message, services, budget_fine),
            "html"
        ))
        server.sendmail(smtp_user, _STUDIO_EMAIL, notify.as_string())

        # ── 2. Auto-reply to client ────────────────────────────────────────
        reply = MIMEMultipart("alternative")
        reply["Subject"] = "Your inquiry has been received — Cappyworks"
        reply["From"]    = f"Cappyworks <{smtp_user}>"
        reply["To"]      = email
        reply.attach(MIMEText(
            _build_autoreply_html(name, services, budget_fine, message),
            "html"
        ))
        server.sendmail(smtp_user, email, reply.as_string())


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@bp.route("/")
def index() -> str:
    """
    Render the main landing page.

    SITE_CONFIG is imported directly rather than injected because it is
    a pure data constant — it never changes at runtime and requires no
    mocking in unit tests of the route itself.
    """
    return render_template("index.html", config=SITE_CONFIG)


@bp.route("/api/inquiry", methods=["POST"])
def api_inquiry():
    """
    Accept a JSON inquiry payload, send two emails via Gmail SMTP, and return
    a JSON response. Called by InquiryController.js on form submission.

    Expected body:
        { name, email, message?, services?: string[], budget_fine? }

    Returns:
        200  { ok: true }
        400  { error: "Invalid payload" }        — non-JSON body
        422  { error: "..." }                     — validation failure
        503  { error: "..." }                     — EMAIL_PASSWORD not configured
        500  { error: "..." }                     — SMTP delivery failure
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid payload"}), 400

    name  = (data.get("name")  or "").strip()
    email = (data.get("email") or "").strip()

    if not name or not email:
        return jsonify({"error": "Name and email are required"}), 422

    message     = (data.get("message")     or "").strip()
    services    = data.get("services", [])
    budget_fine = (data.get("budget_fine") or "").strip()

    # Sanitise services — must be a list of strings.
    if not isinstance(services, list):
        services = []
    services = [str(s) for s in services if isinstance(s, str)]

    try:
        _send_inquiry_emails(name, email, message, services, budget_fine)
    except RuntimeError as exc:
        # EMAIL_PASSWORD not configured — surface a clear message.
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        print(f"[inquiry] SMTP error: {exc}")
        return jsonify({"error": "Failed to send — please email us directly."}), 500

    return jsonify({"ok": True}), 200


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
