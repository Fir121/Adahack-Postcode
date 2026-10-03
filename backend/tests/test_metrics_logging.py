import importlib.util
import json
import logging
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

from flask import Flask
from flask_restx import Api
import requests

from backend.logging_setup import configure_logging


def load_module(name, relative):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).resolve().parents[1] / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class LoggingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.file = Path(self.temp.name) / "api.log"
        self.app = Flask(__name__)
        self.app.config["PROPAGATE_EXCEPTIONS"] = False
        with patch.dict("os.environ", {"BACKEND_LOG_FILE": str(self.file)}):
            configure_logging(self.app)
        self.addCleanup(self.close_handlers)

    @staticmethod
    def close_handlers():
        logger = logging.getLogger("backend")
        for handler in list(logger.handlers):
            handler.close()
            logger.removeHandler(handler)

    def logs(self):
        return [json.loads(line) for line in self.file.read_text().splitlines()]

    def test_requests_share_id_and_omit_bodies_queries_and_user_ids(self):
        @self.app.route("/users/<user_id>", methods=["POST"])
        def route(user_id):
            return {"ok": True}
        response = self.app.test_client().post(
            "/users/private@example.test?password=secret",
            json={"password": "secret"}, headers={"X-Request-ID": "proxy-request-123"},
        )
        self.assertEqual(response.headers["X-Request-ID"], "proxy-request-123")
        record = self.logs()[-1]
        self.assertEqual(record["request_id"], "proxy-request-123")
        self.assertEqual(record["route"], "/users/<user_id>")
        self.assertEqual(record["status"], 200)
        self.assertIn("duration_ms", record)
        self.assertNotIn("secret", self.file.read_text())
        self.assertNotIn("private@example.test", self.file.read_text())

    def test_exception_tracebacks_are_correlated_and_redact_credentials(self):
        @self.app.get("/metrics/")
        def route():
            raise RuntimeError("mongodb://user:secret@database.invalid/")
        response = self.app.test_client().get("/metrics/", headers={"X-Request-ID": "proxy-request-456"})
        self.assertEqual(response.status_code, 500)
        errors = [row for row in self.logs() if row["event"] == "request_exception"]
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0]["request_id"], "proxy-request-456")
        self.assertEqual(errors[0]["error_type"], "RuntimeError")
        self.assertIn("Traceback", errors[0]["traceback"])
        self.assertNotIn("user:secret", self.file.read_text())
        self.assertEqual(self.logs()[-1]["status"], 500)

    def test_invalid_request_id_is_replaced(self):
        @self.app.get("/metrics/")
        def route():
            return []
        response = self.app.test_client().get("/metrics/", headers={"X-Request-ID": "x" * 100})
        self.assertEqual(len(response.headers["X-Request-ID"]), 36)


class MetricsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch("backend.utils.get_collection", return_value=MagicMock()):
            cls.module = load_module("metrics_api_under_test", "api/metrics_ns.py")
        app = Flask(__name__)
        app.config["TESTING"] = True
        api = Api(app)
        api.add_namespace(cls.module.metrics_ns, path="/metrics")
        cls.client = app.test_client()

    def test_postcode_list_uses_dictionary_values_and_one_user_query(self):
        collection = MagicMock()
        collection.aggregate.return_value = [
            {"postcode": "EH9 1AB", "total_points": 1},
            {"postcode": "EH9 1AD", "total_points": 2},
        ]
        with patch.object(self.module, "get_collection", return_value=collection), \
             patch.object(self.module.UserModel, "list", return_value=[
                 SimpleNamespace(postcode="EH9 1AB"), SimpleNamespace(postcode="EH9 1AB"),
                 SimpleNamespace(postcode="EH9 1AD"),
             ]) as users:
            response = self.client.get("/metrics/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["postcode"] for row in response.json], ["EH9 1AB", "EH9 1AD"])
        self.assertGreater(response.json[0]["score"], 0)
        self.assertIsInstance(response.json[0]["score"], float)
        users.assert_called_once_with()

    def test_missing_carbon_data_does_not_break_score_or_rankings(self):
        collection = MagicMock()
        collection.aggregate.return_value = [{"user_id": "me", "name": "Neighbour", "points": 2}]
        with patch.object(self.module, "get_mongo_db", return_value={"activities": collection}), \
             patch.object(self.module, "get_carbon_intensity", return_value=None), \
             patch.object(self.module, "get_air_quality", return_value=None):
            response = self.client.get("/metrics/EH9%201AB")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json["carbon_intensity"])
        self.assertIsNone(response.json["air_quality"])
        self.assertEqual(response.json["users"][0]["points"], 2)

    def test_service_import_performs_no_external_calls_and_timeouts_are_logged(self):
        with patch("requests.get") as get:
            service = load_module("metrics_service_under_test", "services/metrics.py")
        get.assert_not_called()
        with patch("requests.get", side_effect=requests.Timeout("slow")), \
             self.assertLogs("metrics_service_under_test", level="WARNING") as captured:
            self.assertIsNone(service.get_carbon_intensity("EH9 1AB"))
        self.assertEqual(captured.records[0].provider, "carbon_intensity")
        self.assertEqual(captured.records[0].error_type, "Timeout")
        with patch.object(service, "postcode_to_coordinates", side_effect=requests.Timeout("slow")), \
             self.assertLogs("metrics_service_under_test", level="WARNING") as captured:
            self.assertIsNone(service.get_air_quality("EH9 1AB"))
        self.assertEqual(captured.records[0].provider, "postcode_lookup")

    def test_application_startup_does_not_call_environmental_apis(self):
        with tempfile.TemporaryDirectory() as directory, \
             patch.dict("os.environ", {"BACKEND_LOG_FILE": str(Path(directory) / "api.log")}), \
             patch("backend.utils.get_collection", return_value=MagicMock()), \
             patch("requests.get") as get, patch("requests.post") as post:
            from backend.api import create_app
            app = create_app()
            get.assert_not_called()
            post.assert_not_called()
            response = app.test_client().get("/api/v1/swagger.json")
            self.assertEqual(response.status_code, 200)
            self.assertIn("/metrics/", response.json["paths"])
            LoggingTests.close_handlers()


if __name__ == "__main__":
    unittest.main()
