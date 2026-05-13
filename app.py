"""
Cappyworks — Flask app
Serves the marketing site + handles studio inquiry submissions.

Environment variables (set in fly.io via `fly secrets set`):
  SMTP_HOST       e.g. smtp.gmail.com
  SMTP_PORT       e.g. 587
  SMTP_USER       SMTP username (sending address)
  SMTP_PASS       SMTP password / app password
  FROM_EMAIL      Display "From" address (defaults to SMTP_USER)
  FROM_NAME       Display "From" name (default: "Cappyworks Studio")
  STUDIO_EMAIL    Where studio receives inquiry notifications
                  (default: official.cappyworks.services@gmail.com)
"""
from __future__ import annotations

import os
import re
import smtplib
import ssl
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate, make_msgid
from datetime import datetime

from flask import Flask, render_template, request, jsonify, send_from_directory

# ── Config ─────────────────────────────────────────────────────────
SMTP_HOST    = os.environ.get("SMTP_HOST", "")
SMTP_PORT    = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER    = os.environ.get("SMTP_USER", "")
SMTP_PASS    = os.environ.get("SMTP_PASS", "")
FROM_EMAIL   = os.environ.get("FROM_EMAIL", SMTP_USER or "no-reply@cappyworks.com")
FROM_NAME    = os.environ.get("FROM_NAME", "Cappyworks Studio")
STUDIO_EMAIL = os.environ.get("STUDIO_EMAIL", "official.cappyworks.services@gmail.com")
SITE_URL     = os.environ.get("SITE_URL", "https://cappyworks.com")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

app = Flask(__name__, static_folder="static", template_folder="templates")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("cappyworks")


# ── Routes ─────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/robots.txt")
def robots():
    return send_from_directory(app.static_folder, "robots.txt", mimetype="text/plain")


@app.route("/sitemap.xml")
def sitemap():
    return send_from_directory(app.static_folder, "sitemap.xml", mimetype="application/xml")


@app.route("/healthz")
def health():
    return jsonify(ok=True, service="cappyworks"), 200


@app.route("/api/inquiry", methods=["POST"])
def api_inquiry():
    """Receive a studio inquiry, send notification + auto-reply."""
    payload = request.get_json(silent=True) or {}
    name     = (payload.get("name")     or "").strip()
    email    = (payload.get("email")    or "").strip()
    brief    = (payload.get("brief")    or "").strip()
    budget   = (payload.get("budget")   or "").strip()
    services = payload.get("services")  or []
    estimate = (payload.get("estimate") or "").strip()

    # Validation
    if not name or len(name) > 200:
        return jsonify(ok=False, error="Name is required."), 400
    if not email or not EMAIL_RE.match(email) or len(email) > 320:
        return jsonify(ok=False, error="A valid email is required."), 400
    if len(brief)  > 5000: return jsonify(ok=False, error="Brief is too long."),  400
    if len(budget) > 200:  return jsonify(ok=False, error="Budget is too long."), 400
    if not isinstance(services, list) or len(services) > 20:
        return jsonify(ok=False, error="Invalid services."), 400
    services = [str(s)[:80] for s in services]

    # Compose
    services_txt = ", ".join(services) if services else "—"
    submitted_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    try:
        _send_studio_notification(name, email, brief, budget, services_txt, estimate, submitted_at)
        _send_client_confirmation(name, email, services_txt, estimate)
    except Exception as exc:  # noqa: BLE001
        log.exception("Inquiry email failed: %s", exc)
        return jsonify(ok=False, error="Could not send inquiry. Please email us directly."), 502

    return jsonify(ok=True), 200


# ── Email senders ──────────────────────────────────────────────────
def _smtp_send(to_addr: str, subject: str, html: str, text: str, reply_to: str | None = None) -> None:
    """Send one email via SMTP. Raises on failure."""
    if not (SMTP_HOST and SMTP_USER and SMTP_PASS):
        raise RuntimeError("SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS).")

    msg = MIMEMultipart("alternative")
    msg["Subject"]    = subject
    msg["From"]       = formataddr((FROM_NAME, FROM_EMAIL))
    msg["To"]         = to_addr
    msg["Date"]       = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="cappyworks.com")
    if reply_to:
        msg["Reply-To"] = reply_to

    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html",  "utf-8"))

    ctx = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as s:
        s.ehlo()
        s.starttls(context=ctx)
        s.ehlo()
        s.login(SMTP_USER, SMTP_PASS)
        s.send_message(msg)


def _send_studio_notification(name, email, brief, budget, services, estimate, when) -> None:
    subject = f"New studio inquiry — {name}"
    text = f"""New inquiry received

Name:      {name}
Email:     {email}
Services:  {services}
Estimate:  {estimate or '—'}
Budget:    {budget or '—'}
Submitted: {when}

Brief:
{brief or '—'}
"""
    html = f"""<!doctype html><html><body style="margin:0;padding:32px;background:#f8f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1714;">
<table role="presentation" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid rgba(0,0,0,0.06);">
  <tr><td>
    <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#8c9e7a;margin:0 0 6px;font-weight:700;">New Inquiry</p>
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:600;margin:0 0 24px;color:#1a1714;">{_esc(name)}</h1>
    <table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.6;">
      <tr><td style="padding:8px 0;color:#6e6a62;width:110px;">Email</td><td style="padding:8px 0;"><a href="mailto:{_esc(email)}" style="color:#8c9e7a;">{_esc(email)}</a></td></tr>
      <tr><td style="padding:8px 0;color:#6e6a62;">Services</td><td style="padding:8px 0;">{_esc(services)}</td></tr>
      <tr><td style="padding:8px 0;color:#6e6a62;">Estimate</td><td style="padding:8px 0;font-weight:600;color:#8c9e7a;">{_esc(estimate or '—')}</td></tr>
      <tr><td style="padding:8px 0;color:#6e6a62;">Budget</td><td style="padding:8px 0;">{_esc(budget or '—')}</td></tr>
      <tr><td style="padding:8px 0;color:#6e6a62;">Submitted</td><td style="padding:8px 0;color:#9e9b95;">{_esc(when)}</td></tr>
    </table>
    {('<p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#8c9e7a;margin:24px 0 8px;font-weight:700;">Brief</p><p style="font-size:14px;line-height:1.7;color:#1a1714;white-space:pre-wrap;margin:0;">' + _esc(brief) + '</p>') if brief else ''}
    <p style="margin:32px 0 0;font-size:12px;color:#9e9b95;">— Sent by cappyworks.com</p>
  </td></tr>
</table></body></html>"""
    _smtp_send(STUDIO_EMAIL, subject, html, text, reply_to=email)


def _send_client_confirmation(name, email, services, estimate) -> None:
    first_name = name.split()[0] if name else ""
    subject = "We received your studio inquiry — Cappyworks"
    text = f"""Hi {first_name},

Thanks for reaching out to Cappyworks. We've received your inquiry and one of us will be in touch within one business day.

Here's a quick recap of what you sent:
  Services: {services}
  Estimate: {estimate or '—'}

If anything urgent comes up, just reply to this email.

— The Cappyworks team
{SITE_URL}
"""
    html = f"""<!doctype html><html><body style="margin:0;padding:32px;background:#f8f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1714;">
<table role="presentation" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:40px 32px;border:1px solid rgba(0,0,0,0.06);">
  <tr><td>
    <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#8c9e7a;margin:0 0 6px;font-weight:700;">Cappyworks</p>
    <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:600;line-height:1.2;margin:0 0 16px;color:#1a1714;letter-spacing:-0.01em;">Thanks, {_esc(first_name) or 'friend'} <em style="color:#8c9e7a;font-style:italic;">—</em><br>we got it.</h1>
    <p style="font-size:15px;line-height:1.7;color:#3e3a32;margin:0 0 20px;">We've received your studio inquiry and one of us will be in touch within one business day.</p>
    <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#8c9e7a;margin:24px 0 8px;font-weight:700;">Your inquiry</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.6;">
      <tr><td style="padding:6px 0;color:#6e6a62;width:110px;">Services</td><td style="padding:6px 0;">{_esc(services)}</td></tr>
      <tr><td style="padding:6px 0;color:#6e6a62;">Estimate</td><td style="padding:6px 0;font-weight:600;color:#8c9e7a;">{_esc(estimate or '—')}</td></tr>
    </table>
    <p style="font-size:14px;line-height:1.7;color:#6e6a62;margin:28px 0 0;">If anything urgent comes up, just reply to this email.</p>
    <p style="margin:32px 0 0;padding-top:24px;border-top:1px solid rgba(0,0,0,0.06);font-size:12px;color:#9e9b95;">— The Cappyworks team · <a href="{SITE_URL}" style="color:#8c9e7a;text-decoration:none;">cappyworks.com</a></p>
  </td></tr>
</table></body></html>"""
    _smtp_send(email, subject, html, text, reply_to=STUDIO_EMAIL)


def _esc(s: str) -> str:
    """Minimal HTML escape for email bodies."""
    return (str(s or "")
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;"))


# ── Local dev ──────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)), debug=False)
