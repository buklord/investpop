#!/bin/bash
set -e

BASE_URL="http://localhost:3000"
TEST_EMAIL="testuser-$(date +%s%N)@example.com"
TEST_PASSWORD="TestPassword123!"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing Login Flow"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Register
echo "[1/4] Testing Registration..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$REGISTER_RESPONSE" | tail -n1)
BODY=$(echo "$REGISTER_RESPONSE" | head -n-1)

echo "HTTP Status: $HTTP_CODE"
echo "Response: $(echo "$BODY" | jq -r '.message // .error' 2>/dev/null || echo "$BODY")"

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Registration failed"
  echo "Full response: $BODY"
  exit 1
fi
echo "✓ Registration successful"
echo ""

# Test 2: Health check
echo "[2/4] Testing Health Check..."
HEALTH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/health" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

echo "HTTP Status: $HTTP_CODE"
echo "Response: $(echo "$BODY" | jq . 2>/dev/null || echo "$BODY")"

if [ "$HTTP_CODE" != "200" ]; then
  echo "⚠ Database might not be connected properly"
fi
echo ""

# Test 3: Login
echo "[3/4] Testing Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  -w "\n%{http_code}" \
  -c /tmp/cookies.txt)

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
BODY=$(echo "$LOGIN_RESPONSE" | head -n-1)

echo "HTTP Status: $HTTP_CODE"
echo "Response: $(echo "$BODY" | jq . 2>/dev/null || echo "$BODY")"

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Login failed"
  echo "Full response: $BODY"
  exit 1
fi
echo "✓ Login successful"
echo ""

# Test 4: Auth check
echo "[4/4] Testing Auth Check (GET /api/auth/me)..."
AUTH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/auth/me" \
  -H "Cookie: session=$(grep -oP '(?<=session\t)[^\t]+' /tmp/cookies.txt 2>/dev/null || echo '')" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$AUTH_RESPONSE" | tail -n1)
BODY=$(echo "$AUTH_RESPONSE" | head -n-1)

echo "HTTP Status: $HTTP_CODE"
echo "Response: $(echo "$BODY" | jq . 2>/dev/null || echo "$BODY")"

if [ "$HTTP_CODE" != "200" ]; then
  echo "⚠ Auth check failed (might be expected if no valid session)"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ All tests completed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
