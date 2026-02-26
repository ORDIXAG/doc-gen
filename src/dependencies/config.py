from pydantic_settings import BaseSettings
import yaml
import os
import logging


class Environment(BaseSettings):
    DATABASE_URL: str = "sqlite:///db/database.db"
    DATABASE_CONNECT_DICT: dict = {"check_same_thread": False}
    EXECUTION_OPTIONS: dict = {"foreign_keys": "ON"}


class Config:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(Config, cls).__new__(cls, *args, **kwargs)
            cls._instance.__init__(*args, **kwargs)
        return cls._instance

    def __init__(self):
        with open("config/config.yaml", "r") as file:
            config = yaml.safe_load(file)

        self.logger = logging.getLogger(__name__)

        self.api_key = os.environ.get("OPENAI_API_KEY")
        self.github_token = os.environ.get("GITHUB_TOKEN")
        self.environment = os.environ.get("ENVIRONMENT", "dev")

        self.available_models = config["model_specifics"]["models"]
        self.use_model_index = config["model_specifics"]["use_model_index"]
        self.supported_types = config["files"]["supported_types"]

        self.muster_directory: str = "muster"

        if not self.api_key:
            self.logger.error("API key not found as variables/secrets.")
            raise Exception("API key not found as variables/secrets.")
        if not self.github_token:
            self.logger.warning("Github token not found as variables/secrets.")
            self.github_token = None


environment = Environment()
