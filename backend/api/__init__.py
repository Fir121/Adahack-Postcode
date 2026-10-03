from flask import Flask
from backend.logging_setup import configure_logging


def create_app():
    app = Flask(__name__)
    configure_logging(app)
    try:
        from .api import blueprint
    except Exception:
        app.logger.exception("api_startup_failed")
        raise
    app.register_blueprint(blueprint)
    return app
