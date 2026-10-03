from flask import Blueprint
from flask_restx import Api

from backend.api.activities_ns import activities_ns
from backend.api.coordinates_ns import coordinates_ns
from backend.api.metrics_ns import metrics_ns
from backend.api.tasks_ns import tasks_ns
from backend.api.users_ns import users_ns

blueprint = Blueprint("api", __name__, url_prefix="/api/v1")
api = Api(blueprint, title="Postcode Green Map API", version="1.0", doc="/swagger")

api.add_namespace(coordinates_ns, path="/coordinates")
api.add_namespace(tasks_ns, path="/tasks")
api.add_namespace(users_ns, path="/users")
api.add_namespace(activities_ns, path="/activities")
api.add_namespace(metrics_ns, path="/metrics")