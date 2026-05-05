"""
config.py — Single Source of Truth for all site data and constants.
====================================================================

WHY A SEPARATE MODULE:
APP_CONFIG previously lived inside create_app(), meaning it was
reconstructed on every test setup, couldn't be imported independently,
and mixed data concerns with application wiring. Moving it here makes
the data layer independently importable, patchable, and verifiable.

TYPE STRATEGY — TypedDict over dataclasses:
The data is ultimately serialised into Jinja2 template context (plain
dicts). TypedDicts give static analysis and IDE completion with zero
runtime overhead and no serialisation step.

EXTENDING THIS FILE:
To add a new section (e.g. testimonials), define a TypedDict for the
shape, add it to SiteConfig, populate it below, and inject it from
routes.py. No other file needs to change.
"""

from __future__ import annotations

from typing import TypedDict, List, Optional


# ---------------------------------------------------------------------------
# Domain types — define the contract for each data shape
# ---------------------------------------------------------------------------

class AssetPaths(TypedDict):
    logo_light: str
    logo_dark: str


class MetaConfig(TypedDict):
    site_name: str
    description: str


class NarrativeConfig(TypedDict):
    lines: List[str]


class StatItem(TypedDict):
    value: str
    suffix: str
    label: str


class ProcessStep(TypedDict):
    step: str
    title: str
    desc: str


class ServiceItem(TypedDict):
    title: str
    desc: str
    url: str
    icon: str
    tags: Optional[List[str]]
    size: Optional[str]          # 'normal' | 'large' — drives CSS span-2


class FeaturedWork(TypedDict):
    title: str
    category: str
    desc: str
    tags: List[str]
    url: str
    year: str
    featured: bool


class TeamMember(TypedDict):
    role: str
    desc: str
    url: str


class SocialLink(TypedDict):
    name: str
    url: str
    iconClass: str               # Font Awesome class string e.g. "fab fa-linkedin-in"


class SiteConfig(TypedDict):
    assets: AssetPaths
    meta: MetaConfig
    narrative: NarrativeConfig
    stats: List[StatItem]
    process: List[ProcessStep]
    services: List[ServiceItem]
    featured_works: List[FeaturedWork]
    team: List[TeamMember]
    social_links: dict[str, SocialLink]


# ---------------------------------------------------------------------------
# SITE_CONFIG — edit content here, never in routes or app factory
# ---------------------------------------------------------------------------

SITE_CONFIG: SiteConfig = {
    "assets": {
        "logo_light": "/static/images/logo-sage.png",
        "logo_dark":  "/static/images/logo-cream.png",
    },

    "meta": {
        "site_name":   "Cappyworks",
        "description": (
            "An indie studio building digital experiences with warmth, "
            "precision, and a relentless focus on detail. "
            "Based in Cavite, working globally."
        ),
    },

    "narrative": {
        "lines": ["We build.", "We write.", "We deliver."],
    },

    "stats": [
        {"value": "50",  "suffix": "+", "label": "Projects Delivered"},
        {"value": "15",  "suffix": "+", "label": "Happy Clients"},
        {"value": "3",   "suffix": "+", "label": "Years Active"},
        {"value": "100", "suffix": "%", "label": "Client Retention"},
    ],

    "process": [
        {
            "step":  "01",
            "title": "Discovery",
            "desc":  "We audit your needs, competitors, and technical constraints to build a bulletproof strategy.",
        },
        {
            "step":  "02",
            "title": "Design",
            "desc":  "Wireframes evolve into pixel-perfect UI. Every interaction is intentional.",
        },
        {
            "step":  "03",
            "title": "Engineering",
            "desc":  "Production-grade Python, Flask, and vanilla JS. Zero bloat, maximum performance.",
        },
        {
            "step":  "04",
            "title": "Launch",
            "desc":  "Deployment, monitoring, and ongoing optimisation. We ship fast and iterate faster.",
        },
    ],

    "services": [
        {
            "title": "ProPHBot Automation",
            "desc":  "Scraping & Posting Systems",
            "url":   "/prophbot",
            "icon":  "bot",
            "tags":  ["Python", "Playwright", "FastAPI"],
            "size":  "normal",
        },
        {
            "title": "Gym Depot E-Commerce",
            "desc":  "Minimalist Flask Design",
            "url":   "/gymdepot",
            "icon":  "shopping",
            "tags":  ["Flask", "Python", "CSS Grid"],
            "size":  "normal",
        },
        {
            "title": "Custom Software Development",
            "desc":  "Python automation, web architecture, and full-stack solutions available on Fiverr.",
            "url":   "https://www.fiverr.com/s/YRVB16R",
            "icon":  "code",
            "tags":  ["Python", "Flask", "Automation", "Full-Stack"],
            "size":  "large",
        },
    ],

    "featured_works": [
        {
            "title":    "ProPHBot Automation",
            "category": "Automation / Affiliate Marketing",
            "desc":     (
                "A multi-platform scraping and posting engine built with Playwright. "
                "Handles Shopee, Lazada, and Zalora with parallel tab execution and deduplication."
            ),
            "tags":     ["Python", "Playwright", "Automation"],
            "url":      "/prophbot",
            "year":     "2026",
            "featured": True,
        },
        {
            "title":    "Gym Depot E-Commerce",
            "category": "Web Design / Flask",
            "desc":     (
                "Minimalist e-commerce storefront engineered in Flask. "
                "Sub-100ms TTFB, AVIF images, and a conversion-focused UX."
            ),
            "tags":     ["Flask", "E-Commerce", "Performance"],
            "url":      "/gymdepot",
            "year":     "2025",
            "featured": False,
        },
        {
            "title":    "Custom Software Development",
            "category": "Full-Stack / Consulting",
            "desc":     (
                "High-ticket Fiverr engagements delivering Python automation, "
                "web architecture, and full-stack solutions for global clients."
            ),
            "tags":     ["Python", "Full-Stack", "Consulting"],
            "url":      "https://www.fiverr.com/s/YRVB16R",
            "year":     "2025",
            "featured": False,
        },
    ],

    "team": [
        {"role": "Creative Writers",     "desc": "Story architects who adapt fast.",                      "url": "#"},
        {"role": "Visual Editors",       "desc": "Photo and video alchemists.",                           "url": "#"},
        {"role": "Automation Engineers", "desc": "Python engineers building custom scrapers and bots.",   "url": "#"},
        {"role": "Web Architects",       "desc": "Front-end and full-stack architecture.",                "url": "#"},
    ],

    "social_links": {
        "linkedin":   {"name": "LinkedIn",   "url": "https://www.linkedin.com/in/rey-moises-sebastian-964803406/", "iconClass": "fab fa-linkedin-in"},
        "email":      {"name": "Email Us",   "url": "mailto:official.cappyworks.services@gmail.com",                "iconClass": "fas fa-envelope"},
        "freelancer": {"name": "Freelancer", "url": "https://www.freelancer.com/u/Cappyworks?sb=t",                 "iconClass": "fas fa-globe-americas"},
        "facebook":   {"name": "Facebook",   "url": "https://www.facebook.com/profile.php?id=61588677277895",       "iconClass": "fab fa-facebook-f"},
        "instagram":  {"name": "Instagram",  "url": "https://www.instagram.com/cappyworksservices/",                "iconClass": "fab fa-instagram"},
    },
}

# ---------------------------------------------------------------------------
# REDIRECT_MAP — add new product/affiliate slugs here.
# Routes are generated dynamically from this map; no route code changes needed.
# ---------------------------------------------------------------------------

REDIRECT_MAP: dict[str, str] = {
    "gymdepot": "https://gymdepot.cappyworks.com",
    "prophbot":  "https://www.fiverr.com/s/2KVaZPN",
}
