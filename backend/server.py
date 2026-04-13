from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import re
import logging
import httpx
import feedparser
import uuid
import stripe
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=True)

# ============== CONFIG ==============

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_ANON_KEY = os.environ['SUPABASE_ANON_KEY']
SUPABASE_SERVICE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', '')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
STRIPE_PRICES = {'monthly': None, 'yearly': None}

FREE_ARTICLES_LIMIT = 5

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== SUPABASE DB CLIENT ==============

class DB:
    """Lightweight async Supabase REST client via httpx"""

    @staticmethod
    def _svc_headers(extra: dict = None) -> dict:
        h = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        if extra:
            h.update(extra)
        return h

    @classmethod
    async def select(cls, table: str, filters: dict = None, select: str = "*",
                     order: str = None, limit: int = None, offset: int = None) -> list:
        params = f"select={select}"
        if filters:
            for k, v in filters.items():
                params += f"&{k}={v}"
        if order:
            params += f"&order={order}"
        if limit is not None:
            params += f"&limit={limit}"
        if offset is not None:
            params += f"&offset={offset}"
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(f"{SUPABASE_URL}/rest/v1/{table}?{params}", headers=cls._svc_headers())
            if r.status_code >= 400:
                logger.error(f"DB select error [{table}]: {r.text}")
                return []
            return r.json()

    @classmethod
    async def insert(cls, table: str, data: dict) -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=cls._svc_headers(), json=data)
            if r.status_code >= 400:
                logger.error(f"DB insert error [{table}]: {r.text}")
                raise HTTPException(500, f"Database error: {r.text}")
            result = r.json()
            return result[0] if isinstance(result, list) and result else result

    @classmethod
    async def update(cls, table: str, filters: dict, data: dict) -> list:
        params = "&".join(f"{k}={v}" for k, v in filters.items())
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.patch(f"{SUPABASE_URL}/rest/v1/{table}?{params}", headers=cls._svc_headers(), json=data)
            if r.status_code >= 400:
                logger.error(f"DB update error [{table}]: {r.text}")
                raise HTTPException(500, f"Database error: {r.text}")
            return r.json()

    @classmethod
    async def upsert(cls, table: str, data: dict) -> dict:
        extra = {"Prefer": "return=representation,resolution=merge-duplicates"}
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=cls._svc_headers(extra), json=data)
            if r.status_code >= 400:
                logger.error(f"DB upsert error [{table}]: {r.text}")
                raise HTTPException(500, f"Database error: {r.text}")
            result = r.json()
            return result[0] if isinstance(result, list) and result else result

    @classmethod
    async def delete(cls, table: str, filters: dict) -> bool:
        params = "&".join(f"{k}={v}" for k, v in filters.items())
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.delete(f"{SUPABASE_URL}/rest/v1/{table}?{params}", headers=cls._svc_headers())
            return r.status_code < 400

    @classmethod
    async def count(cls, table: str, filters: dict = None) -> int:
        params = "select=id"
        if filters:
            for k, v in filters.items():
                params += f"&{k}={v}"
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(
                f"{SUPABASE_URL}/rest/v1/{table}?{params}",
                headers=cls._svc_headers({"Prefer": "count=exact"})
            )
            cr = r.headers.get("content-range", "*/0")
            try:
                return int(cr.split("/")[-1])
            except Exception:
                return len(r.json()) if r.status_code < 400 else 0


# ============== SUPABASE AUTH CLIENT ==============

class Auth:
    """Supabase Auth API client"""

    @staticmethod
    async def signup(email: str, password: str, metadata: dict = None):
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                f"{SUPABASE_URL}/auth/v1/signup",
                headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
                json={"email": email, "password": password, "data": metadata or {}}
            )
            return r.json(), r.status_code

    @staticmethod
    async def signin(email: str, password: str):
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
                json={"email": email, "password": password}
            )
            return r.json(), r.status_code

    @staticmethod
    async def get_user(token: str):
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"}
            )
            return r.json(), r.status_code

    @staticmethod
    async def signout(token: str):
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(
                f"{SUPABASE_URL}/auth/v1/logout",
                headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"}
            )
            return r.status_code

    @staticmethod
    async def recover(email: str):
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(
                f"{SUPABASE_URL}/auth/v1/recover",
                headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
                json={"email": email}
            )
            return r.json(), r.status_code

    @staticmethod
    async def admin_create_user(email: str, password: str, metadata: dict = None):
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json"
                },
                json={"email": email, "password": password, "email_confirm": True, "user_metadata": metadata or {}}
            )
            return r.json(), r.status_code

    @staticmethod
    async def admin_update_user(user_id: str, data: dict):
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.put(
                f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json"
                },
                json=data
            )
            return r.json(), r.status_code

    @staticmethod
    async def admin_delete_user(user_id: str):
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.delete(
                f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"
                }
            )
            return r.status_code


# ============== MODELS ==============

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    subscription_status: Optional[str] = None
    subscription_end_date: Optional[datetime] = None

class UserFeedPreferences(BaseModel):
    enabled_feeds: List[str]
    favorite_feed: Optional[str] = None

class RssFeedCreate(BaseModel):
    name: str
    url: str
    category: Optional[str] = "general"

class SubscriptionCreate(BaseModel):
    plan_type: str
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None

class AdminUserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    subscription_plan: str = "monthly"

class PushTokenRegister(BaseModel):
    push_token: str

class GoogleAuthRequest(BaseModel):
    id_token: str
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# ============== APP ==============

app = FastAPI(title="OKNews24 API - Supabase Edition")
api_router = APIRouter(prefix="/api")


# ============== EMAIL HELPER ==============

async def send_reset_email(email: str, token: str) -> bool:
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set - cannot send email")
        return False
    async with httpx.AsyncClient(timeout=15) as c:
        try:
            r = await c.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                json={
                    "from": "OKNews24 <no-reply@oknews24.it>",
                    "to": email,
                    "subject": "Reimpostazione Password - OKNews24",
                    "html": f"""
                    <div style="font-family:sans-serif;padding:20px;max-width:400px">
                      <h2 style="color:#1e40af">OKNews24</h2>
                      <p>Il tuo codice di reset password è:</p>
                      <h1 style="letter-spacing:8px;color:#3B82F6;font-size:36px">{token}</h1>
                      <p style="color:#6b7280">Valido per 1 ora. Inseriscilo nell'app per procedere.</p>
                    </div>"""
                }
            )
            if r.status_code in [200, 201]:
                logger.info(f"Reset email sent via Resend to {email}")
                return True
            logger.error(f"Resend error: {r.text}")
            return False
        except Exception as e:
            logger.error(f"Email send failed: {e}")
            return False


# ============== AUTH HELPERS ==============

async def get_current_user(request: Request) -> Optional[dict]:
    """Validate Supabase JWT and return profile from DB"""
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    if not token:
        token = request.cookies.get("session_token")
    if not token:
        return None

    # Validate token with Supabase Auth
    user_data, status = await Auth.get_user(token)
    if status != 200:
        return None

    user_id = user_data.get("id")
    if not user_id:
        return None

    # Get profile from DB
    profiles = await DB.select("profiles", {"id": f"eq.{user_id}"})
    if not profiles:
        return None

    p = profiles[0]
    p["user_id"] = p["id"]  # alias for frontend compatibility
    p["session_token"] = token
    return p


async def require_auth(request: Request) -> dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def require_admin(request: Request) -> dict:
    user = await require_auth(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _format_user(profile: dict, token: str = None) -> dict:
    """Normalize profile fields for frontend"""
    out = dict(profile)
    out["user_id"] = profile.get("id") or profile.get("user_id", "")
    if token:
        out["session_token"] = token
    # Remove raw UUID id to avoid confusion
    return out


# ============== AUTH ENDPOINTS ==============

@api_router.post("/auth/register")
async def register(user_data: UserCreate, response: Response):
    # Use admin API so user is auto-confirmed (no email verification needed)
    auth_result, status = await Auth.admin_create_user(
        user_data.email,
        user_data.password,
        {"name": user_data.name}
    )
    if status >= 400:
        msg = auth_result.get("msg") or auth_result.get("message") or "Registration failed"
        if "already" in str(msg).lower() or "exists" in str(msg).lower():
            raise HTTPException(400, "Email già registrata")
        raise HTTPException(400, msg)

    user_id = auth_result.get("id")
    if not user_id:
        raise HTTPException(500, "Failed to create user")

    # Ensure profile exists (trigger should create it, but be safe)
    profiles = await DB.select("profiles", {"id": f"eq.{user_id}"})
    if not profiles:
        await DB.upsert("profiles", {
            "id": user_id,
            "email": user_data.email,
            "name": user_data.name,
        })
        profiles = await DB.select("profiles", {"id": f"eq.{user_id}"})

    # Sign in to get token
    signin_result, signin_status = await Auth.signin(user_data.email, user_data.password)
    token = signin_result.get("access_token", "")

    profile = profiles[0] if profiles else {"id": user_id, "email": user_data.email, "name": user_data.name}
    return _format_user(profile, token)


@api_router.post("/auth/login")
async def login(user_data: UserLogin, response: Response):
    auth_result, status = await Auth.signin(user_data.email, user_data.password)
    if status >= 400:
        raise HTTPException(401, "Credenziali non valide")

    token = auth_result.get("access_token")
    user_id = auth_result.get("user", {}).get("id")
    if not token or not user_id:
        raise HTTPException(401, "Login failed")

    profiles = await DB.select("profiles", {"id": f"eq.{user_id}"})
    if not profiles:
        # Create profile if missing
        email = auth_result.get("user", {}).get("email", "")
        await DB.upsert("profiles", {"id": user_id, "email": email, "name": email.split("@")[0]})
        profiles = await DB.select("profiles", {"id": f"eq.{user_id}"})

    return _format_user(profiles[0], token)


@api_router.post("/auth/google")
async def google_auth(data: GoogleAuthRequest, response: Response):
    """Accept Google OAuth via Supabase token exchange"""
    # Verify the id_token with Supabase
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=id_token",
            headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            json={"provider": "google", "id_token": data.id_token}
        )
        if r.status_code >= 400:
            # Fallback: find or create user by email using admin API
            profiles = await DB.select("profiles", {"email": f"eq.{data.email.lower()}"})
            if profiles:
                # Update picture
                user_id = profiles[0]["id"]
                if data.picture:
                    await DB.update("profiles", {"id": f"eq.{user_id}"}, {"picture": data.picture})
                    profiles = await DB.select("profiles", {"id": f"eq.{user_id}"})
            else:
                # Create new user
                auth_result, s = await Auth.admin_create_user(
                    data.email.lower(),
                    uuid.uuid4().hex,
                    {"name": data.name or data.email.split("@")[0]}
                )
                if s >= 400:
                    raise HTTPException(400, "Google auth failed")
                user_id = auth_result.get("id")
                await DB.upsert("profiles", {
                    "id": user_id,
                    "email": data.email.lower(),
                    "name": data.name or data.email.split("@")[0],
                    "picture": data.picture
                })
                profiles = await DB.select("profiles", {"id": f"eq.{user_id}"})

            # Generate a token via admin
            signin_r, s2 = await Auth.signin(data.email.lower(), "")
            token = signin_r.get("access_token", "no-token")
            return _format_user(profiles[0] if profiles else {}, token)

        result = r.json()
        token = result.get("access_token", "")
        user_id = result.get("user", {}).get("id")
        profiles = await DB.select("profiles", {"id": f"eq.{user_id}"})
        return _format_user(profiles[0] if profiles else {}, token)


@api_router.post("/auth/session")
async def process_session(request: Request, response: Response):
    """Legacy Emergent Auth session endpoint - redirects to login"""
    raise HTTPException(400, "Use /auth/login or /auth/google")


@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    if token:
        await Auth.signout(token)
    return {"message": "Logged out"}


@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    email = data.email.lower()
    profiles = await DB.select("profiles", {"email": f"eq.{email}"})
    if not profiles:
        return {"message": "Se l'email è registrata, riceverai le istruzioni."}

    user_id = profiles[0]["id"]
    # Generate a short numeric code (6 chars)
    reset_token = str(uuid.uuid4().hex[:6]).upper()
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

    # Store reset token
    await DB.upsert("password_resets", {
        "user_id": user_id,
        "token": reset_token,
        "expires_at": expires_at,
        "used": False
    })

    await send_reset_email(email, reset_token)
    return {"message": "Se l'email è registrata, riceverai le istruzioni."}


@api_router.post("/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    now = datetime.now(timezone.utc).isoformat()
    resets = await DB.select(
        "password_resets",
        {"token": f"eq.{data.token}", "used": "eq.false", "expires_at": f"gt.{now}"}
    )
    if not resets:
        raise HTTPException(400, "Token non valido o scaduto")

    reset_doc = resets[0]
    user_id = reset_doc["user_id"]

    # Update password via Supabase admin API
    _, status = await Auth.admin_update_user(user_id, {"password": data.new_password})
    if status >= 400:
        raise HTTPException(500, "Impossibile aggiornare la password")

    # Mark token as used
    await DB.update("password_resets", {"token": f"eq.{data.token}"}, {"used": True})
    return {"message": "Password aggiornata con successo."}


# ============== USER FEED PREFERENCES ==============

@api_router.get("/user/feed-preferences")
async def get_feed_preferences(request: Request):
    user = await require_auth(request)
    all_feeds = await DB.select("feeds", {"active": "eq.true"}, order="name.asc")
    user_doc = await DB.select("profiles", {"id": f"eq.{user['id']}"})
    profile = user_doc[0] if user_doc else {}

    enabled_feeds = profile.get("enabled_feeds") or []
    favorite_feed = profile.get("favorite_feed")

    if not enabled_feeds:
        enabled_feeds = [f["feed_id"] for f in all_feeds]

    return {"all_feeds": all_feeds, "enabled_feeds": enabled_feeds, "favorite_feed": favorite_feed}


@api_router.put("/user/feed-preferences")
async def update_feed_preferences(prefs: UserFeedPreferences, request: Request):
    user = await require_auth(request)
    all_feeds = await DB.select("feeds", {"active": "eq.true"})
    valid_ids = {f["feed_id"] for f in all_feeds}

    enabled_feeds = [fid for fid in prefs.enabled_feeds if fid in valid_ids]
    favorite_feed = prefs.favorite_feed if prefs.favorite_feed in valid_ids else None

    await DB.update("profiles", {"id": f"eq.{user['id']}"}, {
        "enabled_feeds": enabled_feeds,
        "favorite_feed": favorite_feed
    })
    return {"message": "Feed preferences updated", "enabled_feeds": enabled_feeds, "favorite_feed": favorite_feed}


# ============== RSS FEED ENDPOINTS ==============

@api_router.get("/feeds")
async def get_feeds():
    return await DB.select("feeds", {"active": "eq.true"}, order="name.asc")


@api_router.post("/feeds")
async def create_feed(feed_data: RssFeedCreate, request: Request):
    await require_admin(request)
    existing = await DB.select("feeds", {"url": f"eq.{feed_data.url}"})
    if existing:
        raise HTTPException(400, "Feed URL già esistente")

    feed_id = f"feed_{uuid.uuid4().hex[:12]}"
    return await DB.insert("feeds", {
        "feed_id": feed_id,
        "name": feed_data.name,
        "url": feed_data.url,
        "category": feed_data.category or "general",
        "active": True,
    })


@api_router.put("/feeds/{feed_id}")
async def update_feed(feed_id: str, feed_data: RssFeedCreate, request: Request):
    await require_admin(request)
    result = await DB.update("feeds", {"feed_id": f"eq.{feed_id}"}, {
        "name": feed_data.name,
        "url": feed_data.url,
        "category": feed_data.category
    })
    if not result:
        raise HTTPException(404, "Feed non trovato")
    return result[0] if isinstance(result, list) else result


@api_router.delete("/feeds/{feed_id}")
async def delete_feed(feed_id: str, request: Request):
    await require_admin(request)
    await DB.delete("articles", {"feed_id": f"eq.{feed_id}"})
    ok = await DB.delete("feeds", {"feed_id": f"eq.{feed_id}"})
    if not ok:
        raise HTTPException(404, "Feed non trovato")
    return {"message": "Feed eliminato"}


# ============== ARTICLE ENDPOINTS ==============

@api_router.get("/articles/saved")
async def get_saved_articles(request: Request):
    user = await require_auth(request)
    saved = await DB.select("saved_articles", {"user_id": f"eq.{user['id']}"}, order="saved_at.desc")
    if not saved:
        return []

    article_ids = [s["article_id"] for s in saved]
    # Fetch all articles, filtering by article_id
    articles = []
    for article_id in article_ids:
        rows = await DB.select("articles", {"article_id": f"eq.{article_id}"})
        if rows:
            a = rows[0]
            a["is_saved"] = True
            articles.append(a)
    return articles


@api_router.get("/articles")
async def get_articles(
    request: Request,
    feed_id: Optional[str] = Query(None),
    limit: int = Query(default=50, le=200),
    skip: int = Query(default=0)
):
    user = await get_current_user(request)

    filters = {}
    if feed_id:
        filters["feed_id"] = f"eq.{feed_id}"

    articles = await DB.select("articles", filters if filters else None,
                                order="pub_date.desc", limit=limit, offset=skip)

    # Check which articles are saved by this user
    saved_ids = set()
    if user:
        saved = await DB.select("saved_articles", {"user_id": f"eq.{user['id']}"}, select="article_id")
        saved_ids = {s["article_id"] for s in saved}

    for a in articles:
        a["is_saved"] = a.get("article_id") in saved_ids

    return articles


@api_router.get("/articles/{article_id}/gallery")
async def get_article_gallery(article_id: str):
    """Scrapa la pagina dell'articolo e restituisce le immagini della galleria."""
    rows = await DB.select("articles", {"article_id": f"eq.{article_id}"})
    if not rows:
        raise HTTPException(404, "Articolo non trovato")

    link = rows[0].get("link", "")
    if not link:
        return {"images": [], "article_id": article_id}

    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            r = await client.get(link, headers={"User-Agent": "Mozilla/5.0 (compatible; OKNews24/1.0)"})
            html = r.text

        # Estrai immagini dalla galleria tb-gallery-container (plugin okmugello.it)
        gallery_match = re.search(
            r'<div[^>]+tb-gallery-container[^>]*>([\s\S]+?)(?=<div[^>]+(?:class|id)=(?!.*item)["\'][^"\']*(?!item)[^"\']*["\']|\Z)',
            html, re.IGNORECASE
        )

        if not gallery_match:
            # Fallback: cerca qualsiasi blocco con classe gallery/carousel
            gallery_match = re.search(
                r'<div[^>]+class="[^"]*(?:gallery|tb-gallery|carousel_snap)[^"]*"[^>]*>([\s\S]+?)</div>\s*</div>',
                html, re.IGNORECASE
            )

        if gallery_match:
            gallery_html = gallery_match.group(0)
            # Estrai tutti gli src delle img nella galleria (evita placeholder)
            images = [
                src for src in re.findall(
                    r'<img[^>]+src=["\']([^"\']+)["\']', gallery_html, re.IGNORECASE
                )
                if "placeholder" not in src.lower() and src.startswith("http")
            ]
            if images:
                return {"images": images, "article_id": article_id}

        return {"images": [], "article_id": article_id}

    except Exception as e:
        logger.warning(f"Gallery fetch error for {article_id}: {e}")
        return {"images": [], "article_id": article_id}


@api_router.get("/articles/{article_id}")
async def get_article(article_id: str, request: Request):
    user = await get_current_user(request)

    rows = await DB.select("articles", {"article_id": f"eq.{article_id}"})
    if not rows:
        raise HTTPException(404, "Articolo non trovato")

    article = rows[0]

    if user:
        # Check subscription access
        sub_status = user.get("subscription_status", "trial")
        articles_read = user.get("articles_read", 0)

        if sub_status == "trial" and articles_read >= FREE_ARTICLES_LIMIT:
            raise HTTPException(402, "Abbonamento richiesto per leggere altri articoli")

        # Increment read count for trial users
        if sub_status == "trial":
            await DB.update("profiles", {"id": f"eq.{user['id']}"}, {"articles_read": articles_read + 1})

        # Check if saved
        saved = await DB.select("saved_articles", {
            "user_id": f"eq.{user['id']}",
            "article_id": f"eq.{article_id}"
        })
        article["is_saved"] = len(saved) > 0

    return article


@api_router.post("/articles/save/{article_id}")
async def save_article(article_id: str, request: Request):
    user = await require_auth(request)
    try:
        await DB.insert("saved_articles", {"user_id": user["id"], "article_id": article_id})
    except HTTPException as e:
        if "duplicate" in str(e.detail).lower() or "unique" in str(e.detail).lower():
            pass  # Already saved
        else:
            raise
    return {"message": "Articolo salvato"}


@api_router.delete("/articles/save/{article_id}")
async def unsave_article(article_id: str, request: Request):
    user = await require_auth(request)
    await DB.delete("saved_articles", {"user_id": f"eq.{user['id']}", "article_id": f"eq.{article_id}"})
    return {"message": "Articolo rimosso dai salvati"}


def _extract_first_img(html: str) -> Optional[str]:
    """Estrai il primo src di un tag <img> dall'HTML, escludendo pixel tracker."""
    if not html:
        return None
    match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', html, re.IGNORECASE)
    if match:
        src = match.group(1)
        # Escludi pixel tracker e icone
        skip_patterns = ["pixel", "1x1", "gravatar", "avatar", "icon", "emoji", "logo", "badge"]
        if any(x in src.lower() for x in skip_patterns):
            return None
        return src
    return None


def _get_entry_image(entry) -> Optional[str]:
    """Estrai l'immagine principale da un entry feedparser (WordPress/standard RSS)."""
    # 1. media:content — standard WordPress/Jetpack
    if hasattr(entry, "media_content") and entry.media_content:
        for mc in entry.media_content:
            url = mc.get("url", "")
            if url:
                medium = mc.get("medium", "")
                # Prendi solo media di tipo immagine, o URL con estensione immagine
                if medium == "image" or any(url.lower().split("?")[0].endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"]):
                    return url
        # Fallback: primo media_content qualunque
        url = entry.media_content[0].get("url", "")
        if url:
            return url

    # 2. media:thumbnail
    if hasattr(entry, "media_thumbnail") and entry.media_thumbnail:
        url = entry.media_thumbnail[0].get("url", "")
        if url:
            return url

    # 3. enclosures
    if hasattr(entry, "enclosures") and entry.enclosures:
        for enc in entry.enclosures:
            href = enc.get("href", "") or enc.get("url", "")
            t = enc.get("type", "")
            if t.startswith("image") or any(href.lower().split("?")[0].endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                if href:
                    return href

    # 4. Prima immagine nel content:encoded o summary (HTML parsing)
    html_content = ""
    if hasattr(entry, "content") and entry.content:
        html_content = entry.content[0].get("value", "")
    if not html_content:
        html_content = getattr(entry, "summary", "") or ""

    return _extract_first_img(html_content)


@api_router.post("/articles/refresh")
async def refresh_articles(request: Request):
    await require_admin(request)

    feeds = await DB.select("feeds", {"active": "eq.true"})
    if not feeds:
        return {"message": "Nessun feed configurato", "added": 0}

    added = 0
    errors = 0

    for feed in feeds:
        try:
            parsed = feedparser.parse(feed["url"])
            for entry in parsed.entries[:30]:
                link = entry.get("link", "")
                if not link:
                    continue

                # Salta duplicati
                existing = await DB.select("articles", {"link": f"eq.{link}"})
                if existing:
                    continue

                pub_date = None
                if hasattr(entry, "published_parsed") and entry.published_parsed:
                    try:
                        pub_date = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()
                    except Exception:
                        pass

                # Estrai immagine con logica migliorata
                image_url = _get_entry_image(entry)

                # Mantieni HTML completo per description e content
                description = getattr(entry, "summary", "") or ""
                content_html = ""
                if hasattr(entry, "content") and entry.content:
                    content_html = entry.content[0].get("value", "")
                # Se l'image_url non è stata trovata via media tag, prova dal content
                if not image_url:
                    image_url = _extract_first_img(content_html) or _extract_first_img(description)

                author = getattr(entry, "author", "") or ""

                article_id = f"art_{uuid.uuid4().hex[:12]}"
                await DB.insert("articles", {
                    "article_id": article_id,
                    "feed_id": feed["feed_id"],
                    "feed_name": feed["name"],
                    "category": feed.get("category", "general"),
                    "title": entry.get("title", "Senza titolo"),
                    "description": description,
                    "content": content_html,
                    "link": link,
                    "image_url": image_url,
                    "author": author,
                    "pub_date": pub_date,
                })
                added += 1
        except Exception as e:
            logger.error(f"Error refreshing feed {feed.get('name')}: {e}")
            errors += 1

    return {"message": f"Aggiornamento completato: {added} nuovi articoli", "added": added, "errors": errors}


# ============== STRIPE HELPERS ==============

async def get_or_create_stripe_prices():
    global STRIPE_PRICES
    if STRIPE_PRICES.get("monthly") and STRIPE_PRICES.get("yearly"):
        return

    if not stripe.api_key:
        return

    # Try to get from DB cache (table may not exist — ignore errors)
    try:
        cached = await DB.select("stripe_config", {"type": "eq.main"})
        if cached:
            STRIPE_PRICES["monthly"] = cached[0].get("monthly_price_id")
            STRIPE_PRICES["yearly"] = cached[0].get("yearly_price_id")
            if STRIPE_PRICES["monthly"] and STRIPE_PRICES["yearly"]:
                return
    except Exception:
        pass

    try:
        # Search for existing OKNews24 Premium product in Stripe
        products = stripe.Product.list(limit=20, active=True)
        existing_product = None
        for p in products.auto_paging_iter():
            if p.name == "OKNews24 Premium":
                existing_product = p
                break

        if existing_product:
            # Get existing active recurring prices for this product
            prices = stripe.Price.list(product=existing_product.id, active=True, limit=10)
            for price in prices.auto_paging_iter():
                interval = price.recurring.interval if price.recurring else None
                if interval == "month" and not STRIPE_PRICES["monthly"]:
                    STRIPE_PRICES["monthly"] = price.id
                elif interval == "year" and not STRIPE_PRICES["yearly"]:
                    STRIPE_PRICES["yearly"] = price.id
            product_id = existing_product.id
        else:
            # Create new product
            product = stripe.Product.create(name="OKNews24 Premium", description="Accesso illimitato a tutte le notizie")
            product_id = product.id

        # Create any missing prices
        if not STRIPE_PRICES["monthly"]:
            monthly_price = stripe.Price.create(
                product=product_id, unit_amount=400, currency="eur",
                recurring={"interval": "month"}, nickname="Piano Mensile"
            )
            STRIPE_PRICES["monthly"] = monthly_price.id

        if not STRIPE_PRICES["yearly"]:
            yearly_price = stripe.Price.create(
                product=product_id, unit_amount=3600, currency="eur",
                recurring={"interval": "year"}, nickname="Piano Annuale"
            )
            STRIPE_PRICES["yearly"] = yearly_price.id

        # Try to cache in DB (ignore error if table doesn't exist)
        try:
            await DB.upsert("stripe_config", {
                "type": "main",
                "monthly_price_id": STRIPE_PRICES["monthly"],
                "yearly_price_id": STRIPE_PRICES["yearly"],
                "product_id": product_id,
            })
        except Exception:
            pass

    except Exception as e:
        logger.error(f"Stripe setup error: {e}")


# ============== SUBSCRIPTION ENDPOINTS ==============

@api_router.get("/subscriptions/plans")
async def get_plans():
    return {
        "plans": [
            {
                "plan_id": "monthly",
                "name": "Piano Mensile",
                "price": 4.00,
                "currency": "eur",
                "interval": "month",
                "description": "Accesso illimitato per 1 mese"
            },
            {
                "plan_id": "yearly",
                "name": "Piano Annuale",
                "price": 36.00,
                "currency": "eur",
                "interval": "year",
                "description": "Accesso illimitato per 1 anno (risparmia 30%)"
            }
        ],
        "stripe_publishable_key": STRIPE_PUBLISHABLE_KEY
    }


@api_router.post("/subscriptions/create-checkout-session")
async def create_checkout_session(sub_data: SubscriptionCreate, request: Request):
    user = await require_auth(request)

    if sub_data.plan_type not in ["monthly", "yearly"]:
        raise HTTPException(400, "Tipo di piano non valido")

    await get_or_create_stripe_prices()
    price_id = STRIPE_PRICES.get(sub_data.plan_type)
    if not price_id:
        raise HTTPException(500, "Stripe non configurato")

    origin = request.headers.get("origin", "https://oknews24.it")
    success_url = sub_data.success_url or f"{origin}/subscription?success=true&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = sub_data.cancel_url or f"{origin}/subscription?canceled=true"

    try:
        profile_rows = await DB.select("profiles", {"id": f"eq.{user['id']}"})
        profile = profile_rows[0] if profile_rows else {}
        stripe_customer_id = profile.get("stripe_customer_id")

        if not stripe_customer_id:
            customer = stripe.Customer.create(email=user["email"], name=user.get("name", ""), metadata={"user_id": user["id"]})
            stripe_customer_id = customer.id
            await DB.update("profiles", {"id": f"eq.{user['id']}"}, {"stripe_customer_id": stripe_customer_id})

        session = stripe.checkout.Session.create(
            customer=stripe_customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"user_id": user["id"], "plan_type": sub_data.plan_type}
        )
        return {"checkout_url": session.url, "session_id": session.id}
    except stripe.error.StripeError as e:
        raise HTTPException(500, str(e))


@api_router.post("/subscriptions/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(500, "Webhook non configurato")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(400, "Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid signature")

    if event["type"] == "checkout.session.completed":
        await _handle_checkout_completed(event["data"]["object"])
    elif event["type"] == "customer.subscription.updated":
        await _handle_subscription_updated(event["data"]["object"])
    elif event["type"] == "customer.subscription.deleted":
        await _handle_subscription_deleted(event["data"]["object"])
    elif event["type"] == "invoice.payment_succeeded":
        await _handle_invoice_paid(event["data"]["object"])
    elif event["type"] == "invoice.payment_failed":
        await _handle_invoice_failed(event["data"]["object"])

    return {"status": "success"}


async def _handle_checkout_completed(session):
    user_id = session.get("metadata", {}).get("user_id")
    plan_type = session.get("metadata", {}).get("plan_type")
    stripe_sub_id = session.get("subscription")
    if not user_id:
        return

    start_date = datetime.now(timezone.utc)
    end_date = start_date + (timedelta(days=30) if plan_type == "monthly" else timedelta(days=365))
    amount = 4.00 if plan_type == "monthly" else 36.00

    await DB.insert("subscriptions", {
        "subscription_id": f"sub_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "plan_type": plan_type,
        "status": "active",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "stripe_subscription_id": stripe_sub_id,
        "stripe_session_id": session.get("id"),
        "amount": amount,
    })
    await DB.update("profiles", {"id": f"eq.{user_id}"}, {
        "subscription_status": plan_type,
        "subscription_end_date": end_date.isoformat(),
        "stripe_subscription_id": stripe_sub_id,
    })


async def _handle_subscription_updated(subscription):
    stripe_sub_id = subscription.get("id")
    status = subscription.get("status")
    profiles = await DB.select("profiles", {"stripe_subscription_id": f"eq.{stripe_sub_id}"})
    if not profiles:
        return
    p = profiles[0]
    if status in ["active", "trialing"]:
        new_status = p.get("subscription_status", "monthly")
    elif status in ["past_due", "canceled", "unpaid"]:
        new_status = "expired"
    else:
        new_status = "trial"
    await DB.update("profiles", {"id": f"eq.{p['id']}"}, {"subscription_status": new_status})


async def _handle_subscription_deleted(subscription):
    stripe_sub_id = subscription.get("id")
    profiles = await DB.select("profiles", {"stripe_subscription_id": f"eq.{stripe_sub_id}"})
    if not profiles:
        return
    p = profiles[0]
    await DB.update("profiles", {"id": f"eq.{p['id']}"}, {"subscription_status": "expired", "stripe_subscription_id": None})
    await DB.update("subscriptions", {"stripe_subscription_id": f"eq.{stripe_sub_id}"}, {"status": "cancelled"})


async def _handle_invoice_paid(invoice):
    stripe_sub_id = invoice.get("subscription")
    profiles = await DB.select("profiles", {"stripe_subscription_id": f"eq.{stripe_sub_id}"})
    if not profiles:
        return
    p = profiles[0]
    plan_type = p.get("subscription_status", "monthly")
    current_end_raw = p.get("subscription_end_date")
    try:
        current_end = datetime.fromisoformat(str(current_end_raw).replace("Z", "+00:00")) if current_end_raw else datetime.now(timezone.utc)
    except Exception:
        current_end = datetime.now(timezone.utc)
    new_end = current_end + (timedelta(days=30) if plan_type == "monthly" else timedelta(days=365))
    await DB.update("profiles", {"id": f"eq.{p['id']}"}, {"subscription_end_date": new_end.isoformat()})


async def _handle_invoice_failed(invoice):
    stripe_sub_id = invoice.get("subscription")
    profiles = await DB.select("profiles", {"stripe_subscription_id": f"eq.{stripe_sub_id}"})
    if profiles:
        await DB.update("profiles", {"id": f"eq.{profiles[0]['id']}"}, {"subscription_status": "expired"})


@api_router.get("/subscriptions/verify-session/{session_id}")
async def verify_checkout_session(session_id: str, request: Request):
    user = await require_auth(request)
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        if session.payment_status == "paid" and session.metadata.get("user_id") == user["id"]:
            return {"success": True, "plan_type": session.metadata.get("plan_type"), "status": session.status}
        return {"success": False, "message": "Pagamento non completato"}
    except stripe.error.StripeError as e:
        raise HTTPException(400, str(e))


@api_router.post("/subscriptions/cancel")
async def cancel_subscription(request: Request):
    user = await require_auth(request)
    profiles = await DB.select("profiles", {"id": f"eq.{user['id']}"})
    stripe_sub_id = profiles[0].get("stripe_subscription_id") if profiles else None
    if not stripe_sub_id:
        raise HTTPException(400, "Nessun abbonamento attivo")
    try:
        stripe.Subscription.modify(stripe_sub_id, cancel_at_period_end=True)
        return {"message": "Abbonamento verrà cancellato a fine periodo"}
    except stripe.error.StripeError as e:
        raise HTTPException(500, str(e))


@api_router.get("/subscriptions/my")
async def get_my_subscription(request: Request):
    user = await require_auth(request)
    subs = await DB.select("subscriptions", {"user_id": f"eq.{user['id']}", "status": "eq.active"}, order="created_at.desc", limit=1)
    return {
        "subscription": subs[0] if subs else None,
        "subscription_status": user.get("subscription_status", "trial"),
        "articles_read": user.get("articles_read", 0),
        "trial_remaining": max(0, FREE_ARTICLES_LIMIT - user.get("articles_read", 0)) if user.get("subscription_status") == "trial" else None
    }


# ============== ADMIN ENDPOINTS ==============

@api_router.get("/admin/users")
async def get_all_users(
    request: Request,
    limit: int = Query(default=50, le=100),
    skip: int = 0,
    search: Optional[str] = None
):
    await require_admin(request)
    # Supabase REST doesn't support OR filters easily, so we fetch all and filter
    all_users = await DB.select("profiles", order="created_at.desc", limit=200)

    if search:
        s = search.lower()
        all_users = [u for u in all_users if s in u.get("email", "").lower() or s in u.get("name", "").lower()]

    total = len(all_users)
    users = all_users[skip:skip + limit]
    for u in users:
        u["user_id"] = u["id"]
    return {"users": users, "total": total, "limit": limit, "skip": skip}


@api_router.put("/admin/users/{user_id}")
async def update_user(user_id: str, update_data: UserUpdate, request: Request):
    await require_admin(request)
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(400, "Nessun dato da aggiornare")
    result = await DB.update("profiles", {"id": f"eq.{user_id}"}, update_dict)
    if not result:
        raise HTTPException(404, "Utente non trovato")
    out = result[0] if isinstance(result, list) else result
    out["user_id"] = out.get("id", user_id)
    return out


@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    admin = await require_admin(request)
    if user_id == admin["id"]:
        raise HTTPException(400, "Non puoi eliminare il tuo account")
    await Auth.admin_delete_user(user_id)
    await DB.delete("profiles", {"id": f"eq.{user_id}"})
    return {"message": "Utente eliminato"}


@api_router.get("/admin/stats")
async def get_admin_stats(request: Request):
    await require_admin(request)
    total_users = await DB.count("profiles")
    trial_users = await DB.count("profiles", {"subscription_status": "eq.trial"})
    total_articles = await DB.count("articles")
    total_feeds = await DB.count("feeds", {"active": "eq.true"})
    all_users = await DB.select("profiles", {"subscription_status": "in.(monthly,yearly)"})
    subscribed_users = len(all_users)
    return {
        "total_users": total_users,
        "trial_users": trial_users,
        "subscribed_users": subscribed_users,
        "total_articles": total_articles,
        "total_feeds": total_feeds
    }


@api_router.post("/admin/users/create")
async def admin_create_user_endpoint(user_data: AdminUserCreate, request: Request):
    await require_admin(request)

    existing = await DB.select("profiles", {"email": f"eq.{user_data.email.lower()}"})
    if existing:
        raise HTTPException(400, "Email già registrata")

    auth_result, status = await Auth.admin_create_user(
        user_data.email.lower(),
        user_data.password,
        {"name": user_data.name}
    )
    if status >= 400:
        raise HTTPException(400, auth_result.get("msg", "Creazione utente fallita"))

    user_id = auth_result.get("id")
    sub_status = user_data.subscription_plan
    sub_end = None
    if sub_status == "monthly":
        sub_end = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    elif sub_status == "yearly":
        sub_end = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()

    await DB.upsert("profiles", {
        "id": user_id,
        "email": user_data.email.lower(),
        "name": user_data.name,
        "subscription_status": sub_status,
        "subscription_end_date": sub_end,
    })

    profiles = await DB.select("profiles", {"id": f"eq.{user_id}"})
    out = profiles[0] if profiles else {"id": user_id}
    out["user_id"] = out["id"]
    return out


@api_router.post("/admin/articles/deduplicate")
async def deduplicate_articles(request: Request):
    await require_admin(request)
    # Get all articles grouped by link - keep earliest, remove rest
    all_articles = await DB.select("articles", order="created_at.asc", limit=10000)
    seen_links = {}
    to_delete = []
    for a in all_articles:
        link = a.get("link")
        if link in seen_links:
            to_delete.append(a.get("article_id"))
        else:
            seen_links[link] = a.get("article_id")

    removed = 0
    for article_id in to_delete:
        ok = await DB.delete("articles", {"article_id": f"eq.{article_id}"})
        if ok:
            removed += 1

    return {"message": f"Rimossi {removed} articoli duplicati"}


# ============== PUSH NOTIFICATIONS ==============

@api_router.post("/notifications/register")
async def register_push_token(data: PushTokenRegister, request: Request):
    user = await require_auth(request)
    await DB.upsert("push_tokens", {
        "user_id": user["id"],
        "push_token": data.push_token,
        "updated_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Push token registrato"}


@api_router.post("/notifications/unregister")
async def unregister_push_token(data: PushTokenRegister, request: Request):
    await DB.delete("push_tokens", {"push_token": f"eq.{data.push_token}"})
    return {"message": "Push token rimosso"}


@api_router.post("/notifications/send")
async def send_push_notification(request: Request):
    await require_admin(request)
    body = await request.json()
    title = body.get("title", "OKNews24")
    message = body.get("message", "Nuovi articoli disponibili!")

    tokens_docs = await DB.select("push_tokens", select="push_token")
    tokens = [d["push_token"] for d in tokens_docs if d.get("push_token")]

    if not tokens:
        return {"message": "Nessun dispositivo registrato", "sent": 0}

    sent = 0
    failed = 0
    for i in range(0, len(tokens), 100):
        batch = tokens[i:i + 100]
        messages = [{"to": t, "sound": "default", "title": title, "body": message, "data": {"type": "new_articles"}} for t in batch]
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                r = await c.post("https://exp.host/--/api/v2/push/send", json=messages, headers={"Content-Type": "application/json"})
                if r.status_code == 200:
                    sent += len(batch)
                else:
                    failed += len(batch)
        except Exception as e:
            logger.error(f"Push error: {e}")
            failed += len(batch)

    return {"message": f"Inviati {sent}, falliti {failed}", "sent": sent, "failed": failed}


@api_router.get("/notifications/settings")
async def get_notification_settings(request: Request):
    user = await require_auth(request)
    token_docs = await DB.select("push_tokens", {"user_id": f"eq.{user['id']}"})
    doc = token_docs[0] if token_docs else None
    return {"enabled": doc is not None, "push_token": doc.get("push_token") if doc else None}


# ============== INITIALIZATION ==============

@api_router.post("/init/setup")
async def initial_setup():
    existing = await DB.count("feeds")
    if existing > 0:
        return {"message": "Already initialized"}

    default_feeds = [
        {"name": "OK Mugello", "url": "https://www.okmugello.it/mugello/feed/", "category": "mugello"},
        {"name": "OK Valdisieve", "url": "https://www.okvaldisieve.it/feed", "category": "valdisieve"},
        {"name": "OK Firenze", "url": "https://www.okfirenze.com/feed", "category": "firenze"},
        {"name": "OK Mugello Magazine", "url": "https://www.okmugello.it/magazine/feed", "category": "magazine"},
        {"name": "OK Sport", "url": "https://www.okmugello.it/sport/feed", "category": "sport"},
    ]

    for feed_data in default_feeds:
        feed_id = f"feed_{uuid.uuid4().hex[:12]}"
        try:
            await DB.insert("feeds", {
                "feed_id": feed_id,
                "name": feed_data["name"],
                "url": feed_data["url"],
                "category": feed_data["category"],
                "active": True,
            })
        except Exception as e:
            logger.error(f"Error inserting feed {feed_data['name']}: {e}")

    return {"message": f"Inizializzazione completata: {len(default_feeds)} feed configurati"}


@api_router.get("/health")
async def health():
    return {"status": "ok", "backend": "supabase", "version": "2.0"}


# ============== MIDDLEWARE & STARTUP ==============

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("startup")
async def startup():
    logger.info("OKNews24 backend (Supabase edition) starting up")
    # Verify Supabase connection
    try:
        profiles = await DB.select("profiles", limit=1)
        logger.info(f"Supabase connection OK - profiles table accessible")
    except Exception as e:
        logger.warning(f"Supabase startup check failed: {e}")
