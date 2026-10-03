import json
import re
from typing import Union, Collection

from attr import asdict


class PostCode(str):
    _postcode_pat = re.compile(r"^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$")

    def __new__(cls, value: str):
        value = value.strip().upper()
        if not cls._postcode_pat.match(value):
            raise ValueError(f"Invalid postcode: {value!r}")
        return super().__new__(cls, value)


class BaseModel:
    def __init__(self, model_cls, collection: Collection, id_fields: list[str]):
        self.model_cls = model_cls
        self.collection = collection
        self.id_fields = id_fields

    def _build_key(self, data):
        """Build a composite key from the specified id_fields."""
        return {field: data[field] for field in self.id_fields}

    def list(self, filters=None):
        filters = filters or {}
        documents = self.collection.find(filters, {"_id": 0})
        return [self.model_cls(**doc) for doc in documents]

    def write(self, obj):
        if not isinstance(obj, self.model_cls):
            raise TypeError(f"Expected instance of {self.model_cls.__name__}")

        data = asdict(obj)
        data = json.loads(json.dumps(data, default=str))
        key = self._build_key(data)
        result = self.collection.update_one(key, {"$set": data}, upsert=True)
        return result.upserted_id or key

    def read(self, key_data: Union[dict, str]):
        if isinstance(key_data, str):
            if len(self.id_fields) != 1:
                raise ValueError("Single ID field expected, but multiple id_fields are defined.")
            key = {self.id_fields[0]: key_data}
        elif isinstance(key_data, dict):
            key = self._build_key(key_data)
        else:
            raise TypeError("key_data must be a dict or str")

        documents = self.collection.find(key, {"_id": 0})
        return [self.model_cls(**doc) for doc in documents]
