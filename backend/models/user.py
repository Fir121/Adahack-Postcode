import re

from attrs import define

from backend.models.base import BaseModel, PostCode
from backend.utils import get_mongo_db

@define
class User:
    name: str
    email: str
    postcode: PostCode
    user_id: str = None

    def __attrs_post_init__(self):
        if not self.user_id:
            self.user_id = self.email


user_model = BaseModel(User, get_mongo_db()["users"], id_fields=["user_id"])
