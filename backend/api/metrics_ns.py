import datetime

from flask_restx import Namespace, Resource, fields

from backend.models.user import UserModel
from backend.services.metrics import get_carbon_intensity, get_air_quality
from backend.utils import get_mongo_db, get_collection

metrics_ns = Namespace("metrics", description="Operations related to metrics")

postcode_metric_model = metrics_ns.model(
    "PostcodeMetric",
    {
        "postcode": fields.String(required=True, description="Postcode"),
        "score": fields.Integer(required=True, description="Total score for the postcode"),
    },
)

postcode_detail_metric_model = metrics_ns.model(
    "PostcodeDetailMetric",
    {
        "postcode": fields.String(required=True, description="Postcode"),
        "score": fields.Float(
            required=True,
            description="Score for the postcode, calculated as total points / (number of users * days in month) * 100.",
        ),
        "carbon_intensity": fields.Float(
            nullable=True,
            description="Carbon intensity of electricity in gCO2/kWh (null if unavailable).",
        ),
        "air_quality": fields.Integer(
            nullable=True,
            description="Air quality index, 1 (low) to 10 (very high) (null if unavailable).",
        ),
        "users": fields.List(
            fields.Nested(
                metrics_ns.model(
                    "UserMetric",
                    {
                        "user_id": fields.String(required=True, description="User ID"),
                        "name": fields.String(required=True, description="User name"),
                        "points": fields.Integer(required=True, description="User points"),
                    },
                )
            ),
            description="Users in the postcode, ordered by points descending.",
        ),
    },
)


@metrics_ns.route("/")
class PostcodeMetricsResource(Resource):
    @metrics_ns.marshal_list_with(postcode_metric_model)
    def get(self):
        """Get total points for each postcode"""
        today = datetime.date.today()
        collection = get_collection("activities")
        pipeline = [
            {"$match": {"date": {"$gte": f"{today.year}-{today.month:02d}-01"}}},
            {"$group": {"_id": "$postcode", "total_points": {"$sum": "$points"}}},
            {"$project": {"postcode": "$_id", "total_points": 1, "_id": 0}},
            {"$sort": {"postcode": 1}}
        ]
        points_per_postcode = list(collection.aggregate(pipeline))
        score_per_postcode = []
        for postcode, total_points in points_per_postcode:
            num_users = sum(1 for u in UserModel.list({"postcode": postcode}))
            score_per_postcode.append({"postcode": postcode, "score": min(total_points/(num_users * today.day) * 100, 100) if num_users > 0 else 0})
        return score_per_postcode


@metrics_ns.route("/<string:postcode>")
@metrics_ns.param("postcode", "Postcode to get user points for (e.g. EH1 1YZ)")
class PostcodeDetailMetricsResource(Resource):
    @metrics_ns.marshal_with(postcode_detail_metric_model)
    def get(self, postcode):
        """Get metrics for a postcode"""
        today = datetime.date.today()
        collection = get_mongo_db()["activities"]
        pipeline = [
            {"$match": {"postcode": postcode, "date": {"$gte": f"{today.year}-{today.month:02d}-01"}}},
            {"$group": {
                "_id": "$user_id",
                "points": {"$sum": "$points"}
            }},
            {"$lookup": {
                "from": "users",
                "localField": "_id",
                "foreignField": "user_id",
                "as": "user_info"
            }},
            {"$unwind": "$user_info"},
            {"$project": {
                "user_id": "$_id",
                "name": "$user_info.name",
                "points": 1,
                "_id": 0
            }},
            {"$sort": {"points": -1}}
        ]
        users = list(collection.aggregate(pipeline))

        return {
            "postcode": postcode,
            "carbon_intensity": get_carbon_intensity(postcode)[0],
            "air_quality": get_air_quality(postcode),
            "score": sum(user["points"] for user in users) / (len(users) * today.day) * 100 if users else 0,
            "users": users,
        }
