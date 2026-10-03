from flask import request
from flask_restx import Namespace, Resource, fields
import datetime

from backend.models.activity import Activity, ActivityModel
from backend.models.task import TaskModel
from backend.models.user import UserModel

activities_ns = Namespace("activities", description="Operations related to user activities")

act_model = activities_ns.model(
    "Activity",
    {
        "task_id": fields.String(required=True, description="Task ID"),
        "user_id": fields.String(required=True, description="User ID"),
        "date": fields.String(required=True, description="Activity date (YYYY-MM-DD)"),
        "points": fields.Integer(required=False, description="Activity points"),
        "postcode": fields.String(required=False, description="User postcode"),
    },
)

activity_input_model = activities_ns.model(
    "ActivityInput",
    {
        "points": fields.Integer(
            required=False, description="Awarded activity points, including any bonus"
        ),
    },
)


def activity_points(default: int) -> int:
    payload = request.get_json(silent=True)
    if payload is None:
        if request.get_data():
            activities_ns.abort(400, "Provide a JSON object with valid activity points")
        payload = {}
    if not isinstance(payload, dict):
        activities_ns.abort(400, "Provide a JSON object with valid activity points")
    points = payload.get("points", default)
    if type(points) is not int or points < 0:
        activities_ns.abort(400, "Activity points must be a non-negative integer")
    return points


@activities_ns.route("")
class ActivitiesListResource(Resource):
    @activities_ns.doc(params={
        "date": "Filter activities by date (YYYY-MM-DD)",
        "user_id": "Filter activities by user ID",
        "task_id": "Filter activities by task ID",
    })
    @activities_ns.marshal_list_with(act_model)
    def get(self):
        """Get activities with optional filters"""
        filters = {}
        date = request.args.get("date")
        user_id = request.args.get("user_id")
        task_id = request.args.get("task_id")

        if date:
            filters["date"] = date
        if user_id:
            filters["user_id"] = user_id
        if task_id:
            filters["task_id"] = task_id

        activities = ActivityModel.list(filters)
        return activities, 200


@activities_ns.route("/<string:date>/<string:user_id>/<string:task_id>")
@activities_ns.param("date", "Date of the activity (YYYY-MM-DD)")
@activities_ns.param("user_id", "The user identifier")
@activities_ns.param("task_id", "The task identifier")
class ActivityResource(Resource):
    @activities_ns.expect(activity_input_model)
    @activities_ns.marshal_with(act_model, code=201)
    def post(self, date, user_id, task_id):
        """Record an activity"""
        existing_activity = ActivityModel.list({"date": date, "user_id": user_id, "task_id": task_id})
        if existing_activity:
            return {"message": "Activity already exists"}, 409

        user = UserModel.read(user_id)
        if not user:
            return {"message": f"User {user_id} not found"}, 404

        task = TaskModel.read(task_id)
        if not task:
            return {"message": f"Task {task_id} not found"}, 404

        activity = Activity(
            task_id=task_id,
            user_id=user_id,
            date=datetime.date.fromisoformat(date),
            postcode=user.postcode,
            points=activity_points(task.points),
        )
        ActivityModel.write(activity)
        return activity, 201

    @activities_ns.expect(activity_input_model)
    @activities_ns.marshal_with(act_model)
    def put(self, date, user_id, task_id):
        """Update an activity"""
        old_activity = ActivityModel.list({"date": date, "user_id": user_id, "task_id": task_id})
        if not old_activity:
            return {"message": "Activity not found"}, 404

        activity = Activity(
            task_id=task_id,
            user_id=user_id,
            date=datetime.date.fromisoformat(date),
            points=activity_points(old_activity[0].points),
            postcode=old_activity[0].postcode,
        )
        ActivityModel.write(activity)
        return activity, 200

    def delete(self, date, user_id, task_id):
        """Delete an activity"""
        result = ActivityModel.collection.delete_one({"date": date, "user_id": user_id, "task_id": task_id})
        if result.deleted_count == 0:
            return {"message": "Activity not found"}, 404
        return "", 204
