from flask import request
from flask_restx import Namespace, Resource, fields
import uuid

from backend.models.user import user_model, User

users_ns = Namespace("users", description="Operations related to users")

user_model_api = users_ns.model(
    "User",
    {
        "user_id": fields.String(required=True, description="User ID"),
        "name": fields.String(required=True, description="User name"),
        "email": fields.String(required=True, description="User email"),
        "postcode": fields.String(required=True, description="User postcode"),
    },
)

user_input_model = users_ns.model(
    "UserInput",
    {
        "name": fields.String(required=True, description="User name"),
        "email": fields.String(required=True, description="User email"),
        "postcode": fields.String(required=True, description="User postcode"),
    },
)


@users_ns.route("")
class UserList(Resource):
    @users_ns.marshal_list_with(user_model_api)
    def get(self):
        """Get list of users with optional filters"""
        filters = request.args.to_dict()  # Extract query parameters as a dictionary
        return user_model.list(filters), 200

    @users_ns.expect(user_input_model, validate=True)
    @users_ns.marshal_with(user_model_api, code=201)
    def post(self):
        """Create a user"""
        data = request.json
        user = User(**data)
        user_model.write(user)
        return user, 201


@users_ns.route("/<string:user_id>")
@users_ns.param("user_id", "The user identifier")
class UserResource(Resource):
    @users_ns.marshal_with(user_model_api)
    def get(self, user_id):
        """Get a single user"""
        users = user_model.read(user_id)
        if not users:
            return {"message": "User not found"}, 404
        return users[0], 200

    @users_ns.expect(user_input_model, validate=True)
    @users_ns.marshal_with(user_model_api)
    def put(self, user_id):
        """Update a user"""
        users = user_model.read(user_id)
        if not users:
            return {"message": "User not found"}, 404

        data = request.json
        user = User(user_id=user_id, **data)
        user_model.write(user)
        return user, 200

    def delete(self, user_id):
        """Delete a user"""
        result = user_model.collection.delete_one({"user_id": user_id})
        if result.deleted_count == 0:
            return {"message": "User not found"}, 404
        return "", 204
