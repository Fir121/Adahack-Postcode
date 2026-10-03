from flask import Flask
from .api import blueprint


def create_app():
    app = Flask(__name__)
    app.register_blueprint(blueprint)
    return app
