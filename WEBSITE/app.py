# app.py
from flask import Flask, render_template, redirect

def create_app():
    app = Flask(__name__)
    
    @app.route("/gymdepot")
    def gymdepot_redirect():
        return redirect("https://gymdepot.cappyworks.com", code=301)
        
    @app.route("/prophbot")
    def prophbot_redirect():
        return redirect("https://www.fiverr.com/s/2KVaZPN", code=301)

    APP_CONFIG = {
        "assets": {
            "logo_light": "/static/images/logo-sage.png", 
            "logo_dark": "/static/images/logo-cream.png"
        },
        "meta": {
            "site_name": "Cappyworks",
            "description": "Indie studio from Cavite building tools, automating workflows, and crafting digital experiences.",
        },
        "narrative": {
            "lines": ["We build.", "We write.", "We deliver."] 
        },
        "services": [
            {
                "title": "ProPHBot Automation", 
                "desc": "Scraping & Posting Systems", 
                "url": "/prophbot",
                "size": "normal"
            },
            {
                "title": "Gym Depot E-Commerce", 
                "desc": "Minimalist Flask Design", 
                "url": "/gymdepot",
                "size": "normal"
            },
            {
                "title": "Business Web Development", 
                "desc": "Bespoke digital storefronts and landing pages. Example Case Study: GYMDEPOT (Gym Equipment Manufacturer).", 
                "url": "https://www.fiverr.com/s/zWD6Kwg",
                "size": "large" 
            }
        ],
        "team": [
            {
                "role": "Creative Writers", 
                "desc": "Story architects who adapt fast.", 
                "url": "mailto:official.cappyworks.services@gmail.com?subject=Creative%20Writing%20Inquiries"
            },
            {
                "role": "Visual Editors", 
                "desc": "Photo and video alchemists.", 
                "url": "mailto:official.cappyworks.services@gmail.com?subject=Visual%20Editing%20Inquiries"
            },
            {
                "role": "Automation (Developers)", 
                "desc": "Python engineers building custom scrapers and bots.", 
                "url": "mailto:official.cappyworks.services@gmail.com?subject=Automation%20Development%20Inquiries"
            },
            {
                "role": "Web Dev", 
                "desc": "Front-end and full-stack architecture.", 
                "url": "https://www.fiverr.com/s/Q78yW33"
            }
        ],
        "social_links": {
            "linkedin": {
                "name": "LinkedIn",
                "url": "https://www.linkedin.com/in/rey-moises-sebastian-964803406/",
                "iconClass": "fab fa-linkedin-in"
            },
            "email": {
                "name": "Email Us",
                "url": "mailto:official.cappyworks.services@gmail.com",
                "iconClass": "fas fa-envelope"
            },
            "freelancer": {
                "name": "Freelancer",
                "url": "https://www.freelancer.com/u/Cappyworks?sb=t",
                "iconClass": "fas fa-globe-americas"
            },
            "facebook": {
                "name": "Facebook",
                "url": "https://www.facebook.com/profile.php?id=61588677277895",
                "iconClass": "fab fa-facebook-f"
            },
            "instagram": {
                "name": "Instagram",
                "url": "https://www.instagram.com/cappyworksservices/",
                "iconClass": "fab fa-instagram"
            }
        }
    }

    @app.route("/")
    def index():
        return render_template("index.html", config=APP_CONFIG)

    @app.errorhandler(500)
    def internal_error(error):
        app.logger.exception('Server error: %s', error)
        return 'Internal Server Error', 500

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000)