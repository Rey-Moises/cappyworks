# Cappyworks — Flask + fly.io deployment

This is the deployable version of the Cappyworks marketing site.
Flask serves the static HTML, and `/api/inquiry` sends two transactional emails
(studio notification + client auto-reply) on form submission.

## Stack

- **Flask 3** — static page render + JSON inquiry endpoint
- **Gunicorn** — production WSGI server
- **smtplib** — STARTTLS to your SMTP provider (Gmail, Mailgun, Resend SMTP, etc.)
- **Docker** — image deployed to **fly.io** (`primary_region = "sin"`)

## File layout

```
Flask Port/
├── app.py                # Flask app + /api/inquiry handler
├── requirements.txt
├── Dockerfile            # python:3.11-slim + gunicorn
├── fly.toml              # fly.io config (sin region, shared-cpu-1x, 256MB)
├── .dockerignore
├── templates/
│   └── index.html        # the refined site
└── static/
    ├── images/           # logos
    ├── js/               # tweaks-panel.jsx
    ├── robots.txt
    └── sitemap.xml
```

## Local development

```bash
cd "Flask Port"
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Set SMTP secrets (see "Email config" below)
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-sender@gmail.com
export SMTP_PASS=your-app-password
export STUDIO_EMAIL=official.cappyworks.services@gmail.com

python app.py
# → http://localhost:8080
```

## Deploying to fly.io

> Prereq: `brew install flyctl` (or [flyctl install](https://fly.io/docs/hands-on/install-flyctl/)) and `fly auth login`.

```bash
cd "Flask Port"

# 1. First-time only — create the app on fly. If the name "cappyworks" is taken,
#    pick another and update `app =` at the top of fly.toml accordingly.
fly launch --no-deploy --copy-config --name cappyworks

# 2. Set production secrets (these never end up in the repo or image):
fly secrets set \
  SMTP_HOST=smtp.gmail.com \
  SMTP_PORT=587 \
  SMTP_USER=official.cappyworks.services@gmail.com \
  SMTP_PASS='your-16-char-app-password' \
  STUDIO_EMAIL=official.cappyworks.services@gmail.com \
  FROM_EMAIL=official.cappyworks.services@gmail.com

# 3. Deploy
fly deploy

# 4. (optional) Point your domain
fly certs add cappyworks.com
fly certs add www.cappyworks.com
# Then add the A/AAAA records fly shows you in your DNS host.
```

After deploy, the site is live at `https://<your-app>.fly.dev`. Open it,
submit a test inquiry, and check both inboxes.

## Email config

`app.py` reads these env vars at request time. Set them via `fly secrets set`:

| Variable       | Required | Example                                  | Notes                                            |
|----------------|----------|------------------------------------------|--------------------------------------------------|
| `SMTP_HOST`    | yes      | `smtp.gmail.com`                         | Any STARTTLS-capable SMTP host                   |
| `SMTP_PORT`    | no       | `587`                                    | Default `587`                                    |
| `SMTP_USER`    | yes      | `studio@yourdomain.com`                  | The sending mailbox                              |
| `SMTP_PASS`    | yes      | `xxxxxxxxxxxxxxxx`                       | For Gmail, an **App Password** (NOT your login)  |
| `FROM_EMAIL`   | no       | `studio@yourdomain.com`                  | Defaults to `SMTP_USER`                          |
| `FROM_NAME`    | no       | `Cappyworks Studio`                      | Display name                                     |
| `STUDIO_EMAIL` | no       | `official.cappyworks.services@gmail.com` | Where notifications land. Default is set.        |
| `SITE_URL`     | no       | `https://cappyworks.com`                 | Used in client confirmation footer               |

### Gmail-specific setup

1. Turn on 2-Step Verification on the sending Google account.
2. Generate an **App Password** at <https://myaccount.google.com/apppasswords>.
3. Use that 16-char password as `SMTP_PASS`. The regular password won't work.

### Higher-deliverability alternatives

For volume or better placement in inboxes, swap to a transactional provider:

- **Resend** — `smtp.resend.com`, port `465` (SSL) or `587`, user `resend`, pass = API key
- **Mailgun** — `smtp.mailgun.org`, port `587`, user/pass from your Mailgun dashboard
- **Postmark** — `smtp.postmarkapp.com`, port `587`, user/pass = your server token (twice)

Just update `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` accordingly.

## Endpoints

| Route          | Method | Purpose                                                |
|----------------|--------|--------------------------------------------------------|
| `/`            | GET    | Marketing site                                         |
| `/api/inquiry` | POST   | Accepts JSON `{name,email,brief,budget,services,estimate}` |
| `/healthz`     | GET    | Liveness probe (used by fly.io health check)           |
| `/robots.txt`  | GET    | Crawler directives                                     |
| `/sitemap.xml` | GET    | Sitemap                                                |

## Logs & debugging

```bash
fly logs                  # tail prod logs
fly ssh console           # shell into running machine
fly status                # see machine health
```

If inquiry emails fail, look for `Inquiry email failed` in `fly logs` —
the exception message tells you whether it's auth, TLS, or the recipient.
