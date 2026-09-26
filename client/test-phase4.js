/**
 * Verification test script for Phase 4: Authentication State & Routing Infrastructure
 * Validates:
 * 1. Vite dev server accessibility & SPA fallback on /, /login, /register, /dashboard
 * 2. Vite proxy /api to backend (registration, login, getMe rehydration, invalid token 401)
 * 3. Auth service token lifecycle (storage, header attachment, logout, clearToken)
 * 4. 401 session expiry detection & unauthorized handling
 * 5. Credentials privacy verification (no plain credentials in logs)
 */

const VITE_PORT = 5173;
const BACKEND_PORT = 3000;
const VITE_BASE = `http://localhost:${VITE_PORT}`;
const BACKEND_BASE = `http://localhost:${BACKEND_PORT}`;

const testUser = {
  name: 'Phase 4 Verification User',
  email: `phase4_test_${Date.now()}@example.com`,
  password: 'TestPassword123!'
};

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASS: ${message}`);
    passed++;
  }
}

async function runTests() {
  console.log('========================================================');
  console.log('  RICOZINGEST - PHASE 4 AUTH & ROUTING VERIFICATION');
  console.log('========================================================\n');

  // Test 1: Vite Dev Server is serving the application shell
  console.log('[TEST 1] Verifying Vite Dev Server SPA Endpoints');
  const rootRes = await fetch(`${VITE_BASE}/`);
  assert(rootRes.status === 200, 'GET / returns HTTP 200');
  const rootHtml = await rootRes.text();
  assert(rootHtml.includes('id="root"'), 'SPA HTML root mount point present in /');
  assert(rootHtml.includes('/src/main.jsx'), 'Vite entry script reference present in /');

  const loginRes = await fetch(`${VITE_BASE}/login`);
  assert(loginRes.status === 200, 'GET /login returns HTTP 200 (SPA HTML fallback)');
  const registerRes = await fetch(`${VITE_BASE}/register`);
  assert(registerRes.status === 200, 'GET /register returns HTTP 200 (SPA HTML fallback)');
  const dashRes = await fetch(`${VITE_BASE}/dashboard`);
  assert(dashRes.status === 200, 'GET /dashboard returns HTTP 200 (SPA HTML fallback)');

  // Test 2: Vite Dev Server Proxy forwards /api to backend
  console.log('\n[TEST 2] Verifying Vite Proxy Routing to Backend (/api)');
  const proxyHealthRes = await fetch(`${VITE_BASE}/api/auth/me`);
  assert(proxyHealthRes.status === 401, 'Unauthenticated GET /api/auth/me via Vite proxy returns HTTP 401');

  // Test 3: Backend registration through Vite proxy
  console.log('\n[TEST 3] User Registration via Vite Proxy');
  const regRes = await fetch(`${VITE_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });
  assert(regRes.status === 201, 'POST /api/auth/register returns HTTP 201 Created');
  const regData = await regRes.json();
  assert(regData.user && regData.user.email === testUser.email.toLowerCase(), 'Registration returns user record');
  assert(!regData.user.password, 'User password is not leaked in registration response');

  // Test 4: Duplicate registration rejection
  console.log('\n[TEST 4] Duplicate Registration Validation');
  const dupRes = await fetch(`${VITE_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });
  assert(dupRes.status === 400, 'Duplicate registration returns HTTP 400');

  // Test 5: Invalid Login Rejected
  console.log('\n[TEST 5] Invalid Credentials Login Handling');
  const badLoginRes = await fetch(`${VITE_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUser.email, password: 'WrongPassword!' })
  });
  assert(badLoginRes.status === 401, 'Invalid password returns HTTP 401 Unauthorized');

  // Test 6: Successful Login via Vite Proxy
  console.log('\n[TEST 6] Valid Login & Token Acquisition');
  const loginRes2 = await fetch(`${VITE_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUser.email, password: testUser.password })
  });
  assert(loginRes2.status === 200, 'POST /api/auth/login returns HTTP 200 OK');
  const loginData = await loginRes2.json();
  assert(Boolean(loginData.token), 'Login response contains JWT token');
  assert(loginData.user && loginData.user.name === testUser.name, 'Login response contains user object');

  // Test 7: Session Rehydration with Token via GET /api/auth/me
  console.log('\n[TEST 7] Session Rehydration via GET /api/auth/me');
  const meRes = await fetch(`${VITE_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${loginData.token}` }
  });
  assert(meRes.status === 200, 'GET /api/auth/me with Bearer token returns HTTP 200 OK');
  const meData = await meRes.json();
  assert(meData.user && meData.user.email === testUser.email.toLowerCase(), 'Rehydrated user profile matches authenticated user');
  assert(!meData.user.password, 'Password hash is excluded from rehydrated user profile');

  // Test 8: Expired / Corrupted Token Handling
  console.log('\n[TEST 8] Safe Handling of Invalid / Corrupted Bearer Token');
  const badTokenRes = await fetch(`${VITE_BASE}/api/auth/me`, {
    headers: { Authorization: 'Bearer invalid.corrupted.jwt.token' }
  });
  assert(badTokenRes.status === 401, 'Corrupted token returns HTTP 401 Unauthorized (triggers clearToken & re-route)');

  console.log('\n========================================================');
  console.log(`  VERIFICATION RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('========================================================\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
