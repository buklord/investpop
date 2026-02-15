#!/usr/bin/env python3
"""
Quick test for the fixed GET endpoints
"""

import requests
import json

BASE_URL = "https://invest-dash-47.preview.emergentagent.com/api"
TEST_USER_EMAIL = "demo@investdash.com"
TEST_USER_PASSWORD = "password123"

session = requests.Session()
session.headers.update({'Content-Type': 'application/json'})

def test_fixed_endpoints():
    print("Testing fixed GET endpoints...")
    
    # Login first
    login_data = {"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
    login_response = session.post(f"{BASE_URL}/auth/login", json=login_data)
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        return
    
    print("✅ Login successful")
    
    # Test GET watchlist
    watchlist_response = session.get(f"{BASE_URL}/watchlist")
    if watchlist_response.status_code == 200:
        data = watchlist_response.json()
        print(f"✅ GET Watchlist - Found {len(data.get('watchlist', []))} items")
    else:
        print(f"❌ GET Watchlist failed: {watchlist_response.status_code}")
        print(f"Response: {watchlist_response.text[:200]}...")
    
    # Test GET portfolio
    portfolio_response = session.get(f"{BASE_URL}/portfolio")
    if portfolio_response.status_code == 200:
        data = portfolio_response.json()
        print(f"✅ GET Portfolio - Found {len(data.get('positions', []))} positions")
    else:
        print(f"❌ GET Portfolio failed: {portfolio_response.status_code}")
        print(f"Response: {portfolio_response.text[:200]}...")

if __name__ == "__main__":
    test_fixed_endpoints()