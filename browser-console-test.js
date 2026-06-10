// 🔧 Browser Console Debug Script
// Copy and paste this into your browser console to test the login API

console.log('%c🔍 Testing Vaultquokka Login API', 'font-size: 16px; color: #00ff00; font-weight: bold');

(async () => {
  try {
    console.log('📧 Testing with: emeka@gmail.com');
    
    // Test 1: Check if fetch works
    console.log('');
    console.log('%c1️⃣ Testing API endpoint...', 'font-size: 14px; color: #ffff00; font-weight: bold');
    
    const loginResponse = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'emeka@gmail.com',
        password: 'password123'
      })
    });

    console.log('✓ Fetch successful');
    console.log('  Status:', loginResponse.status);
    console.log('  Headers:');
    console.log('    Content-Type:', loginResponse.headers.get('Content-Type'));
    console.log('    Content-Length:', loginResponse.headers.get('Content-Length'));

    // Check if response is JSON
    const contentType = loginResponse.headers.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('❌ ERROR: Response is not JSON!');
      console.error('  Content-Type:', contentType);
      const text = await loginResponse.text();
      console.error('  Response body:', text.substring(0, 500));
      return;
    }

    // Parse JSON
    console.log('');
    console.log('%c2️⃣ Parsing response...', 'font-size: 14px; color: #ffff00; font-weight: bold');
    const data = await loginResponse.json();
    console.log('✓ JSON parsed successfully');
    console.log('  Response:', data);

    // Check for error or success
    console.log('');
    console.log('%c3️⃣ Checking result...', 'font-size: 14px; color: #ffff00; font-weight: bold');
    if (loginResponse.ok) {
      console.log('%c✅ LOGIN SUCCESSFUL!', 'font-size: 14px; color: #00ff00; font-weight: bold');
      console.log('  User ID:', data.user.id);
      console.log('  Email:', data.user.email);
    } else {
      console.log('%c⚠️ Login failed with status ' + loginResponse.status, 'font-size: 14px; color: #ff6600; font-weight: bold');
      console.log('  Error:', data.error);
    }

    // Check if cookie was set
    console.log('');
    console.log('%c4️⃣ Checking cookies...', 'font-size: 14px; color: #ffff00; font-weight: bold');
    const cookies = document.cookie;
    if (cookies.includes('session')) {
      console.log('%c✅ Session cookie found!', 'font-size: 12px; color: #00ff00');
    } else {
      console.log('%c⚠️ No session cookie found', 'font-size: 12px; color: #ff6600');
    }

  } catch (error) {
    console.error('%c❌ ERROR:', 'font-size: 14px; color: #ff0000; font-weight: bold', error);
    console.error('  Details:', error.message);
  }
})();

console.log('');
console.log('%c⏳ Check the output above for any ❌ errors', 'font-size: 12px; color: #ffffff');
