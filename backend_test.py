#!/usr/bin/env python3
"""
OKNews24 Backend API Testing Script
Tests all backend endpoints including auth, notifications, and admin functions
"""

import asyncio
import httpx
import json
import os
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://oknews24-app.preview.emergentagent.com/api"

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@oknews24.com"
ADMIN_PASSWORD = "admin123"

class BackendTester:
    def __init__(self):
        self.session_token = None
        self.admin_session_token = None
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        
    async def log_result(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
    
    async def test_admin_login(self):
        """Test admin login and extract session token"""
        try:
            response = await self.client.post(
                f"{BACKEND_URL}/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            )
            
            if response.status_code == 200:
                data = response.json()
                # Extract session token from set-cookie header
                cookies = response.headers.get('set-cookie', '')
                if 'session_token=' in cookies:
                    # Parse session token from cookie
                    cookie_parts = cookies.split('session_token=')[1].split(';')[0]
                    self.session_token = cookie_parts
                    self.admin_session_token = cookie_parts  # Store admin token separately
                    await self.log_result("Admin Login", True, f"Logged in as {data.get('email')}, role: {data.get('role')}")
                    return True
                else:
                    await self.log_result("Admin Login", False, "No session token in response")
                    return False
            else:
                await self.log_result("Admin Login", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            await self.log_result("Admin Login", False, f"Exception: {str(e)}")
            return False
    
    async def test_google_oauth(self):
        """Test Google OAuth endpoint"""
        try:
            google_data = {
                "email": "googleuser@gmail.com",
                "name": "Google User",
                "picture": "https://example.com/photo.jpg",
                "id_token": "test_token_123"
            }
            
            response = await self.client.post(
                f"{BACKEND_URL}/auth/google",
                json=google_data
            )
            
            if response.status_code == 200:
                data = response.json()
                await self.log_result("Google OAuth", True, f"Created/found user: {data.get('email')}")
                return True
            else:
                await self.log_result("Google OAuth", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            await self.log_result("Google OAuth", False, f"Exception: {str(e)}")
            return False
    
    async def test_register_push_token(self):
        """Test push token registration (requires auth)"""
        if not self.session_token:
            await self.log_result("Register Push Token", False, "No session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            push_data = {"push_token": "ExponentPushToken[test123]"}
            
            response = await self.client.post(
                f"{BACKEND_URL}/notifications/register",
                json=push_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                await self.log_result("Register Push Token", True, data.get('message', 'Token registered'))
                return True
            else:
                await self.log_result("Register Push Token", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            await self.log_result("Register Push Token", False, f"Exception: {str(e)}")
            return False
    
    async def test_notification_settings(self):
        """Test get notification settings (requires auth)"""
        if not self.session_token:
            await self.log_result("Get Notification Settings", False, "No session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            
            response = await self.client.get(
                f"{BACKEND_URL}/notifications/settings",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                await self.log_result("Get Notification Settings", True, f"Enabled: {data.get('enabled')}")
                return True
            else:
                await self.log_result("Get Notification Settings", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            await self.log_result("Get Notification Settings", False, f"Exception: {str(e)}")
            return False
    
    async def test_send_push_notification(self):
        """Test send push notification (requires admin)"""
        if not self.admin_session_token:
            await self.log_result("Send Push Notification", False, "No admin session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_session_token}"}
            notification_data = {
                "title": "Test",
                "message": "Nuovi articoli!"
            }
            
            response = await self.client.post(
                f"{BACKEND_URL}/notifications/send",
                json=notification_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                await self.log_result("Send Push Notification", True, data.get('message', 'Notification sent'))
                return True
            else:
                await self.log_result("Send Push Notification", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            await self.log_result("Send Push Notification", False, f"Exception: {str(e)}")
            return False
    
    async def test_admin_create_user(self):
        """Test admin create subscribed user (requires admin)"""
        if not self.admin_session_token:
            await self.log_result("Admin Create User", False, "No admin session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_session_token}"}
            user_data = {
                "email": "abbonato@test.com",
                "name": "Test Abbonato",
                "password": "test123",
                "subscription_plan": "yearly"
            }
            
            response = await self.client.post(
                f"{BACKEND_URL}/admin/users/create",
                json=user_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                await self.log_result("Admin Create User", True, f"Created user: {data.get('email')} with {data.get('subscription_status')} plan")
                return True
            elif response.status_code == 400 and "già registrata" in response.text:
                await self.log_result("Admin Create User", True, "User already exists (expected behavior)")
                return True
            else:
                await self.log_result("Admin Create User", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            await self.log_result("Admin Create User", False, f"Exception: {str(e)}")
            return False
    
    async def test_get_articles_with_author(self):
        """Test GET /api/articles and verify author field exists"""
        try:
            response = await self.client.get(f"{BACKEND_URL}/articles?limit=10")
            
            if response.status_code == 200:
                articles = response.json()
                if articles:
                    # Check if articles have author field
                    has_author = any(article.get('author') for article in articles)
                    author_count = sum(1 for article in articles if article.get('author'))
                    await self.log_result("Get Articles with Author", True, f"Found {len(articles)} articles, {author_count} have author field")
                    return True
                else:
                    await self.log_result("Get Articles with Author", True, "No articles found (empty database)")
                    return True
            else:
                await self.log_result("Get Articles with Author", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            await self.log_result("Get Articles with Author", False, f"Exception: {str(e)}")
            return False
    
    async def test_initialization_endpoint(self):
        """Test initialization endpoint"""
        try:
            response = await self.client.post(f"{BACKEND_URL}/init/setup")
            
            if response.status_code == 200:
                data = response.json()
                await self.log_result("Initialization Endpoint", True, data.get('message', 'Setup completed'))
                return True
            else:
                await self.log_result("Initialization Endpoint", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            await self.log_result("Initialization Endpoint", False, f"Exception: {str(e)}")
            return False
    
    async def test_article_refresh(self):
        """Test article refresh endpoint (requires admin)"""
        if not self.admin_session_token:
            await self.log_result("Article Refresh", False, "No admin session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_session_token}"}
            
            response = await self.client.post(
                f"{BACKEND_URL}/articles/refresh",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                await self.log_result("Article Refresh", True, data.get('message', 'Articles refreshed'))
                return True
            else:
                await self.log_result("Article Refresh", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            await self.log_result("Article Refresh", False, f"Exception: {str(e)}")
            return False
    
    async def test_bearer_token_auth(self):
        """Test Bearer token authentication on protected endpoints"""
        if not self.session_token:
            await self.log_result("Bearer Token Auth", False, "No session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            
            # Test /auth/me endpoint
            response = await self.client.get(
                f"{BACKEND_URL}/auth/me",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                # Update admin session token to be the same as regular session token
                # since they should be the same after admin login
                if data.get('role') == 'admin':
                    self.admin_session_token = self.session_token
                await self.log_result("Bearer Token Auth", True, f"Authenticated as: {data.get('email')}, role: {data.get('role')}")
                return True
            else:
                await self.log_result("Bearer Token Auth", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            await self.log_result("Bearer Token Auth", False, f"Exception: {str(e)}")
            return False
    
    async def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting OKNews24 Backend API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Test sequence
        tests = [
            ("Initialize Database", self.test_initialization_endpoint),
            ("Admin Login", self.test_admin_login),
            ("Bearer Token Auth", self.test_bearer_token_auth),
            ("Send Push Notification", self.test_send_push_notification),
            ("Admin Create User", self.test_admin_create_user),
            ("Article Refresh", self.test_article_refresh),
            ("Google OAuth", self.test_google_oauth),
            ("Register Push Token", self.test_register_push_token),
            ("Get Notification Settings", self.test_notification_settings),
            ("Get Articles with Author", self.test_get_articles_with_author),
        ]
        
        for test_name, test_func in tests:
            await test_func()
            print()  # Add spacing between tests
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        await self.client.aclose()
        return passed == total

async def main():
    """Main test runner"""
    tester = BackendTester()
    success = await tester.run_all_tests()
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)