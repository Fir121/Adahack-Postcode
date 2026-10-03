from flask import Flask
from backend.logging_setup import configure_logging


def create_app():
    app = Flask(__name__)
    configure_logging(app)
    from .api import blueprint
    app.register_blueprint(blueprint)
    return app
