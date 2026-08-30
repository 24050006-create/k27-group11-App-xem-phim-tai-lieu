#!/usr/bin/env node
/**
 * Comprehensive API Test Script
 * Tests all TàiLiệu API endpoints
 */

const http = require('http');

const BASE_URL = 'http://192.168.1.4:5000/api';
let jwtToken = null;
let testUserId = 3; // mobiletest3 user

const makeRequest = (method, path, data = null, needsAuth = false) => {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (needsAuth && jwtToken) {
      options.headers.Authorization = `Bearer ${jwtToken}`;
    }

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body),
          });
        } catch {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body,
          });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};

const test = async () => {
  console.log('🧪 TàiLiệu API Test Suite\n');

  try {
    // 1. Health Check
    console.log('1️⃣ Testing /api/health');
    let res = await makeRequest('GET', '/health');
    console.log(`   Status: ${res.status}, Success: ${res.body.success}\n`);

    // 2. Get Categories
    console.log('2️⃣ Testing GET /api/categories');
    res = await makeRequest('GET', '/categories');
    console.log(`   Status: ${res.status}, Categories Count: ${res.body.data.length}\n`);

    // 3. Get Movies
    console.log('3️⃣ Testing GET /api/movies');
    res = await makeRequest('GET', '/movies');
    console.log(`   Status: ${res.status}, Movies Count: ${res.body.data.length}\n`);

    // 4. Login
    console.log('4️⃣ Testing POST /api/auth/login');
    res = await makeRequest('POST', '/auth/login', {
      email: 'mobiletest3@example.com',
      password: '123456',
    });
    console.log(`   Status: ${res.status}, Success: ${res.body.success}`);
    if (res.body.token) {
      jwtToken = res.body.token;
      console.log(`   ✅ JWT Token obtained: ${jwtToken.substring(0, 20)}...\n`);
    } else {
      console.log(`   ❌ No token received\n`);
    }

    // 5. Get Favorites (Protected)
    console.log('5️⃣ Testing GET /api/favorites (Protected)');
    res = await makeRequest('GET', '/favorites', null, true);
    console.log(`   Status: ${res.status}, Success: ${res.body.success}, Favorites: ${res.body.data.length}\n`);

    // 6. Get Movie Detail
    console.log('6️⃣ Testing GET /api/movies/1');
    res = await makeRequest('GET', '/movies/1');
    console.log(`   Status: ${res.status}, Movie Title: ${res.body.data?.title}\n`);

    // 7. Get Comments
    console.log('7️⃣ Testing GET /api/movies/1/comments');
    res = await makeRequest('GET', '/movies/1/comments');
    console.log(`   Status: ${res.status}, Comments Count: ${res.body.data?.length || 0}\n`);

    // 8. Get Watch History (Protected)
    console.log('8️⃣ Testing GET /api/history (Protected)');
    res = await makeRequest('GET', '/history', null, true);
    console.log(`   Status: ${res.status}, Success: ${res.body.success}, History: ${res.body.data.length}\n`);

    // 9. Test Protected Endpoint without Token
    console.log('9️⃣ Testing Protected Endpoint WITHOUT Token (Should Fail)');
    const savedToken = jwtToken;
    jwtToken = null;
    res = await makeRequest('GET', '/favorites', null, true);
    console.log(`   Status: ${res.status}, Expected 401 Unauthorized: ${res.status === 401 ? '✅' : '❌'}\n`);
    jwtToken = savedToken;

    console.log('✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
};

test();
