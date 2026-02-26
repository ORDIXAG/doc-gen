from fastapi import APIRouter
from src.dependencies.config import Config
from typing import List


router = APIRouter()
config = Config()


# Model
@router.get("/model", response_model=List[dict])
def get_models():
    return [
        {"name": model["name"], "hint": model["hint"]}
        for model in config.available_models
    ]
