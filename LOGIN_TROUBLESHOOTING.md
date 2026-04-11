# Login Troubleshooting Guide

## Current Status ✓
- ✓ API registration endpoint working
- ✓ API login endpoint working  
- ✓ Database connection working
- ✓ Response format is valid JSON
- ✓ Authentication flow complete

## The Issue
You're seeing: "Server error. Please restart the dev server and try again."

This message appears when the browser receives a non-JSON response (typically an HTML error page).

## Troubleshooting Steps

### Step 1: Clear Browser Cache
1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. Clear **Cookies** for localhost:3000
4. Clear **LocalStorage**
5. Clear **SessionStorage**
6. Hard reload the page (Ctrl+Shift+R or Cmd+Shift+R)

### Step 2: Check Browser Console
1. Open Chrome DevTools (F12)
2. Go to **Console** tab
3. Try logging in and check for JavaScript errors
4. Screenshot any red errors and share them

### Step 3: Check Network Tab
1. Open Chrome DevTools (F12)
2. Go to **Network** tab
3. Clear the network log
4. Click the email field and type: `test@example.com`
5. Type password
6. Click "Log In" button
7. Find the POST request to `/api/auth/login`
8. Click on it and check:
   - **Headers** tab: Verify Content-Type is `application/json`
   - **Request Body** tab: Verify email and password are sent
   - **Response** tab: What does the server return?
   - **Response Header** tab: Check Content-Type

### Step 4: Test with Development Tools
Open a terminal and run this test command:

```bash
curl -X POST http://localhost:3000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"emeka@gmail.com","password":"password123"}' \\
  -v
```

If this works but the browser doesn't, it's a frontend JavaScript issue.

### Step 5: Check Frontend Code
The error message comes from `app/page.js` line 153:
- The API response is not valid JSON
- This usually means an unhandled exception throws

Possible causes:
1. **CORS issue** — Check DevTools console for CORS errors
2. **Invalid Content-Type** — Browser might not be sending `application/json`
3. **Request body formatting** — Password/email not being encoded properly
4. **JavaScript error** — Check the handleSubmit function in page.js

## Quick Fix Attempts

### Try These:

1. **Hard reload the browser:**
   ```bash
   # Close browser completely
   # Reopen http://localhost:3000
   # Try login again
   ```

2. **Clear everything and restart dev server:**
   ```bash
   # In terminal at project root:
   npm run dev
   
   # Then in browser, hard reload (Ctrl+Shift+R)
   ```

3. **Use Incognito/Private mode:**
   - Open Chrome in Incognito mode
   - Go to http://localhost:3000
   - Try registering and logging in fresh
   - This bypasses all browser cache

4. **Check for JavaScript errors:**
   - Open page.js and look at the handleSubmit function
   - Verify it's properly catching and handling responses

## If None of These Work

Please provide:
1. Screenshot of Chrome DevTools Network tab showing the failed `/api/auth/login` POST request
2. Screenshot of the Response tab of that request
3. Any red errors in the Console tab  
4. The output of running the test_login_flow.sh script:
   ```bash
   ./test_login_flow.sh
   ```

## Environment Setup

Your environment is configured correctly:
- DATABASE: Connected ✓
- SESSION_SECRET: Configured ✓  
- API: Working ✓
- Next.js: Ready ✓

The issue is either:
1. Browser-side (cache, cookies, JavaScript error)
2. CORS headers not being passed correctly
3. Request body not being sent properly

**The backend is working fine!**
