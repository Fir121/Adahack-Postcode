from flask import request
from flask_restx import Namespace, Resource, fields
import datetime

from backend.models.activity import Activity, activity_model
from backend.models.user import user_model

activities_ns = Namespace("activities", description="Operations related to user activities")

act_model = activities_ns.model(
    "Activity",
    {
        "task_id": fields.String(required=True, description="Task ID"),
        "user_id": fields.String(required=True, description="User ID"),
        "date": fields.String(required=True, description="Activity date (YYYY-MM-DD)"),
        "points": fields.Integer(required=True, description="Activity points"),
    },
)

activity_input_model = activities_ns.model(
    "ActivityInput",
    {
        "task_id": fields.String(required=True, description="Task ID"),
        "date": fields.String(required=True, description="Activity date (YYYY-MM-DD)"),
    },
)


@activities_ns.route("/<string:user_id>")
@activities_ns.param("user_id", "The user identifier")
class UserActivitiesResource(Resource):
    @activities_ns.param("date", "Filter activities by date (YYYY-MM-DD)", _in="query")
    @activities_ns.marshal_list_with(act_model)
    def get(self, user_id):
        """Get activities for a user"""
        date_filter = request.args.get("date")
        filters = {"user_id": user_id}
        if date_filter:
            filters["date"] = date_filter
        return activity_model.list(filters), 200

    @activities_ns.expect(activity_input_model, validate=True)
    @activities_ns.marshal_with(act_model, code=201)
    def post(self, user_id):
        """Record an activity for a user"""
        data = request.json
        task_id = data["task_id"]
        date = data["date"]

        # Check if the activity already exists
        existing_activity = activity_model.list({"user_id": user_id, "task_id": task_id, "date": date})
        if existing_activity:
            return {"message": "Activity already exists"}, 409

        # Look up the user's postcode
        user = user_model.read(user_id)
        if not user:
            return {"message": "User not found"}, 404

        # Create the activity with the user's postcode
        activity = Activity(
            task_id=task_id,
            user_id=user_id,
            date=datetime.date.fromisoformat(date),
            postcode=user["postcode"],
        )
        activity_model.write(activity)
        return activity, 201

    @activities_ns.expect(activity_input_model, validate=True)
    @activities_ns.marshal_with(act_model)
    def put(self, user_id):
        """Update an activity for a user"""
        data = request.json
        task_id = data["task_id"]
        date = data["date"]

        # Check if the activity exists
        existing_activity = activity_model.list({"user_id": user_id, "task_id": task_id})
        if not existing_activity:
            return {"message": "Activity not found"}, 404

        activity = Activity(
            task_id=task_id,
            user_id=user_id,
            date=datetime.date.fromisoformat(date),
            points=existing_activity[0].points,  # Retain existing points
        )
        activity_model.write(activity)
        return activity, 200

    @activities_ns.doc("deleteUserActivity")
    @activities_ns.param("task_id", "Task ID of the activity to delete", _in="query")
    def delete(self, user_id):
        """Delete an activity for a user"""
        task_id = request.args.get("task_id")
        if not task_id:
            return {"message": "Task ID is required"}, 400

        result = activity_model.collection.delete_one({"user_id": user_id, "task_id": task_id})
        if result.deleted_count == 0:
            return {"message": "Activity not found"}, 404
        return "", 204
