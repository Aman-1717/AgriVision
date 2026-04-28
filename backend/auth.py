# backend/auth.py
import os
import re
import ssl
import httpx
from fastapi import Request
from typing import Any, Optional

import jwt
from jwt import PyJWKClient

from .weather_api import _httpx_verify

# Clerk configuration
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "").strip()
# Optional; must match JWT `iss` if set. If unset, we use the `iss` claim from the token.
CLERK_FRONTEND_API = os.getenv("CLERK_FRONTEND_API", "").rstrip("/")

# Comma-separated list; Clerk session tokens may include an `azp` that must match the web origin
_DEFAULT_AZP = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"

# Clock skew (seconds) for exp / nbf
_JWT_LEEWAY = 120


def _ssl_context_for_jwks() -> ssl.SSLContext:
    """
    TLS for PyJWKClient (urllib). macOS / python.org Python often fails default verify
    for Clerk JWKS; use truststore (OS CAs) or certifi like backend/weather_api._httpx_verify.
    For local debugging only, set HTTPX_VERIFY_SSL=false (same as weather; insecure).
    """
    flag = (os.getenv("HTTPX_VERIFY_SSL") or "true").strip().lower()
    if flag in ("0", "false", "no"):
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    for env in ("SSL_CERT_FILE", "REQUESTS_CA_BUNDLE"):
        path = os.getenv(env)
        if path and os.path.isfile(path):
            ctx = ssl.create_default_context()
            ctx.load_verify_locations(path)
            return ctx
    try:
        import truststore

        return truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    except ImportError:
        pass
    import certifi

    return ssl.create_default_context(cafile=certifi.where())


def _minimal_clerk_user(user_id: str) -> dict[str, Any]:
    """When JWT is valid but Clerk REST fetch failed or is skipped — enough for id-based auth + rate limit."""
    return {
        "id": user_id,
        "first_name": "",
        "last_name": "",
        "email_addresses": [],
    }


def _is_likely_jwt(token: str) -> bool:
    return token.count(".") == 2


def _iss_from_token_unverified(token: str) -> Optional[str]:
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        iss = unverified.get("iss")
        return str(iss).rstrip("/") if isinstance(iss, str) and iss else None
    except Exception:
        return None


def _allowed_azp() -> set[str]:
    raw = os.getenv("CLERK_ALLOWED_ORIGINS", _DEFAULT_AZP)
    return {x.strip() for x in raw.split(",") if x.strip()}


def _azp_ok(payload: dict) -> bool:
    if os.getenv("CLERK_STRICT_AZP", "0") != "1":
        return True
    azp = payload.get("azp")
    if not azp:
        return True
    return str(azp) in _allowed_azp()


def _decode_session_jwt(token: str, jwks_client: PyJWKClient, iss_expected: str) -> Optional[dict]:
    """
    iss_expected must match the `iss` claim inside the JWT (usually your *.clerk.accounts.dev URL).
    """
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=iss_expected.rstrip("/"),
            leeway=_JWT_LEEWAY,
            options={"verify_aud": False},
        )
        if not _azp_ok(payload):
            print(f"Clerk: set CLERK_ALLOWED_ORIGINS to include azp={payload.get('azp')!r}")
            return None
        return dict(payload) if isinstance(payload, dict) else None
    except Exception as e:
        print(f"Clerk JWT decode: {e}")
        return None


def _verify_clerk_jwt_user_id(token: str) -> Optional[str]:
    """
    Session JWT verification (per Clerk manual verification docs):
    1) Backend JWKS at https://api.clerk.com/v1/jwks (requires CLERK_SECRET_KEY)
    2) Instance JWKS at {iss}/.well-known/jwks.json for iss from token, then any CLERK_FRONTEND_API miss
    """
    iss_in_token = _iss_from_token_unverified(token)
    if not iss_in_token:
        return None

    # 1) Official Clerk API JWKS (see clerk.com/docs — validate session tokens)
    if CLERK_SECRET_KEY:
        p = _decode_session_jwt(
            token,
            PyJWKClient(
                "https://api.clerk.com/v1/jwks",
                timeout=20,
                headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"},
                ssl_context=_ssl_context_for_jwks(),
            ),
            iss_in_token,
        )
        if p and p.get("sub"):
            return str(p["sub"])

    # 2) Instance /.well-known JWKS (no secret needed for this URL)
    tried: set[str] = set()
    for iss in (iss_in_token, CLERK_FRONTEND_API) if CLERK_FRONTEND_API else (iss_in_token,):
        if not iss or iss in tried:
            continue
        tried.add(iss)
        p = _decode_session_jwt(
            token,
            PyJWKClient(
                f"{iss.rstrip('/')}/.well-known/jwks.json",
                timeout=20,
                ssl_context=_ssl_context_for_jwks(),
            ),
            iss_in_token,
        )
        if p and p.get("sub"):
            return str(p["sub"])
    return None


def _parse_bearer_header(value: str) -> str:
    raw = (value or "").strip()
    m = re.match(r"(?i)^Bearer\s+(.+)$", raw)
    return m.group(1).strip() if m else raw


async def _fetch_clerk_user(user_id: str) -> Optional[dict]:
    if not CLERK_SECRET_KEY:
        return None
    async with httpx.AsyncClient(verify=_httpx_verify()) as client:
        user_response = await client.get(
            f"https://api.clerk.com/v1/users/{user_id}",
            headers={
                "Authorization": f"Bearer {CLERK_SECRET_KEY}",
                "Content-Type": "application/json",
            },
        )
        if user_response.status_code == 200:
            return user_response.json()
    return None


async def verify_clerk_session(request: Request) -> Optional[dict]:
    """
    Verify Clerk session: Authorization Bearer (JWT) or `__session` cookie.
    If the JWT is valid, return user dict — prefer full profile from Clerk API, else minimal {id: sub}
    """
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    bearer = _parse_bearer_header(auth_header) if auth_header else ""
    session_token = (request.cookies.get("__session") or bearer).strip()

    if not session_token:
        return None

    if _is_likely_jwt(session_token):
        user_id = _verify_clerk_jwt_user_id(session_token)
        if not user_id:
            return None
        if CLERK_SECRET_KEY:
            user = await _fetch_clerk_user(user_id)
            if user:
                return user
        return _minimal_clerk_user(user_id)

    if not CLERK_SECRET_KEY:
        return None
    try:
        async with httpx.AsyncClient(verify=_httpx_verify()) as client:
            response = await client.get(
                f"https://api.clerk.com/v1/sessions/{session_token}/verify",
                headers={
                    "Authorization": f"Bearer {CLERK_SECRET_KEY}",
                    "Content-Type": "application/json",
                },
            )
            if response.status_code == 200:
                session_data = response.json()
                user_id = session_data.get("user_id")
                if user_id:
                    u = await _fetch_clerk_user(user_id)
                    if u:
                        return u
                    return _minimal_clerk_user(user_id)
    except Exception as e:
        print(f"Clerk session verify error: {e}")

    return None
