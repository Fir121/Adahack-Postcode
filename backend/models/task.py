from attrs import define

from backend.models.base import BaseModel
from backend.utils import get_collection


@define
class Task:
    task_id: str
    name: str
    description: str
    points: int = 1


TaskModel = BaseModel(Task, get_collection("tasks"), id_fields=["task_id"])
