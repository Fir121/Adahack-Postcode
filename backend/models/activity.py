import datetime

import attrs
from attrs import define

from backend.models.base import BaseModel, PostCode
from backend.utils import get_mongo_db


@define
class Activity:
    task_id: str
    user_id: str
    date: datetime.date = attrs.field(converter=lambda d: datetime.date.fromisoformat(d) if isinstance(d, str) else d)
    postcode: PostCode
    points: int = 1


activity_model = BaseModel(Activity, get_mongo_db()["activities"], id_fields=["task_id", "user_id"])
