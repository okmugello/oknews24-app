from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import httpx
import feedparser
from jose import jwt, JWTError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'oknews24_db')]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'oknews24-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7

# Trial settings
FREE_ARTICLES_LIMIT = 5

# Create the main app
app = FastAPI(title="OKNews24 API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "user"  # user or admin
    articles_read: int = 0
    subscription_status: str = "trial"  # trial, monthly, yearly, expired
    subscription_end_date: Optional[datetime] = None
    created_at: datetime

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    subscription_status: Optional[str] = None
    subscription_end_date: Optional[datetime] = None

class RssFeedCreate(BaseModel):
    name: str
    url: str
    category: Optional[str] = "general"

class RssFeed(BaseModel):
    feed_id: str
    name: str
    url: str
    category: str = "general"
    active: bool = True
    created_at: datetime

class Article(BaseModel):
    article_id: str
    feed_id: str
    feed_name: str
    title: str
    description: Optional[str] = None
    content: Optional[str] = None
    link: str
    image_url: Optional[str] = None
    pub_date: Optional[datetime] = None
    created_at: datetime

class SubscriptionCreate(BaseModel):
    plan_type: str  # monthly or yearly

class Subscription(BaseModel):
    subscription_id: str
    user_id: str
    plan_type: str
    status: str = "active"  # active, cancelled, expired
    start_date: datetime
    end_date: datetime
    payment_id: Optional[str] = None
    amount: float

# ============== AUTH HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    payload = {
        "user_id": user_id,
        "exp": expires
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("user_id")
    except JWTError:
        return None

async def get_current_user(request: Request) -> Optional[User]:
    # Check cookie first
    session_token = request.cookies.get("session_token")
    
    # Check Authorization header as fallback
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        return None
    
    # Check session in database
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        return None
    
    # Check expiry
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        return None
    
    return User(**user_doc)

async def require_auth(request: Request) -> User:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

async def require_admin(request: Request) -> User:
    user = await require_auth(request)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ============== AUTH ENDPOINTS ==============

@api_router.post("/auth/register")
async def register(user_data: UserCreate, response: Response):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    hashed_password = hash_password(user_data.password)
    
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": hashed_password,
        "picture": None,
        "role": "user",
        "articles_read": 0,
        "subscription_status": "trial",
        "subscription_end_date": None,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(user_doc)
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS),
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60
    )
    
    # Return user without password
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    return user_doc

@api_router.post("/auth/login")
async def login(user_data: UserLogin, response: Response):
    # Find user
    user_doc = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not user_doc.get("password_hash"):
        raise HTTPException(status_code=401, detail="Please use social login")
    
    if not verify_password(user_data.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS),
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60
    )
    
    # Return user without password
    user_doc.pop("password_hash", None)
    return user_doc

@api_router.post("/auth/session")
async def process_google_session(request: Request, response: Response):
    """Process Google OAuth session_id from Emergent Auth"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth to get user data
    emergent_auth_url = os.environ.get('EMERGENT_AUTH_URL', 'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data')
    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                emergent_auth_url,
                headers={"X-Session-ID": session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            auth_data = auth_response.json()
        except Exception as e:
            logger.error(f"Error calling Emergent Auth: {e}")
            raise HTTPException(status_code=500, detail="Authentication service error")
    
    email = auth_data.get("email")
    name = auth_data.get("name")
    picture = auth_data.get("picture")
    
    # Check if user exists
    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    
    if user_doc:
        # Update existing user
        await db.users.update_one(
            {"email": email},
            {"$set": {"name": name, "picture": picture}}
        )
        user_id = user_doc["user_id"]
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": "user",
            "articles_read": 0,
            "subscription_status": "trial",
            "subscription_end_date": None,
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(user_doc)
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS),
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60
    )
    
    # Get updated user
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    user_doc.pop("password_hash", None)
    
    return user_doc

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    return {"message": "Logged out"}

# ============== RSS FEED ENDPOINTS ==============

@api_router.get("/feeds", response_model=List[RssFeed])
async def get_feeds():
    feeds = await db.feeds.find({"active": True}, {"_id": 0}).to_list(100)
    return [RssFeed(**feed) for feed in feeds]

@api_router.post("/feeds", response_model=RssFeed)
async def create_feed(feed_data: RssFeedCreate, request: Request):
    user = await require_admin(request)
    
    # Check if feed URL already exists
    existing = await db.feeds.find_one({"url": feed_data.url}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Feed URL already exists")
    
    feed_id = f"feed_{uuid.uuid4().hex[:12]}"
    feed_doc = {
        "feed_id": feed_id,
        "name": feed_data.name,
        "url": feed_data.url,
        "category": feed_data.category or "general",
        "active": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.feeds.insert_one(feed_doc)
    return RssFeed(**feed_doc)

@api_router.put("/feeds/{feed_id}", response_model=RssFeed)
async def update_feed(feed_id: str, feed_data: RssFeedCreate, request: Request):
    user = await require_admin(request)
    
    result = await db.feeds.update_one(
        {"feed_id": feed_id},
        {"$set": {
            "name": feed_data.name,
            "url": feed_data.url,
            "category": feed_data.category
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Feed not found")
    
    feed_doc = await db.feeds.find_one({"feed_id": feed_id}, {"_id": 0})
    return RssFeed(**feed_doc)

@api_router.delete("/feeds/{feed_id}")
async def delete_feed(feed_id: str, request: Request):
    user = await require_admin(request)
    
    result = await db.feeds.delete_one({"feed_id": feed_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Feed not found")
    
    # Also delete associated articles
    await db.articles.delete_many({"feed_id": feed_id})
    
    return {"message": "Feed deleted"}

# ============== ARTICLES ENDPOINTS ==============

@api_router.get("/articles", response_model=List[Article])
async def get_articles(
    feed_id: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    skip: int = 0
):
    query = {}
    if feed_id:
        query["feed_id"] = feed_id
    if category:
        query["category"] = category
    
    articles = await db.articles.find(
        query, {"_id": 0}
    ).sort("pub_date", -1).skip(skip).limit(limit).to_list(limit)
    
    return [Article(**article) for article in articles]

@api_router.get("/articles/{article_id}")
async def get_article(article_id: str, request: Request):
    user = await get_current_user(request)
    
    article = await db.articles.find_one({"article_id": article_id}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Check subscription status
    if user:
        # Check if user can read this article
        if user.subscription_status == "trial":
            if user.articles_read >= FREE_ARTICLES_LIMIT:
                raise HTTPException(
                    status_code=403, 
                    detail="Trial limit reached. Please subscribe to continue reading."
                )
            # Increment articles read counter
            await db.users.update_one(
                {"user_id": user.user_id},
                {"$inc": {"articles_read": 1}}
            )
        elif user.subscription_status == "expired":
            raise HTTPException(
                status_code=403,
                detail="Your subscription has expired. Please renew to continue reading."
            )
        # Check if subscription is still valid
        elif user.subscription_status in ["monthly", "yearly"]:
            if user.subscription_end_date:
                end_date = user.subscription_end_date
                if isinstance(end_date, str):
                    end_date = datetime.fromisoformat(end_date)
                if end_date.tzinfo is None:
                    end_date = end_date.replace(tzinfo=timezone.utc)
                if end_date < datetime.now(timezone.utc):
                    await db.users.update_one(
                        {"user_id": user.user_id},
                        {"$set": {"subscription_status": "expired"}}
                    )
                    raise HTTPException(
                        status_code=403,
                        detail="Your subscription has expired. Please renew to continue reading."
                    )
    else:
        raise HTTPException(status_code=401, detail="Please login to read articles")
    
    return Article(**article)

@api_router.post("/articles/refresh")
async def refresh_articles(request: Request):
    """Fetch new articles from all active feeds"""
    user = await require_admin(request)
    
    feeds = await db.feeds.find({"active": True}, {"_id": 0}).to_list(100)
    new_articles_count = 0
    
    for feed in feeds:
        try:
            parsed = feedparser.parse(feed["url"])
            
            # Collect all entry links for this feed first
            entry_links = [entry.get("link") for entry in parsed.entries[:20] if entry.get("link")]
            
            # Batch query: Get all existing articles with these links in one query
            existing_docs = await db.articles.find(
                {"link": {"$in": entry_links}},
                {"link": 1}
            ).to_list(None)
            existing_links = {doc["link"] for doc in existing_docs}
            
            for entry in parsed.entries[:20]:  # Limit to 20 per feed
                link = entry.get("link", "")
                
                # Skip if article already exists (O(1) lookup instead of database query)
                if link in existing_links:
                    continue
                
                # Generate unique article ID based on link
                article_id = f"art_{uuid.uuid4().hex[:12]}"
                
                # Parse publication date
                pub_date = None
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    pub_date = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
                elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                    pub_date = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)
                else:
                    pub_date = datetime.now(timezone.utc)
                
                # Get image URL from media content or enclosure
                image_url = None
                if hasattr(entry, 'media_content') and entry.media_content:
                    for media in entry.media_content:
                        if media.get('medium') == 'image' or media.get('type', '').startswith('image'):
                            image_url = media.get('url')
                            break
                if not image_url and hasattr(entry, 'enclosures') and entry.enclosures:
                    for enc in entry.enclosures:
                        if enc.get('type', '').startswith('image'):
                            image_url = enc.get('href')
                            break
                
                # Get description/content
                description = entry.get('summary', entry.get('description', ''))
                content = entry.get('content', [{}])[0].get('value', '') if hasattr(entry, 'content') else description
                
                article_doc = {
                    "article_id": article_id,
                    "feed_id": feed["feed_id"],
                    "feed_name": feed["name"],
                    "category": feed.get("category", "general"),
                    "title": entry.get("title", "No title"),
                    "description": description[:500] if description else None,
                    "content": content,
                    "link": link,
                    "image_url": image_url,
                    "pub_date": pub_date,
                    "created_at": datetime.now(timezone.utc)
                }
                
                await db.articles.insert_one(article_doc)
                new_articles_count += 1
                
        except Exception as e:
            logger.error(f"Error fetching feed {feed['name']}: {e}")
            continue
    
    return {"message": f"Fetched {new_articles_count} new articles"}

# ============== SUBSCRIPTION ENDPOINTS (MOCKED) ==============

@api_router.get("/subscriptions/plans")
async def get_plans():
    """Get available subscription plans"""
    return {
        "plans": [
            {
                "plan_id": "monthly",
                "name": "Abbonamento Mensile",
                "price": 4.00,
                "currency": "EUR",
                "interval": "month",
                "description": "Accesso illimitato a tutte le notizie per 1 mese"
            },
            {
                "plan_id": "yearly",
                "name": "Abbonamento Annuale",
                "price": 36.00,
                "currency": "EUR",
                "interval": "year",
                "description": "Accesso illimitato a tutte le notizie per 1 anno (risparmia €12!)"
            }
        ]
    }

@api_router.post("/subscriptions/subscribe")
async def subscribe(sub_data: SubscriptionCreate, request: Request):
    """Create a subscription (MOCKED - no real payment)"""
    user = await require_auth(request)
    
    if sub_data.plan_type not in ["monthly", "yearly"]:
        raise HTTPException(status_code=400, detail="Invalid plan type")
    
    # Calculate subscription dates
    start_date = datetime.now(timezone.utc)
    if sub_data.plan_type == "monthly":
        end_date = start_date + timedelta(days=30)
        amount = 4.00
    else:
        end_date = start_date + timedelta(days=365)
        amount = 36.00
    
    subscription_id = f"sub_{uuid.uuid4().hex[:12]}"
    
    # Create subscription record
    subscription_doc = {
        "subscription_id": subscription_id,
        "user_id": user.user_id,
        "plan_type": sub_data.plan_type,
        "status": "active",
        "start_date": start_date,
        "end_date": end_date,
        "payment_id": f"mock_payment_{uuid.uuid4().hex[:8]}",  # MOCKED
        "amount": amount
    }
    
    await db.subscriptions.insert_one(subscription_doc)
    
    # Update user subscription status
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "subscription_status": sub_data.plan_type,
            "subscription_end_date": end_date
        }}
    )
    
    return {
        "message": "Subscription created successfully (MOCKED)",
        "subscription": Subscription(**subscription_doc).model_dump()
    }

@api_router.get("/subscriptions/my")
async def get_my_subscription(request: Request):
    """Get current user's subscription"""
    user = await require_auth(request)
    
    subscription = await db.subscriptions.find_one(
        {"user_id": user.user_id, "status": "active"},
        {"_id": 0}
    )
    
    return {
        "subscription": subscription,
        "subscription_status": user.subscription_status,
        "articles_read": user.articles_read,
        "trial_remaining": max(0, FREE_ARTICLES_LIMIT - user.articles_read) if user.subscription_status == "trial" else None
    }

# ============== ADMIN ENDPOINTS ==============

@api_router.get("/admin/users")
async def get_all_users(
    request: Request,
    limit: int = Query(default=50, le=100),
    skip: int = 0,
    search: Optional[str] = None
):
    user = await require_admin(request)
    
    query = {}
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}}
        ]
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    
    return {
        "users": users,
        "total": total,
        "limit": limit,
        "skip": skip
    }

@api_router.put("/admin/users/{user_id}")
async def update_user(user_id: str, update_data: UserUpdate, request: Request):
    admin = await require_admin(request)
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    updated_user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return updated_user

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    admin = await require_admin(request)
    
    # Don't allow deleting yourself
    if user_id == admin.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also delete user sessions
    await db.user_sessions.delete_many({"user_id": user_id})
    
    return {"message": "User deleted"}

@api_router.get("/admin/stats")
async def get_admin_stats(request: Request):
    user = await require_admin(request)
    
    total_users = await db.users.count_documents({})
    trial_users = await db.users.count_documents({"subscription_status": "trial"})
    subscribed_users = await db.users.count_documents({"subscription_status": {"$in": ["monthly", "yearly"]}})
    total_articles = await db.articles.count_documents({})
    total_feeds = await db.feeds.count_documents({"active": True})
    
    return {
        "total_users": total_users,
        "trial_users": trial_users,
        "subscribed_users": subscribed_users,
        "total_articles": total_articles,
        "total_feeds": total_feeds
    }

# ============== INITIALIZATION ==============

@api_router.post("/init/setup")
async def initial_setup():
    """Initialize the database with default feeds and admin user"""
    
    # Check if already initialized
    existing_feeds = await db.feeds.count_documents({})
    if existing_feeds > 0:
        return {"message": "Already initialized"}
    
    # Create default RSS feeds
    default_feeds = [
        {"name": "OK Mugello", "url": "https://www.okmugello.it/mugello/feed", "category": "mugello"},
        {"name": "OK Mugello Magazine", "url": "https://www.okmugello.it/magazine/feed", "category": "magazine"},
        {"name": "OK Mugello Sport", "url": "https://www.okmugello.it/sport/feed", "category": "sport"},
        {"name": "OK Firenze", "url": "https://www.okfirenze.com/feed", "category": "firenze"},
        {"name": "OK Valdisieve", "url": "https://www.okvaldisieve.it/feed", "category": "valdisieve"}
    ]
    
    for feed in default_feeds:
        feed_id = f"feed_{uuid.uuid4().hex[:12]}"
        feed_doc = {
            "feed_id": feed_id,
            "name": feed["name"],
            "url": feed["url"],
            "category": feed["category"],
            "active": True,
            "created_at": datetime.now(timezone.utc)
        }
        await db.feeds.insert_one(feed_doc)
    
    # Create admin user
    admin_id = f"user_{uuid.uuid4().hex[:12]}"
    admin_password = hash_password("admin123")  # Change this in production!
    
    admin_doc = {
        "user_id": admin_id,
        "email": "admin@oknews24.com",
        "name": "Admin",
        "password_hash": admin_password,
        "picture": None,
        "role": "admin",
        "articles_read": 0,
        "subscription_status": "yearly",
        "subscription_end_date": datetime.now(timezone.utc) + timedelta(days=365),
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(admin_doc)
    
    return {
        "message": "Initialized successfully",
        "admin_email": "admin@oknews24.com",
        "admin_password": "admin123"
    }

@api_router.get("/")
async def root():
    return {"message": "OKNews24 API", "version": "1.0.0"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
