/**
 * Verification test script for Phase 8: Pipeline List & Creation Wizard
 * Validates:
 * 1. SPA fallback routing for /pipelines and /pipelines/new on Vite dev server
 * 2. Unauthenticated access enforcement (401 Unauthorized)
 * 3. Prerequisite Source & Destination loading and binding
 * 4. Pipeline creation validation:
 *    - Missing required fields (name, sourceId, destinationId) returns 400
 *    - INCREMENTAL mode missing cursorField returns 400
 * 5. Successful FULL sync mode pipeline creation
 * 6. Successful INCREMENTAL sync mode pipeline creation with cursorField
 * 7. Schedule configuration via PUT /api/pipelines/:id/schedule
 * 8. Transformation configuration via PUT /api/pipelines/:id/transform
 * 9. Pipeline listing and status toggle via PUT /api/pipelines/:id
 * 10. Tenant isolation (User B cannot read, update, or delete User A pipelines)
 * 11. Pipeline deletion via DELETE /api/pipelines/:id
 * 12. Complete cleanup of all temporary test resources
 */

const VITE_PORT = 5173;
const VITE_BASE = `http://localhost:${VITE_PORT}`;

const userA = {
  name: 'Phase 8 User A',
  email: `p8_user_a_${Date.now()}@ricozingest.dev`,
  password: 'PasswordPhase8A!'
};

const userB = {
  name: 'Phase 8 User B',
  email: `p8_user_b_${Date.now()}@ricozingest.dev`,
  password: 'PasswordPhase8B!'
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

async function runPhase8Tests() {
  console.log('========================================================');
  console.log('  RICOZINGEST - PHASE 8 PIPELINE VERIFICATION SUITE');
  console.log('========================================================\n');

  // Test 1: SPA Route accessibility for /pipelines and /pipelines/new
  console.log('[TEST 1] Verifying SPA Routes on Vite Dev Server');
  const pipeRouteRes = await fetch(`${VITE_BASE}/pipelines`);
  assert(pipeRouteRes.status === 200, 'GET /pipelines returns HTTP 200');
  const pipeHtml = await pipeRouteRes.text();
  assert(pipeHtml.includes('id="root"'), 'SPA HTML root element present on /pipelines');

  const pipeNewRouteRes = await fetch(`${VITE_BASE}/pipelines/new`);
  assert(pipeNewRouteRes.status === 200, 'GET /pipelines/new returns HTTP 200');
  const pipeNewHtml = await pipeNewRouteRes.text();
  assert(pipeNewHtml.includes('id="root"'), 'SPA HTML root element present on /pipelines/new');

  // Test 2: Unauthenticated protection
  console.log('\n[TEST 2] Verifying Authentication Requirement');
  const unauthRes = await fetch(`${VITE_BASE}/api/pipelines`);
  assert(unauthRes.status === 401, 'GET /api/pipelines without auth returns HTTP 401');

  // Test 3: Authenticate User A
  console.log('\n[TEST 3] Authenticating User A');
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

  // Test 4: Setup prerequisite Source & Destination for User A
  console.log('\n[TEST 4] Creating prerequisite Source & Destination for Pipeline Creation');
  const srcPayload = {
    name: 'P8 Test CSV Source',
    type: 'CSV',
    config: {
      filePath: 'data/sample.csv',
      delimiter: ','
    },
    status: 'ACTIVE'
  };
  const srcRes = await fetch(`${VITE_BASE}/api/sources`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify(srcPayload)
  });
  assert(srcRes.status === 201, 'Created prerequisite CSV Source');
  const srcData = await srcRes.json();
  const testSource = srcData.source;

  const dstPayload = {
    name: 'P8 Test MongoDB Destination',
    type: 'MONGODB',
    config: {
      uri: 'mongodb://127.0.0.1:27017/ricozingest_p8',
      database: 'ricozingest_p8',
      collection: 'p8_sync'
    },
    status: 'ACTIVE'
  };
  const dstRes = await fetch(`${VITE_BASE}/api/destinations`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify(dstPayload)
  });
  assert(dstRes.status === 201, 'Created prerequisite Mongo Destination');
  const dstData = await dstRes.json();
  const testDest = dstData.destination;

  // Test 5: Verify Source and Destination listings
  console.log('\n[TEST 5] Loading Sources & Destinations for Wizard Step 1');
  const getSrcList = await fetch(`${VITE_BASE}/api/sources`, { headers: headersA });
  const srcListData = await getSrcList.json();
  assert(srcListData.sources.some((s) => s.id === testSource.id), 'Wizard can load available sources');

  const getDstList = await fetch(`${VITE_BASE}/api/destinations`, { headers: headersA });
  const dstListData = await getDstList.json();
  assert(dstListData.destinations.some((d) => d.id === testDest.id), 'Wizard can load available destinations');

  // Test 6: Verify Initial Pipeline Listing is empty
  console.log('\n[TEST 6] Initial Pipeline Listing (Empty State)');
  const initPipesRes = await fetch(`${VITE_BASE}/api/pipelines`, { headers: headersA });
  assert(initPipesRes.status === 200, 'GET /api/pipelines returns 200');
  const initPipesData = await initPipesRes.json();
  assert(Array.isArray(initPipesData.pipelines) && initPipesData.pipelines.length === 0, 'User A starts with 0 pipelines');

  // Test 7: Pipeline Creation Validation
  console.log('\n[TEST 7] Pipeline Creation Validation Checks');
  const noNameRes = await fetch(`${VITE_BASE}/api/pipelines`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ sourceId: testSource.id, destinationId: testDest.id, syncMode: 'FULL' })
  });
  assert(noNameRes.status === 400, 'Rejects pipeline with missing name (HTTP 400)');

  const noSrcRes = await fetch(`${VITE_BASE}/api/pipelines`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ name: 'Invalid Pipe', destinationId: testDest.id, syncMode: 'FULL' })
  });
  assert(noSrcRes.status === 400, 'Rejects pipeline with missing sourceId (HTTP 400)');

  const noDstRes = await fetch(`${VITE_BASE}/api/pipelines`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ name: 'Invalid Pipe', sourceId: testSource.id, syncMode: 'FULL' })
  });
  assert(noDstRes.status === 400, 'Rejects pipeline with missing destinationId (HTTP 400)');

  const incNoCursorRes = await fetch(`${VITE_BASE}/api/pipelines`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      name: 'Invalid Incremental',
      sourceId: testSource.id,
      destinationId: testDest.id,
      syncMode: 'INCREMENTAL'
    })
  });
  assert(incNoCursorRes.status === 400, 'Rejects INCREMENTAL sync mode without cursorField (HTTP 400)');

  // Test 8: Create FULL Sync Pipeline
  console.log('\n[TEST 8] Create FULL Sync Pipeline');
  const fullPipePayload = {
    name: 'Customer Full Daily Sync',
    sourceId: testSource.id,
    destinationId: testDest.id,
    syncMode: 'FULL',
    status: 'ACTIVE'
  };
  const createFullRes = await fetch(`${VITE_BASE}/api/pipelines`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify(fullPipePayload)
  });
  assert(createFullRes.status === 201, 'POST /api/pipelines for FULL sync returns 201 Created');
  const createFullData = await createFullRes.json();
  const fullPipe = createFullData.pipeline;
  assert(fullPipe && Boolean(fullPipe.id), 'FULL pipeline created with ID');
  assert(fullPipe.name === fullPipePayload.name, 'Pipeline name matches');
  assert(fullPipe.syncMode === 'FULL', 'syncMode is FULL');
  assert(fullPipe.cursorField === null, 'cursorField is null for FULL sync');
  assert(fullPipe.status === 'ACTIVE', 'status is ACTIVE');
  assert(fullPipe.source.id === testSource.id, 'Populated source ID matches');
  assert(fullPipe.destination.id === testDest.id, 'Populated destination ID matches');

  // Test 9: Create INCREMENTAL Pipeline with cursorField
  console.log('\n[TEST 9] Create INCREMENTAL Pipeline with cursorField');
  const incPipePayload = {
    name: 'Orders Incremental Stream',
    sourceId: testSource.id,
    destinationId: testDest.id,
    syncMode: 'INCREMENTAL',
    cursorField: 'updated_at',
    status: 'ACTIVE'
  };
  const createIncRes = await fetch(`${VITE_BASE}/api/pipelines`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify(incPipePayload)
  });
  assert(createIncRes.status === 201, 'POST /api/pipelines for INCREMENTAL sync returns 201 Created');
  const createIncData = await createIncRes.json();
  const incPipe = createIncData.pipeline;
  assert(incPipe && Boolean(incPipe.id), 'INCREMENTAL pipeline created with ID');
  assert(incPipe.syncMode === 'INCREMENTAL', 'syncMode is INCREMENTAL');
  assert(incPipe.cursorField === 'updated_at', 'cursorField is set to updated_at');

  // Test 10: Configure Schedule via Existing Backend Schedule API
  console.log('\n[TEST 10] Configure Pipeline Schedule (Interval / Cron)');
  const schedPayload = {
    type: 'INTERVAL',
    expression: '30m',
    enabled: true
  };
  const schedRes = await fetch(`${VITE_BASE}/api/pipelines/${incPipe.id}/schedule`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify(schedPayload)
  });
  assert(schedRes.status === 200, 'PUT /api/pipelines/:id/schedule returns 200 OK');
  const schedData = await schedRes.json();
  assert(schedData.schedule.enabled === true, 'Schedule enabled flag is true');
  assert(schedData.schedule.type === 'INTERVAL', 'Schedule type is INTERVAL');
  assert(schedData.schedule.expression === '30m', 'Schedule expression matches');
  assert(Boolean(schedData.schedule.nextRunAt), 'nextRunAt calculated for schedule');

  // Test 11: Configure Transformations via Existing Backend Transformation API
  console.log('\n[TEST 11] Configure Pipeline Transformations');
  const transPayload = {
    enabled: true,
    includeUnmapped: true,
    addMetadata: false,
    fieldMappings: [
      {
        sourceField: 'first_name',
        destinationField: 'firstName',
        transformRule: 'TRIM'
      }
    ]
  };
  const transRes = await fetch(`${VITE_BASE}/api/pipelines/${incPipe.id}/transform`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify(transPayload)
  });
  assert(transRes.status === 200, 'PUT /api/pipelines/:id/transform returns 200 OK');
  const transData = await transRes.json();
  assert(transData.transformations.enabled === true, 'Transformations enabled');
  assert(transData.transformations.fieldMappings.length === 1, 'Field mapping configured');

  // Test 12: Pipeline Listing Verification
  console.log('\n[TEST 12] Verify Pipeline Listing with Multiple Pipelines');
  const listRes = await fetch(`${VITE_BASE}/api/pipelines`, { headers: headersA });
  assert(listRes.status === 200, 'GET /api/pipelines returns 200');
  const listData = await listRes.json();
  assert(listData.pipelines.length === 2, 'User A has 2 pipelines listed');

  // Test 13: Update Pipeline (Status Toggle & Name Edit)
  console.log('\n[TEST 13] Update Pipeline Status & Name via PUT /api/pipelines/:id');
  const updateRes = await fetch(`${VITE_BASE}/api/pipelines/${fullPipe.id}`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({
      name: 'Customer Full Daily Sync - Paused',
      status: 'INACTIVE'
    })
  });
  assert(updateRes.status === 200, 'PUT /api/pipelines/:id returns 200 OK');
  const updateData = await updateRes.json();
  assert(updateData.pipeline.status === 'INACTIVE', 'Pipeline status toggled to INACTIVE');
  assert(updateData.pipeline.name === 'Customer Full Daily Sync - Paused', 'Pipeline name updated');

  // Test 14: Tenant Isolation (User B cannot access or modify User A pipeline)
  console.log('\n[TEST 14] Tenant Isolation Verification');
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

  const bListRes = await fetch(`${VITE_BASE}/api/pipelines`, { headers: headersB });
  const bListData = await bListRes.json();
  assert(bListData.pipelines.length === 0, 'User B pipeline listing is empty (tenant isolated)');

  const bGetRes = await fetch(`${VITE_BASE}/api/pipelines/${fullPipe.id}`, { headers: headersB });
  assert(bGetRes.status === 404, 'User B cannot access User A pipeline by ID (HTTP 404)');

  const bUpdateRes = await fetch(`${VITE_BASE}/api/pipelines/${fullPipe.id}`, {
    method: 'PUT',
    headers: headersB,
    body: JSON.stringify({ name: 'Hacked Name' })
  });
  assert(bUpdateRes.status === 404, 'User B cannot update User A pipeline (HTTP 404)');

  const bDeleteRes = await fetch(`${VITE_BASE}/api/pipelines/${fullPipe.id}`, {
    method: 'DELETE',
    headers: headersB
  });
  assert(bDeleteRes.status === 404, 'User B cannot delete User A pipeline (HTTP 404)');

  // Test 15: Delete Pipelines and Cleanup
  console.log('\n[TEST 15] Delete Pipelines and Prerequisite Resources');
  const delPipe1 = await fetch(`${VITE_BASE}/api/pipelines/${fullPipe.id}`, {
    method: 'DELETE',
    headers: headersA
  });
  assert(delPipe1.status === 200, 'DELETE pipeline 1 returns 200 OK');

  const delPipe2 = await fetch(`${VITE_BASE}/api/pipelines/${incPipe.id}`, {
    method: 'DELETE',
    headers: headersA
  });
  assert(delPipe2.status === 200, 'DELETE pipeline 2 returns 200 OK');

  // Verify deletion
  const verifyDelRes = await fetch(`${VITE_BASE}/api/pipelines/${fullPipe.id}`, { headers: headersA });
  assert(verifyDelRes.status === 404, 'Deleted pipeline no longer exists (HTTP 404)');

  // Cleanup source and destination
  const delSrcRes = await fetch(`${VITE_BASE}/api/sources/${testSource.id}`, {
    method: 'DELETE',
    headers: headersA
  });
  assert(delSrcRes.status === 200, 'Cleaned up test source');

  const delDstRes = await fetch(`${VITE_BASE}/api/destinations/${testDest.id}`, {
    method: 'DELETE',
    headers: headersA
  });
  assert(delDstRes.status === 200, 'Cleaned up test destination');

  console.log('\n========================================================');
  console.log(`  PHASE 8 VERIFICATION: ${passed}/${total} TESTS PASSED`);
  console.log('========================================================\n');
}

runPhase8Tests().catch((err) => {
  console.error('Phase 8 test execution failed:', err);
  process.exit(1);
});
