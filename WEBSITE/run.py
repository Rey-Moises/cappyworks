from waitress import serve
from app import create_app

# 1. Call the factory function to build the Flask app
app = create_app()

if __name__ == "__main__":
    # 2. Serve the newly created app using Waitress
    serve(app, host='0.0.0.0', port=5000, threads=8)