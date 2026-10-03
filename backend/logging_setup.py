"""Structured, correlated request and dependency logs with bounded local files."""

import datetime
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import re
import sys
import time
import uuid

from flask import g, got_request_exception, has_request_context, request


def redact(text):
    return re.sub(r"([a-zA-Z][a-zA-Z0-9+.-]*://)[^/\s@]+@", r"\1[redacted]@", text)


class JsonFormatter(logging.Formatter):
    def format(self, record):
        data = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "service": "backend",
            "event": "request_exception" if record.exc_info else record.getMessage(),
        }
        if has_request_context():
            data.update(
                request_id=getattr(g, "request_id", None),
                method=request.method,
                route=request.url_rule.rule if request.url_rule else "unmatched",
            )
        for field in ["duration_ms", "status", "provider", "upstream_status", "error_type", "count", "timeout_seconds"]:
            if hasattr(record, field):
                data[field] = getattr(record, field)
        if record.exc_info:
            data["error_type"] = record.exc_info[0].__name__
            data["traceback"] = self.formatException(record.exc_info)
        return redact(json.dumps(data, default=str))


def configure_logging(app):
    logger = logging.getLogger("backend")
    level = getattr(logging, os.getenv("BACKEND_LOG_LEVEL", "INFO").upper(), logging.INFO)
    logger.setLevel(level)
    logger.propagate = False
    for handler in list(logger.handlers):
        logger.removeHandler(handler)
        handler.close()
    formatter = JsonFormatter()
    stream = logging.StreamHandler(sys.stderr)
    stream.setFormatter(formatter)
    logger.addHandler(stream)
    try:
        path = Path(os.getenv("BACKEND_LOG_FILE", str(Path(__file__).parent / "logs" / "api.log")))
        path.parent.mkdir(parents=True, exist_ok=True)
        file = RotatingFileHandler(path, maxBytes=5 * 1024 * 1024, backupCount=2, encoding="utf8")
        file.setFormatter(formatter)
        logger.addHandler(file)
    except OSError as error:
        logger.warning("log_file_unavailable", extra={"error_type": type(error).__name__})
    # Flask/Flask-RESTX's own exception logs retain their tracebacks and request ID.
    app.logger.handlers = list(logger.handlers)
    app.logger.setLevel(level)
    app.logger.propagate = False

    def request_exception(sender, exception, **extra):
        logger.error("request_exception", exc_info=(type(exception), exception, exception.__traceback__))

    # This also runs in debug mode, where Flask otherwise propagates exceptions.
    got_request_exception.connect(request_exception, app, weak=False)

    @app.before_request
    def start_request():
        supplied = request.headers.get("X-Request-ID", "")
        g.request_id = supplied if re.fullmatch(r"[A-Za-z0-9_-]{1,64}", supplied) else str(uuid.uuid4())
        g.request_started = time.monotonic()
        logger.info("request_started")

    @app.after_request
    def finish_request(response):
        response.headers["X-Request-ID"] = g.request_id
        level = logging.ERROR if response.status_code >= 500 else logging.WARNING if response.status_code >= 400 else logging.INFO
        logger.log(level, "request_completed", extra={
            "status": response.status_code,
            "duration_ms": round((time.monotonic() - g.request_started) * 1000),
        })
        return response
