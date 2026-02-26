import logging
import sys
import os

# --- Configuration Dictionary ---
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "%(levelname)-8s %(asctime)s [%(name)s:%(lineno)d] - %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "simple": {"format": "%(levelname)-8s - %(message)s"},
    },
    "handlers": {
        "console": {
            "level": "INFO",
            "class": "logging.StreamHandler",
            "formatter": "verbose",
            "stream": "ext://sys.stdout",
        },
        "file": {
            "level": "INFO",
            "class": "logging.handlers.RotatingFileHandler",
            "formatter": "verbose",
            "filename": os.path.join("logs", "app.log"),
            "maxBytes": 1024 * 1024 * 5,  # 5 MB
            "backupCount": 10,
            "encoding": "utf-8",
        },
        "error_file": {
            "level": "ERROR",
            "class": "logging.handlers.RotatingFileHandler",
            "formatter": "verbose",
            "filename": os.path.join("logs", "error.log"),
            "maxBytes": 1024 * 1024 * 5,  # 5 MB
            "backupCount": 10,
            "encoding": "utf-8",
        },
    },
    "loggers": {
        # root logger
        "": {
            "handlers": ["console", "file", "error_file"],
            "level": "INFO",
        },
        # Uvicorn's access logger
        "uvicorn.access": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,  # Don't pass these logs to the root logger
        },
        # Uvicorn's error logger
        "uvicorn.error": {
            "handlers": ["console", "file", "error_file"],
            "level": "INFO",
            "propagate": False,
        },
    },
}


# --- Class to capture stdout/stderr ---
class StreamToLogger:
    """
    A class to redirect stdout and stderr to a logger.
    """

    def __init__(self, logger, level):
        self.logger = logger
        self.level = level
        self.linebuf = ""

    def write(self, buf):
        for line in buf.rstrip().splitlines():
            self.logger.log(self.level, line.rstrip())

    def flush(self):
        pass


def setup_logging():
    """Applies the logging configuration and redirects stdout/stderr."""
    os.makedirs("logs", exist_ok=True)

    from logging.config import dictConfig

    dictConfig(LOGGING_CONFIG)

    # Redirect stdout and stderr to the logging system
    stdout_logger = logging.getLogger("stdout")
    sys.stdout = StreamToLogger(stdout_logger, logging.INFO)

    stderr_logger = logging.getLogger("stderr")
    sys.stderr = StreamToLogger(stderr_logger, logging.ERROR)
