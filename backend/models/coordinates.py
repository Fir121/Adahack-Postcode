from attrs import define

from backend.models.base import BaseModel
from backend.utils import get_collection


@define
class Coordinates:
    postcode: str
    latitude: float
    longitude: float


CoordinatesModel = BaseModel(Coordinates, get_collection("coordinates"), id_fields=["postcode"])
