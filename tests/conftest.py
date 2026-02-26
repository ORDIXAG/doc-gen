import pytest
from sqlmodel import SQLModel, Session
from src.main import app

from src.util.auth import _parse_jwt, get_jwt_owner_from_request
from src.dependencies.database import engine, get_db
from fastapi.testclient import TestClient
from fastapi import HTTPException, Request


def override_get_jwt_owner_from_request(request: Request) -> str:
    """A mock dependency that bypasses all validation and returns the test user."""
    authorization_header = request.headers.get("Authorization", "")
    if not authorization_header or not authorization_header.lower().startswith(
        "bearer "
    ):
        raise HTTPException(
            status_code=401,
            detail="Missing or malformed Authorization header. Expected 'Bearer <token>'",  # noqa: E501
        )

    token = authorization_header.split(" ")[1]
    return _parse_jwt(token)["sub"]


@pytest.fixture(scope="function", name="session")
def session_fixture() -> Session:
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(scope="function", name="client")
def client_fixture(session: Session) -> TestClient:
    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_jwt_owner_from_request] = (
        override_get_jwt_owner_from_request
    )

    with TestClient(app) as c:
        yield c

    app.dependency_overrides = {}
