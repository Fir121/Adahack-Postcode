import re
from flask_restx import Namespace, Resource, fields
from backend.models.base import PostCode
from backend.utils import get_collection

coordinates_ns = Namespace("coordinates", description="Postcode coordinates")

coordinates_model = coordinates_ns.model(
    "Coordinates",
    {
        "postcode": fields.String(required=True, example="EH1 1YZ"),
        "latitude": fields.Float(required=True, example=55.9533),
        "longitude": fields.Float(required=True, example=-3.1883),
    },
)

error_model = coordinates_ns.model("Error", {"message": fields.String(example="Postcode not found")})

POSTCODE_RE = re.compile(r"^[A-Z]{1,2}[0-9][A-Z0-9]? [0-9][A-Z]{2}$")

@coordinates_ns.route("/")
class CoordinatesList(Resource):
    @coordinates_ns.doc("list_coordinates")
    @coordinates_ns.marshal_list_with(coordinates_model)
    def get(self):
        """Get latitude and longitude for all postcodes"""
        return list(get_collection("coordinates").find({}, {"_id": 0}).sort("postcode", 1))


@coordinates_ns.route("/<string:postcode>")
@coordinates_ns.param("postcode", "Postcode")
class CoordinatesItem(Resource):
    @coordinates_ns.doc("get_coordinates")
    @coordinates_ns.response(400, "Invalid postcode", error_model)
    @coordinates_ns.response(404, "Postcode not found", error_model)
    @coordinates_ns.marshal_with(coordinates_model)
    def get(self, postcode):
        """Get latitude and longitude for a single postcode"""
        postcode = PostCode(postcode)

        doc = get_collection("coordinates").find_one({"postcode": postcode}, {"_id": 0})
        if doc is None:
            coordinates_ns.abort(404, "Postcode not found")
        return doc
