#!/usr/bin/env python3
"""
Investment Dashboard Backend API Test Suite
Tests all API endpoints with realistic data
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import os

# Configuration
BASE_URL = "https://invest-dash-47.preview.emergentagent.com/api"
TEST_USER_EMAIL = "demo@investdash.com"
TEST_USER_PASSWORD = "password123"

# Create a session for cookie management
session = requests.Session()
session.headers.update({
    'Content-Type': 'application/json',
    'User-Agent': 'InvestDashboard-BackendTest/1.0'
})

def print_test_result(test_name, success, details=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"   Details: {details}")
    print()

def test_auth_register():
    """Test user registration endpoint"""
    print("=" * 60)
    print("TESTING USER REGISTRATION API")
    print("=" * 60)
    
    # Test with new user
    test_email = f"test-user-{uuid.uuid4().hex[:8]}@investdash.com"
    test_data = {
        "email": test_email,
        "password": "StrongPassword123!"
    }
    
    try:
        response = session.post(f"{BASE_URL}/auth/register", json=test_data)
        success = response.status_code == 200
        
        if success:
            data = response.json()
            print_test_result("User Registration - New User", success, 
                            f"User created: {data.get('user', {}).get('email')}")
            
            # Check if session cookie was set
            has_session = 'session' in session.cookies
            print_test_result("Session Cookie Set on Registration", has_session)
            
        else:
            print_test_result("User Registration - New User", success, 
                            f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("User Registration - New User", False, f"Error: {str(e)}")
    
    # Test duplicate email registration
    try:
        response = session.post(f"{BASE_URL}/auth/register", json=test_data)
        expected_failure = response.status_code == 400
        print_test_result("User Registration - Duplicate Email Rejection", expected_failure,
                        f"Status: {response.status_code}")
    except Exception as e:
        print_test_result("User Registration - Duplicate Email Rejection", False, f"Error: {str(e)}")

def test_auth_login():
    """Test user login endpoint"""
    print("=" * 60)
    print("TESTING USER LOGIN API")
    print("=" * 60)
    
    # Clear any existing session
    session.cookies.clear()
    
    # Test valid login
    login_data = {
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    }
    
    try:
        response = session.post(f"{BASE_URL}/auth/login", json=login_data)
        success = response.status_code == 200
        
        if success:
            data = response.json()
            print_test_result("User Login - Valid Credentials", success, 
                            f"User: {data.get('user', {}).get('email')}")
            
            # Check if session cookie was set
            has_session = 'session' in session.cookies
            print_test_result("Session Cookie Set on Login", has_session)
        else:
            print_test_result("User Login - Valid Credentials", success, 
                            f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("User Login - Valid Credentials", False, f"Error: {str(e)}")
    
    # Test invalid credentials
    try:
        invalid_data = {"email": TEST_USER_EMAIL, "password": "wrongpassword"}
        response = session.post(f"{BASE_URL}/auth/login", json=invalid_data)
        expected_failure = response.status_code == 401
        print_test_result("User Login - Invalid Credentials Rejection", expected_failure,
                        f"Status: {response.status_code}")
    except Exception as e:
        print_test_result("User Login - Invalid Credentials Rejection", False, f"Error: {str(e)}")

def test_auth_me():
    """Test get current user endpoint"""
    print("=" * 60)
    print("TESTING GET CURRENT USER API")
    print("=" * 60)
    
    try:
        response = session.get(f"{BASE_URL}/auth/me")
        success = response.status_code == 200
        
        if success:
            data = response.json()
            user = data.get('user', {})
            print_test_result("Get Current User - Authenticated", success, 
                            f"User ID: {user.get('id')}, Email: {user.get('email')}")
        else:
            print_test_result("Get Current User - Authenticated", success, 
                            f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("Get Current User - Authenticated", False, f"Error: {str(e)}")

def test_assets_endpoints():
    """Test assets management endpoints"""
    print("=" * 60)
    print("TESTING ASSETS ENDPOINTS")
    print("=" * 60)
    
    # Test assets seeding
    try:
        response = session.post(f"{BASE_URL}/assets/seed")
        success = response.status_code == 200
        print_test_result("Assets Seeding", success, 
                        f"Status: {response.status_code}")
    except Exception as e:
        print_test_result("Assets Seeding", False, f"Error: {str(e)}")
    
    # Test get all assets
    try:
        response = session.get(f"{BASE_URL}/assets")
        success = response.status_code == 200
        
        if success:
            data = response.json()
            assets = data.get('assets', [])
            stock_count = len([a for a in assets if a.get('type') == 'stock'])
            crypto_count = len([a for a in assets if a.get('type') == 'crypto'])
            print_test_result("Get All Assets", success, 
                            f"Total: {len(assets)} assets ({stock_count} stocks, {crypto_count} crypto)")
            return assets
        else:
            print_test_result("Get All Assets", success, 
                            f"Status: {response.status_code}, Response: {response.text}")
            return []
    except Exception as e:
        print_test_result("Get All Assets", False, f"Error: {str(e)}")
        return []

def test_quote_endpoint():
    """Test market quote endpoint"""
    print("=" * 60)
    print("TESTING QUOTE API")
    print("=" * 60)
    
    # Test stock quote
    try:
        response = session.get(f"{BASE_URL}/quote?symbol=AAPL&type=stock")
        success = response.status_code == 200
        
        if success:
            data = response.json()
            print_test_result("Stock Quote - AAPL", success, 
                            f"Price: ${data.get('price', 'N/A')}, Symbol: {data.get('symbol')}")
        else:
            print_test_result("Stock Quote - AAPL", success, 
                            f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("Stock Quote - AAPL", False, f"Error: {str(e)}")
    
    # Test crypto quote
    try:
        response = session.get(f"{BASE_URL}/quote?symbol=BTCUSD&type=crypto")
        success = response.status_code == 200
        
        if success:
            data = response.json()
            print_test_result("Crypto Quote - BTCUSD", success, 
                            f"Price: ${data.get('price', 'N/A')}, Symbol: {data.get('symbol')}")
        else:
            print_test_result("Crypto Quote - BTCUSD", success, 
                            f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("Crypto Quote - BTCUSD", False, f"Error: {str(e)}")

def test_watchlist_endpoints(available_assets):
    """Test watchlist CRUD operations"""
    print("=" * 60)
    print("TESTING WATCHLIST CRUD APIs")
    print("=" * 60)
    
    if not available_assets:
        print_test_result("Watchlist Tests", False, "No assets available for testing")
        return []
    
    # Get initial watchlist
    try:
        response = session.get(f"{BASE_URL}/watchlist")
        success = response.status_code == 200
        
        if success:
            data = response.json()
            watchlist = data.get('watchlist', [])
            print_test_result("Get Watchlist - Initial", success, 
                            f"Found {len(watchlist)} items")
        else:
            print_test_result("Get Watchlist - Initial", success, 
                            f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("Get Watchlist - Initial", False, f"Error: {str(e)}")
    
    # Add assets to watchlist
    added_items = []
    test_assets = available_assets[:3]  # Test with first 3 assets
    
    for asset in test_assets:
        try:
            add_data = {"assetId": asset['id']}
            response = session.post(f"{BASE_URL}/watchlist", json=add_data)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                added_items.append({
                    'id': data.get('id'),
                    'asset': asset
                })
                print_test_result(f"Add to Watchlist - {asset['symbol']}", success, 
                                f"Asset: {asset['name']}")
            else:
                print_test_result(f"Add to Watchlist - {asset['symbol']}", success, 
                                f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            print_test_result(f"Add to Watchlist - {asset['symbol']}", False, f"Error: {str(e)}")
    
    # Get updated watchlist
    try:
        response = session.get(f"{BASE_URL}/watchlist")
        success = response.status_code == 200
        
        if success:
            data = response.json()
            watchlist = data.get('watchlist', [])
            print_test_result("Get Watchlist - After Adding", success, 
                            f"Found {len(watchlist)} items")
        else:
            print_test_result("Get Watchlist - After Adding", success, 
                            f"Status: {response.status_code}")
    except Exception as e:
        print_test_result("Get Watchlist - After Adding", False, f"Error: {str(e)}")
    
    return added_items

def test_portfolio_endpoints(available_assets, watchlist_items):
    """Test portfolio CRUD operations"""
    print("=" * 60)
    print("TESTING PORTFOLIO CRUD APIs")
    print("=" * 60)
    
    if not available_assets:
        print_test_result("Portfolio Tests", False, "No assets available for testing")
        return []
    
    # Get initial portfolio
    try:
        response = session.get(f"{BASE_URL}/portfolio")
        success = response.status_code == 200
        
        if success:
            data = response.json()
            positions = data.get('positions', [])
            print_test_result("Get Portfolio - Initial", success, 
                            f"Found {len(positions)} positions")
        else:
            print_test_result("Get Portfolio - Initial", success, 
                            f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print_test_result("Get Portfolio - Initial", False, f"Error: {str(e)}")
    
    # Add positions
    added_positions = []
    test_assets = available_assets[:2]  # Test with first 2 assets
    
    for i, asset in enumerate(test_assets):
        try:
            position_data = {
                "assetId": asset['id'],
                "quantity": 10.5 + i,  # Different quantities
                "entryPrice": 150.75 + (i * 25),  # Different entry prices
                "entryDate": (datetime.now() - timedelta(days=i*30)).strftime("%Y-%m-%d")
            }
            
            response = session.post(f"{BASE_URL}/portfolio", json=position_data)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                added_positions.append({
                    'id': data.get('id'),
                    'asset': asset,
                    'position_data': position_data
                })
                print_test_result(f"Add Portfolio Position - {asset['symbol']}", success, 
                                f"Quantity: {position_data['quantity']}, Entry: ${position_data['entryPrice']}")
            else:
                print_test_result(f"Add Portfolio Position - {asset['symbol']}", success, 
                                f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            print_test_result(f"Add Portfolio Position - {asset['symbol']}", False, f"Error: {str(e)}")
    
    # Get updated portfolio
    try:
        response = session.get(f"{BASE_URL}/portfolio")
        success = response.status_code == 200
        
        if success:
            data = response.json()
            positions = data.get('positions', [])
            print_test_result("Get Portfolio - After Adding", success, 
                            f"Found {len(positions)} positions")
        else:
            print_test_result("Get Portfolio - After Adding", success, 
                            f"Status: {response.status_code}")
    except Exception as e:
        print_test_result("Get Portfolio - After Adding", False, f"Error: {str(e)}")
    
    # Test updating a position (if we have any)
    if added_positions:
        position_to_update = added_positions[0]
        try:
            update_data = {
                "quantity": 20.0,
                "entryPrice": 200.0
            }
            
            response = session.put(f"{BASE_URL}/portfolio/{position_to_update['id']}", json=update_data)
            success = response.status_code == 200
            
            print_test_result(f"Update Portfolio Position - {position_to_update['asset']['symbol']}", 
                            success, f"New quantity: {update_data['quantity']}")
        except Exception as e:
            print_test_result(f"Update Portfolio Position - {position_to_update['asset']['symbol']}", 
                            False, f"Error: {str(e)}")
    
    return added_positions

def test_cleanup_operations(watchlist_items, portfolio_positions):
    """Test delete operations for cleanup"""
    print("=" * 60)
    print("TESTING DELETE OPERATIONS")
    print("=" * 60)
    
    # Delete portfolio positions
    for position in portfolio_positions:
        try:
            response = session.delete(f"{BASE_URL}/portfolio/{position['id']}")
            success = response.status_code == 200
            print_test_result(f"Delete Portfolio Position - {position['asset']['symbol']}", success)
        except Exception as e:
            print_test_result(f"Delete Portfolio Position - {position['asset']['symbol']}", 
                            False, f"Error: {str(e)}")
    
    # Delete watchlist items
    for item in watchlist_items:
        try:
            response = session.delete(f"{BASE_URL}/watchlist/{item['id']}")
            success = response.status_code == 200
            print_test_result(f"Delete Watchlist Item - {item['asset']['symbol']}", success)
        except Exception as e:
            print_test_result(f"Delete Watchlist Item - {item['asset']['symbol']}", 
                            False, f"Error: {str(e)}")

def test_auth_logout():
    """Test user logout endpoint"""
    print("=" * 60)
    print("TESTING USER LOGOUT API")
    print("=" * 60)
    
    try:
        response = session.post(f"{BASE_URL}/auth/logout")
        success = response.status_code == 200
        print_test_result("User Logout", success, f"Status: {response.status_code}")
        
        # Verify session is cleared by trying to access protected endpoint
        me_response = session.get(f"{BASE_URL}/auth/me")
        session_cleared = me_response.status_code == 401
        print_test_result("Session Cleared After Logout", session_cleared, 
                        f"/auth/me status: {me_response.status_code}")
    except Exception as e:
        print_test_result("User Logout", False, f"Error: {str(e)}")

def main():
    """Run all backend API tests"""
    print("🚀 Investment Dashboard Backend API Testing Started")
    print(f"📍 Base URL: {BASE_URL}")
    print(f"👤 Test User: {TEST_USER_EMAIL}")
    print()
    
    # Step 1: Test authentication
    test_auth_register()
    test_auth_login()
    test_auth_me()
    
    # Step 2: Test data endpoints  
    available_assets = test_assets_endpoints()
    test_quote_endpoint()
    
    # Step 3: Test authenticated CRUD operations
    watchlist_items = test_watchlist_endpoints(available_assets)
    portfolio_positions = test_portfolio_endpoints(available_assets, watchlist_items)
    
    # Step 4: Test cleanup operations
    test_cleanup_operations(watchlist_items, portfolio_positions)
    
    # Step 5: Test logout
    test_auth_logout()
    
    print("✅ All Backend API Tests Completed!")
    print()
    print("📊 Summary:")
    print("- Authentication endpoints tested")
    print("- Market data endpoints tested") 
    print("- Asset management tested")
    print("- Watchlist CRUD operations tested")
    print("- Portfolio CRUD operations tested")
    print("- Session management tested")

if __name__ == "__main__":
    main()