from flask_restx import Namespace, Resource, fields
from backend.utils import get_mongo_db

metrics_ns = Namespace("metrics", description="Operations related to metrics")

postcode_metric_model = metrics_ns.model(
    "PostcodeMetric",
    {
        "postcode": fields.String(required=True, description="Postcode"),
        "total_points": fields.Integer(required=True, description="Total points for the postcode"),
    },
)

postcode_detail_metric_model = metrics_ns.model(
    "PostcodeDetailMetric",
    {
        "postcode": fields.String(required=True, description="Postcode"),
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
        collection = get_mongo_db()["activities"]
        pipeline = [
            {"$group": {"_id": "$postcode", "total_points": {"$sum": "$points"}}},
            {"$project": {"postcode": "$_id", "total_points": 1, "_id": 0}},
            {"$sort": {"postcode": 1}}
        ]
        return list(collection.aggregate(pipeline))


@metrics_ns.route("/<string:postcode>")
@metrics_ns.param("postcode", "Postcode to get user points for (e.g. EH1 1YZ)")
class PostcodeDetailMetricsResource(Resource):
    @metrics_ns.marshal_with(postcode_detail_metric_model)
    def get(self, postcode):
        """Get metrics for a postcode"""
        # TODO: Fetch carbon intensity and air quality for the postcode
        carbon_intensity = 0
        air_quality = 0

        collection = get_mongo_db()["activities"]
        pipeline = [
            {"$match": {"postcode": postcode}},
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
            "carbon_intensity": carbon_intensity,  # TODO: Replace with actual value
            "air_quality": air_quality,  # TODO: Replace with actual value
            "users": users,
        }
