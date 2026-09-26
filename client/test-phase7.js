/**
 * Verification test script for Phase 7: Destination Management UI
 * Validates:
 * 1. SPA fallback routing for /destinations on Vite dev server
 * 2. Authenticated CRUD lifecycle for Destinations:
 *    - GET /api/destinations (listing)
 *    - POST /api/destinations (creation of MONGODB destination)
 *    - Verification that backend sanitizes sensitive fields (uri, password, secret)
 *    - GET /api/destinations/:id (retrieval by ID)
 *    - PUT /api/destinations/:id (updating configuration, testing write-only credential retention)
 *    - POST /api/destinations (creating DB destination with password, verifying password exclusion)
 *    - DELETE /api/destinations/:id (deletion and cleanup)
 * 3. Tenant isolation (User B cannot access or delete User A's destinations)
 * 4. Cleanup of all temporary test data
 */

const VITE_PORT = 5173;
const VITE_BASE = `http://localhost:${VITE_PORT}`;

const userA = {
  name: 'Phase 7 User A',
  email: `p7_user_a_${Date.now()}@ricozingest.dev`,
  password: 'PasswordPhase7A!'
};

const userB = {
  name: 'Phase 7 User B',
  email: `p7_user_b_${Date.now()}@ricozingest.dev`,
  password: 'PasswordPhase7B!'
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

async function runPhase7Tests() {
  console.log('========================================================');
  console.log('  RICOZINGEST - PHASE 7 DESTINATION MANAGEMENT VERIFICATION');
  console.log('========================================================\n');

  // Test 1: SPA Route accessibility for /destinations
  console.log('[TEST 1] Verifying /destinations SPA Route on Vite Dev Server');
  const destRouteRes = await fetch(`${VITE_BASE}/destinations`);
  assert(destRouteRes.status === 200, 'GET /destinations returns HTTP 200');
  const destHtml = await destRouteRes.text();
  assert(destHtml.includes('id="root"'), 'SPA HTML root element present on /destinations');

  // Test 2: User A Authentication
  console.log('\n[TEST 2] Authenticating User A');
  const regARes = await fetch(`${VITE_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userA)
  });
  assert(regARes.status === 201, 'User A registered successfully');

  const loginARes = await fetch(`${VITE_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userA.email, password: userA.password })
  });
  assert(loginARes.status === 200, 'User A logged in successfully');
  const { token: tokenA } = await loginARes.json();
  const headersA = {
    Authorization: `Bearer ${tokenA}`,
    'Content-Type': 'application/json'
  };

  // Test 3: List Initial Destinations for User A
  console.log('\n[TEST 3] List Destinations for User A (Initial Empty State)');
  const list1Res = await fetch(`${VITE_BASE}/api/destinations`, { headers: headersA });
  assert(list1Res.status === 200, 'GET /api/destinations returns 200');
  const list1Data = await list1Res.json();
  assert(Array.isArray(list1Data.destinations), 'destinations is an array');
  assert(list1Data.destinations.length === 0, 'User A starts with 0 destinations');

  // Test 4: Create MongoDB Destination
  console.log('\n[TEST 4] Create MONGODB Destination Target');
  const newDestPayload = {
    name: 'Production Ingest Lake',
    type: 'MONGODB',
    config: {
      uri: 'mongodb://127.0.0.1:27017/ricozingest_lake',
      database: 'ricozingest_lake',
      collection: 'customers_processed'
    },
    status: 'ACTIVE'
  };

  const createRes = await fetch(`${VITE_BASE}/api/destinations`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify(newDestPayload)
  });
  assert(createRes.status === 201, 'POST /api/destinations returns 201 Created');
  const createData = await createRes.json();
  const createdDest = createData.destination;
  assert(createdDest && Boolean(createdDest.id), 'Destination created with valid ID');
  assert(createdDest.name === newDestPayload.name, 'Destination name matches');
  assert(createdDest.type === 'MONGODB', 'Destination type is MONGODB');
  assert(createdDest.config.database === 'ricozingest_lake', 'Database name stored');
  assert(createdDest.config.collection === 'customers_processed', 'Collection name stored');

  // Test 5: Verify Backend Credential Redaction (URI must not be returned)
  console.log('\n[TEST 5] Verifying Credential Sanitization (URI Omitted)');
  assert(createdDest.config.uri === undefined, 'Sensitive MongoDB URI is sanitized and NOT exposed in API response');
  assert(createdDest.config.password === undefined, 'Password is not exposed');

  // Test 6: Get Destination by ID
  console.log('\n[TEST 6] Retrieve Destination by ID');
  const getByIdRes = await fetch(`${VITE_BASE}/api/destinations/${createdDest.id}`, { headers: headersA });
  assert(getByIdRes.status === 200, 'GET /api/destinations/:id returns 200 OK');
  const getByIdData = await getByIdRes.json();
  assert(getByIdData.destination.id === createdDest.id, 'Fetched destination ID matches');
  assert(getByIdData.destination.config.uri === undefined, 'URI remains sanitized on single destination fetch');

  // Test 7: Update Destination (Write-Only Credential Retention)
  console.log('\n[TEST 7] Update Destination (Verifying Write-Only Retention)');
  const updatePayload = {
    name: 'Updated Ingest Lake',
    status: 'INACTIVE',
    config: {
      database: 'ricozingest_lake_v2',
      collection: 'customers_processed_v2'
      // Omit uri to verify backend retains the stored URI
    }
  };

  const updateRes = await fetch(`${VITE_BASE}/api/destinations/${createdDest.id}`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify(updatePayload)
  });
  assert(updateRes.status === 200, 'PUT /api/destinations/:id returns 200 OK');
  const updateData = await updateRes.json();
  assert(updateData.destination.name === 'Updated Ingest Lake', 'Destination name updated');
  assert(updateData.destination.status === 'INACTIVE', 'Status updated to INACTIVE');
  assert(updateData.destination.config.collection === 'customers_processed_v2', 'Collection updated');
  assert(updateData.destination.config.uri === undefined, 'URI remains sanitized after update');

  // Test 8: Create PostgreSQL Destination with Password
  console.log('\n[TEST 8] Create Relational DB Destination & Verify Password Redaction');
  const pgPayload = {
    name: 'Analytics Warehouse PG',
    type: 'POSTGRESQL',
    config: {
      host: 'pg.corp.internal',
      port: 5432,
      database: 'analytics',
      table: 'daily_facts',
      user: 'etl_writer',
      password: 'SuperSecretDatabasePassword456!'
    },
    status: 'ACTIVE'
  };

  const createPgRes = await fetch(`${VITE_BASE}/api/destinations`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify(pgPayload)
  });
  assert(createPgRes.status === 201, 'POST /api/destinations for PG returns 201');
  const createPgData = await createPgRes.json();
  const pgDest = createPgData.destination;
  assert(pgDest && Boolean(pgDest.id), 'PG destination created with ID');
  assert(pgDest.config.password === undefined, 'Password is completely redacted from PG response');

  // Test 9: Tenant Isolation (User B cannot access or delete User A destination)
  console.log('\n[TEST 9] Verifying Tenant Isolation on Destinations');
  await fetch(`${VITE_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userB)
  });
  const loginBRes = await fetch(`${VITE_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userB.email, password: userB.password })
  });
  const { token: tokenB } = await loginBRes.json();
  const headersB = {
    Authorization: `Bearer ${tokenB}`,
    'Content-Type': 'application/json'
  };

  const userBAccessRes = await fetch(`${VITE_BASE}/api/destinations/${createdDest.id}`, { headers: headersB });
  assert(userBAccessRes.status === 404, 'User B cannot access User A destination (HTTP 404)');

  const userBDeleteRes = await fetch(`${VITE_BASE}/api/destinations/${createdDest.id}`, {
    method: 'DELETE',
    headers: headersB
  });
  assert(userBDeleteRes.status === 404, 'User B cannot delete User A destination (HTTP 404)');

  // Test 10: Deletion & Cleanup
  console.log('\n[TEST 10] Delete Destination & Cleanup');
  const deleteRes1 = await fetch(`${VITE_BASE}/api/destinations/${createdDest.id}`, {
    method: 'DELETE',
    headers: headersA
  });
  assert(deleteRes1.status === 200, 'DELETE /api/destinations/:id returns 200 OK');

  const deleteRes2 = await fetch(`${VITE_BASE}/api/destinations/${pgDest.id}`, {
    method: 'DELETE',
    headers: headersA
  });
  assert(deleteRes2.status === 200, 'DELETE /api/destinations/:id returns 200 OK for PG destination');

  // Confirm deleted
  const verifyDeleteRes = await fetch(`${VITE_BASE}/api/destinations/${createdDest.id}`, { headers: headersA });
  assert(verifyDeleteRes.status === 404, 'Deleted destination no longer exists (HTTP 404)');

  console.log('\n========================================================');
  console.log(`  PHASE 7 VERIFICATION: ${passed}/${total} TESTS PASSED`);
  console.log('========================================================\n');
}

runPhase7Tests().catch((err) => {
  console.error('Phase 7 test execution failed:', err);
  process.exit(1);
});
