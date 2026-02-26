import base64
import json
from fastapi import HTTPException, Request
import urllib.parse

from src.dependencies.config import Config

config = Config()


def create_dummy_jwt_token(payload: dict) -> str:
    """
    Creates a dummy JWT-like token whose payload is structured to be correctly
    parsed by the provided parse_jwt function.

    Args:
        payload (dict):
            The payload to be included in the token.
            Example:
            {
                'sub': '<kuerzel>',
                'iat': 1760601709,
                'exp': 1760637709,
                'iss': '<provider>'
            }
    """
    json_payload = json.dumps(payload)
    url_encoded_payload = urllib.parse.quote(json_payload)
    payload_bytes = url_encoded_payload.encode("utf-8")
    base64url_payload = (
        base64.urlsafe_b64encode(payload_bytes).rstrip(b"=").decode("utf-8")
    )
    header = {"alg": "none", "typ": "JWT"}
    json_header = json.dumps(header)
    base64url_header = (
        base64.urlsafe_b64encode(json_header.encode("utf-8"))
        .rstrip(b"=")
        .decode("utf-8")
    )
    signature = "dummySignature"
    return f"{base64url_header}.{base64url_payload}.{signature}"


def _parse_jwt(token: str) -> dict:
    """
    Parses a JWT token and returns the payload as a dictionary.
    WARNING: Only use this for FakeAuth tokens as it doesn't validate the signature.
    """
    base64_url = token.split(".")[1]
    # padding is always 4 for base64 but may be omitted in token
    missing_padding = len(base64_url) % 4
    if missing_padding:
        base64_url += "=" * (4 - missing_padding)
    base64_str = base64_url.replace("-", "+").replace("_", "/")
    decoded_bytes = base64.b64decode(base64_str)
    decoded_str = decoded_bytes.decode("utf-8")
    json_payload = urllib.parse.unquote(decoded_str)
    return json.loads(json_payload)


def get_jwt_owner_from_request(request: Request) -> str:  # noqa: C901
    """
    Parses and VALIDATES the JWT from the Authorization header,
    returning the 'sub' claim. This should be used as a FastAPI dependency.
    """
    authorization_header = request.headers.get("Authorization", "")
    if not authorization_header or not authorization_header.lower().startswith(
        "bearer "
    ):
        raise HTTPException(
            status_code=401,
            detail="Missing or malformed Authorization header. Expected 'Bearer <token>'",  # noqa: E501
        )

    token = authorization_header.split(" ")[1]

    try:
        request_owner = _parse_jwt(token)["sub"]
        if not request_owner:
            raise HTTPException(status_code=401, detail="Invalid FakeAuth token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid FakeAuth token")
    return request_owner
