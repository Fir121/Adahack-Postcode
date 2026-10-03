"""Activity API regression tests using in-memory collections, never the live DB.

Run: python -m unittest discover -s backend/tests -v
Requires Flask, flask-restx, attrs and pymongo.
"""

from copy import deepcopy
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from flask import Flask
from flask_restx import Api


class MemoryCollection:
    def __init__(self):
        self.documents = []

    def find(self, filters, projection):
        return [
            deepcopy(document)
            for document in self.documents
            if all(document.get(key) == value for key, value in filters.items())
        ]

    def update_one(self, key, update, upsert):
        for document in self.documents:
            if all(document.get(field) == value for field, value in key.items()):
                document.update(deepcopy(update["$set"]))
                return SimpleNamespace(upserted_id=None)
        self.documents.append(deepcopy(update["$set"]))
        return SimpleNamespace(upserted_id="memory-id")


class ActivityPointsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.collections = {
            name: MemoryCollection() for name in ["activities", "tasks", "users"]
        }
        with patch("backend.utils.get_collection", side_effect=cls.collections.__getitem__):
            # Load only this namespace; the API package eagerly imports unrelated
            # environmental services that make external requests at import time.
            spec = importlib.util.spec_from_file_location(
                "activity_api_under_test",
                Path(__file__).resolve().parents[1] / "api" / "activities_ns.py",
            )
            namespace = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(namespace)
        app = Flask(__name__)
        app.config["TESTING"] = True
        api = Api(app)
        api.add_namespace(namespace.activities_ns, path="/api/v1/activities")
        cls.client = app.test_client()
        cls.path = "/api/v1/activities/2026-10-03/me/walk"

    def setUp(self):
        for collection in self.collections.values():
            collection.documents.clear()
        self.collections["users"].documents.append({
            "user_id": "me", "name": "Neighbour", "email": "me@example.test",
            "postcode": "EH9 1AB",
        })
        self.collections["tasks"].documents.append({
            "task_id": "walk", "name": "Walk", "description": "Walk one journey",
            "points": 1,
        })

    def test_bonus_points_are_persisted_returned_and_read_back(self):
        response = self.client.post(self.path, json={"points": 2})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json["points"], 2)
        self.assertEqual(self.collections["activities"].documents[0]["points"], 2)
        history = self.client.get("/api/v1/activities?user_id=me")
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json[0]["points"], 2)

    def test_omitted_points_default_to_the_task_and_zero_is_preserved(self):
        response = self.client.post(self.path, json={})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json["points"], 1)
        self.collections["activities"].documents.clear()
        response = self.client.post(self.path, json={"points": 0})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json["points"], 0)

    def test_updates_preserve_bonus_when_points_are_omitted_and_accept_new_points(self):
        self.client.post(self.path, json={"points": 2})
        response = self.client.put(self.path, json={})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["points"], 2)
        response = self.client.put(self.path, json={"points": 3})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["points"], 3)

    def test_invalid_points_never_create_or_overwrite_an_activity(self):
        for points in [-1, True, 1.5, "2", None]:
            with self.subTest(points=points):
                response = self.client.post(self.path, json={"points": points})
                self.assertEqual(response.status_code, 400)
                self.assertEqual(self.collections["activities"].documents, [])
        self.client.post(self.path, json={"points": 2})
        response = self.client.put(self.path, json={"points": -1})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.collections["activities"].documents[0]["points"], 2)

    def test_malformed_bodies_are_rejected_and_duplicates_do_not_overwrite_awards(self):
        for body in ["[]", "null", "{bad-json}"]:
            response = self.client.post(self.path, data=body, content_type="application/json")
            self.assertEqual(response.status_code, 400)
            self.assertEqual(self.collections["activities"].documents, [])
        self.client.post(self.path, json={"points": 2})
        response = self.client.post(self.path, json={"points": 1})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.collections["activities"].documents[0]["points"], 2)


if __name__ == "__main__":
    unittest.main()
