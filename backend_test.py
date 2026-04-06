#!/usr/bin/env python3
"""
Backend API Testing for OKNews24 App
Tests all the endpoints mentioned in the review request
"""

import requests
import json
import time
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://oknews24-app.preview.emergentagent.com/api"

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@oknews24.com"
ADMIN_PASSWORD = "admin123"

class OKNews24APITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.admin_token = None
        self.test_results = []
        
    def log_test(self, test_name, success, details="", error=""):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "error": error,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if error:
            print(f"   Error: {error}")
        print()
    
    def test_login(self):
        """Test POST /api/auth/login"""
        print("🔐 Testing Admin Login...")
        
        try:
            response = self.session.post(
                f"{self.base_url}/auth/login",
                json={
                    "email": ADMIN_EMAIL,
                    "password": ADMIN_PASSWORD
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("user_id") and data.get("role") == "admin":
                    # Extract session token from cookies
                    session_token = None
                    for cookie in response.cookies:
                        if cookie.name == "session_token":
                            session_token = cookie.value
                            break
                    
                    if session_token:
                        self.admin_token = session_token
                        self.session.headers.update({"Authorization": f"Bearer {session_token}"})
                        self.log_test("Admin Login", True, f"Logged in as {data.get('name')} ({data.get('email')})")
                        return True
                    else:
                        self.log_test("Admin Login", False, "", "No session token in response")
                        return False
                else:
                    self.log_test("Admin Login", False, "", f"Invalid response data: {data}")
                    return False
            else:
                self.log_test("Admin Login", False, "", f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Admin Login", False, "", str(e))
            return False
    
    def test_init_setup(self):
        """Test POST /api/init/setup"""
        print("🚀 Testing Initial Setup...")
        
        try:
            response = self.session.post(f"{self.base_url}/init/setup")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Initial Setup", True, data.get("message", "Setup completed"))
                return True
            else:
                self.log_test("Initial Setup", False, "", f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Initial Setup", False, "", str(e))
            return False
    
    def test_articles_refresh(self):
        """Test POST /api/articles/refresh (requires admin auth)"""
        print("📰 Testing Articles Refresh...")
        
        if not self.admin_token:
            self.log_test("Articles Refresh", False, "", "No admin token available")
            return False
        
        try:
            # First refresh
            response = self.session.post(f"{self.base_url}/articles/refresh")
            
            if response.status_code == 200:
                data = response.json()
                first_count = data.get("message", "")
                self.log_test("Articles Refresh (First)", True, first_count)
                
                # Wait a moment and refresh again to test duplicate prevention
                time.sleep(2)
                response2 = self.session.post(f"{self.base_url}/articles/refresh")
                
                if response2.status_code == 200:
                    data2 = response2.json()
                    second_count = data2.get("message", "")
                    self.log_test("Articles Refresh (Second)", True, f"Second refresh: {second_count}")
                    return True
                else:
                    self.log_test("Articles Refresh (Second)", False, "", f"HTTP {response2.status_code}: {response2.text}")
                    return False
            else:
                self.log_test("Articles Refresh", False, "", f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Articles Refresh", False, "", str(e))
            return False
    
    def test_get_articles(self):
        """Test GET /api/articles"""
        print("📄 Testing Get Articles...")
        
        try:
            response = self.session.get(f"{self.base_url}/articles")
            
            if response.status_code == 200:
                articles = response.json()
                if isinstance(articles, list):
                    # Check for author field in articles
                    has_author_field = False
                    author_count = 0
                    
                    for article in articles[:10]:  # Check first 10 articles
                        if "author" in article:
                            has_author_field = True
                            if article["author"]:
                                author_count += 1
                    
                    # Check for duplicates by link
                    links = [article.get("link") for article in articles if article.get("link")]
                    unique_links = set(links)
                    has_duplicates = len(links) != len(unique_links)
                    
                    details = f"Found {len(articles)} articles"
                    if has_author_field:
                        details += f", {author_count} with author info"
                    if has_duplicates:
                        details += f", WARNING: {len(links) - len(unique_links)} duplicate links found"
                    
                    success = has_author_field and not has_duplicates
                    self.log_test("Get Articles", success, details)
                    return success
                else:
                    self.log_test("Get Articles", False, "", f"Expected list, got {type(articles)}")
                    return False
            else:
                self.log_test("Get Articles", False, "", f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Articles", False, "", str(e))
            return False
    
    def test_admin_create_user(self):
        """Test POST /api/admin/users/create (requires admin auth)"""
        print("👤 Testing Admin Create User...")
        
        if not self.admin_token:
            self.log_test("Admin Create User", False, "", "No admin token available")
            return False
        
        try:
            # Create a test user with unique email
            timestamp = int(time.time())
            test_user_data = {
                "email": f"test_subscriber_{timestamp}@oknews24.com",
                "name": "Test Subscriber",
                "password": "test123",
                "subscription_plan": "monthly"
            }
            
            response = self.session.post(
                f"{self.base_url}/admin/users/create",
                json=test_user_data
            )
            
            if response.status_code == 200:
                user_data = response.json()
                if (user_data.get("email") == test_user_data["email"] and 
                    user_data.get("subscription_status") == "monthly"):
                    self.log_test("Admin Create User", True, f"Created user: {user_data.get('name')} with {user_data.get('subscription_status')} subscription")
                    
                    # Test duplicate email prevention
                    response2 = self.session.post(
                        f"{self.base_url}/admin/users/create",
                        json=test_user_data
                    )
                    
                    if response2.status_code == 400:
                        self.log_test("Duplicate Email Prevention", True, "Correctly prevented duplicate email")
                    else:
                        self.log_test("Duplicate Email Prevention", False, "", f"Expected 400, got {response2.status_code}")
                    
                    return True
                else:
                    self.log_test("Admin Create User", False, "", f"Invalid user data: {user_data}")
                    return False
            else:
                self.log_test("Admin Create User", False, "", f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Admin Create User", False, "", str(e))
            return False
    
    def test_admin_deduplicate_articles(self):
        """Test POST /api/admin/articles/deduplicate (requires admin auth)"""
        print("🔄 Testing Admin Deduplicate Articles...")
        
        if not self.admin_token:
            self.log_test("Admin Deduplicate Articles", False, "", "No admin token available")
            return False
        
        try:
            response = self.session.post(f"{self.base_url}/admin/articles/deduplicate")
            
            if response.status_code == 200:
                data = response.json()
                message = data.get("message", "")
                self.log_test("Admin Deduplicate Articles", True, message)
                return True
            else:
                self.log_test("Admin Deduplicate Articles", False, "", f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Admin Deduplicate Articles", False, "", str(e))
            return False
    
    def test_auth_endpoints(self):
        """Test additional auth endpoints"""
        print("🔑 Testing Additional Auth Endpoints...")
        
        try:
            # Test /api/auth/me
            if self.admin_token:
                response = self.session.get(f"{self.base_url}/auth/me")
                if response.status_code == 200:
                    user_data = response.json()
                    self.log_test("Get Current User", True, f"User: {user_data.get('name')} ({user_data.get('role')})")
                else:
                    self.log_test("Get Current User", False, "", f"HTTP {response.status_code}: {response.text}")
            
            # Test root endpoint
            response = self.session.get(f"{self.base_url}/")
            if response.status_code == 200:
                data = response.json()
                self.log_test("API Root", True, data.get("message", ""))
            else:
                self.log_test("API Root", False, "", f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Additional Auth Tests", False, "", str(e))
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🧪 Starting OKNews24 Backend API Tests")
        print("=" * 50)
        
        # Test sequence as specified in review request
        tests = [
            self.test_init_setup,
            self.test_login,
            self.test_articles_refresh,
            self.test_get_articles,
            self.test_admin_create_user,
            self.test_admin_deduplicate_articles,
            self.test_auth_endpoints
        ]
        
        for test in tests:
            test()
        
        # Summary
        print("=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        print("\n📋 DETAILED RESULTS:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}")
            if result["details"]:
                print(f"   {result['details']}")
            if result["error"]:
                print(f"   ERROR: {result['error']}")
        
        return passed == total

if __name__ == "__main__":
    tester = OKNews24APITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
    else:
        print("\n⚠️  Some tests failed. Check the details above.")