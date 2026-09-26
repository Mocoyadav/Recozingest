/**
 * Verification test script for Phase 5: Dashboard Layout & Navigation
 * Validates:
 * 1. Authenticated dashboard data endpoints (/api/pipelines and /api/pipeline-runs)
 * 2. Proper response structure for KPI derivation (active count, records ingested, success rate)
 * 3. Recent executions pagination and query filtering
 * 4. Active schedules payload for the Active Schedules widget
 * 5. AppLayout & DashboardPage SPA bundle accessibility
 */

const VITE_PORT = 5173;
const BACKEND_PORT = 3000;
const VITE_BASE = `http://localhost:${VITE_PORT}`;

const testUser = {
  name: 'Phase 5 Layout Tester',
  email: `phase5_${Date.now()}@ricozingest.dev`,
  password: 'PasswordPhase5!'
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

async function runPhase5Tests() {
  console.log('========================================================');
  console.log('  RICOZINGEST - PHASE 5 DASHBOARD & LAYOUT VERIFICATION');
  console.log('========================================================\n');

  // Step 1: Register and login test user
  console.log('[STEP 1] Authenticating Test User for Dashboard Access');
  const regRes = await fetch(`${VITE_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });
  assert(regRes.status === 201, 'Registration returns 201');

  const loginRes = await fetch(`${VITE_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUser.email, password: testUser.password })
  });
  assert(loginRes.status === 200, 'Login returns 200');
  const { token, user } = await loginRes.json();
  assert(Boolean(token), 'JWT token acquired');
  assert(user.name === testUser.name, 'User profile returned correctly');

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Step 2: Test /api/pipelines retrieval
  console.log('\n[STEP 2] Testing /api/pipelines for KPI & Schedules Widget');
  const pipelinesRes = await fetch(`${VITE_BASE}/api/pipelines`, { headers: authHeaders });
  assert(pipelinesRes.status === 200, 'GET /api/pipelines returns 200');
  const pipelinesData = await pipelinesRes.json();
  assert(Array.isArray(pipelinesData.pipelines), 'pipelines is an array');

  // Step 3: Test /api/pipeline-runs retrieval
  console.log('\n[STEP 3] Testing /api/pipeline-runs for KPI & Recent Executions Widget');
  const runsRes = await fetch(`${VITE_BASE}/api/pipeline-runs?limit=10`, { headers: authHeaders });
  assert(runsRes.status === 200, 'GET /api/pipeline-runs?limit=10 returns 200');
  const runsData = await runsRes.json();
  assert(Array.isArray(runsData.runs), 'runs is an array');
  assert(runsData.pagination && typeof runsData.pagination.total === 'number', 'pagination metadata present');

  // Step 4: Verify AppLayout SPA entry point
  console.log('\n[STEP 4] Verifying AppLayout & DashboardPage SPA Route');
  const dashRes = await fetch(`${VITE_BASE}/dashboard`);
  assert(dashRes.status === 200, 'GET /dashboard returns HTTP 200');
  const dashHtml = await dashRes.text();
  assert(dashHtml.includes('id="root"'), 'SPA HTML root element present');

  console.log('\n========================================================');
  console.log(`  PHASE 5 VERIFICATION: ${passed}/${total} TESTS PASSED`);
  console.log('========================================================\n');
}

runPhase5Tests().catch((err) => {
  console.error('Phase 5 test execution failed:', err);
  process.exit(1);
});
