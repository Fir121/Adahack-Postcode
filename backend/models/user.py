import re

from attrs import define

from backend.models.base import BaseModel, PostCode
from backend.utils import get_collection


@define
class User:
    name: str
    email: str
    postcode: PostCode
    user_id: str = None

    def __attrs_post_init__(self):
        if not self.user_id:
            self.user_id = self.email


UserModel = BaseModel(User, get_collection("users"), id_fields=["user_id"])
