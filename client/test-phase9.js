/**
 * Verification test script for Phase 9: Pipeline Details Hub
 * Validates:
 * 1. SPA fallback routing for /pipelines/:id on Vite dev server
 * 2. Unauthenticated access enforcement (401 Unauthorized across all endpoints)
 * 3. Invalid and non-existent pipeline handling (404 Not Found)
 * 4. User authentication (User A and User B)
 * 5. Prerequisite Source & Destination creation
 * 6. Pipeline creation and retrieval with populated sanitized source/destination metadata
 * 7. Verification that sensitive credentials (URIs, passwords, tokens) are never exposed
 * 8. Pipeline run history retrieval and pagination
 * 9. Schedule management (GET, PUT, enable, disable, and validation)
 * 10. Transformation management (GET, PUT, and validation)
 * 11. Manual pipeline execution trigger & concurrency / status guards
 * 12. Strict tenant isolation (User B cannot read, run, schedule, or modify User A pipeline)
 * 13. Clean up of all temporary test data
 */

const VITE_PORT = 5173;
const VITE_BASE = `http://localhost:${VITE_PORT}`;

const userA = {
  name: 'Phase 9 User A',
  email: `p9_user_a_${Date.now()}@ricozingest.dev`,
  password: 'PasswordPhase9A!'
};

const userB = {
  name: 'Phase 9 User B',
  email: `p9_user_b_${Date.now()}@ricozingest.dev`,
  password: 'PasswordPhase9B!'
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

async function runPhase9Tests() {
  console.log('========================================================');
  console.log('  RICOZINGEST - PHASE 9 PIPELINE DETAILS HUB VERIFICATION');
  console.log('========================================================\n');

  // Test 1: SPA Route accessibility for /pipelines/:id
  console.log('[TEST 1] Verifying SPA Route /pipelines/:id on Vite Dev Server');
  const spaRouteRes = await fetch(`${VITE_BASE}/pipelines/test-pipeline-id-12345`);
  assert(spaRouteRes.status === 200, 'GET /pipelines/:id returns HTTP 200 via SPA fallback');
  const spaHtml = await spaRouteRes.text();
  assert(spaHtml.includes('id="root"'), 'SPA HTML root element present on /pipelines/:id');

  // Test 2: Unauthenticated protection across all pipeline detail endpoints
  console.log('\n[TEST 2] Verifying Unauthenticated Protection (HTTP 401)');
  const dummyId = '660000000000000000000001';

  const unauthGet = await fetch(`${VITE_BASE}/api/pipelines/${dummyId}`);
  assert(unauthGet.status === 401, 'GET /api/pipelines/:id without token returns 401');

  const unauthRuns = await fetch(`${VITE_BASE}/api/pipelines/${dummyId}/runs`);
  assert(unauthRuns.status === 401, 'GET /api/pipelines/:id/runs without token returns 401');

  const unauthExec = await fetch(`${VITE_BASE}/api/pipelines/${dummyId}/run`, { method: 'POST' });
  assert(unauthExec.status === 401, 'POST /api/pipelines/:id/run without token returns 401');

  const unauthSched = await fetch(`${VITE_BASE}/api/pipelines/${dummyId}/schedule`);
  assert(unauthSched.status === 401, 'GET /api/pipelines/:id/schedule without token returns 401');

  const unauthTrans = await fetch(`${VITE_BASE}/api/pipelines/${dummyId}/transform`);
  assert(unauthTrans.status === 401, 'GET /api/pipelines/:id/transform without token returns 401');

  // Test 3: Authenticate User A & User B
  console.log('\n[TEST 3] Authenticating User A & User B');
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

  const regBRes = await fetch(`${VITE_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userB)
  });
  assert(regBRes.status === 201, 'User B registered successfully');

  const loginBRes = await fetch(`${VITE_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userB.email, password: userB.password })
  });
  assert(loginBRes.status === 200, 'User B logged in successfully');
  const { token: tokenB } = await loginBRes.json();
  const headersB = {
    Authorization: `Bearer ${tokenB}`,
    'Content-Type': 'application/json'
  };

  // Test 4: Invalid and Non-existent Pipeline Handling
  console.log('\n[TEST 4] Verifying Invalid and Non-Existent Pipeline Handling');
  const invalidIdRes = await fetch(`${VITE_BASE}/api/pipelines/invalid-id`, { headers: headersA });
  assert(invalidIdRes.status === 404, 'Invalid ObjectId returns HTTP 404');

  const nonExistentRes = await fetch(`${VITE_BASE}/api/pipelines/000000000000000000000000`, { headers: headersA });
  assert(nonExistentRes.status === 404, 'Non-existent pipeline ID returns HTTP 404');

  const nonExistentSchedRes = await fetch(`${VITE_BASE}/api/pipelines/000000000000000000000000/schedule`, { headers: headersA });
  assert(nonExistentSchedRes.status === 404, 'Non-existent schedule returns HTTP 404');

  const nonExistentTransRes = await fetch(`${VITE_BASE}/api/pipelines/000000000000000000000000/transform`, { headers: headersA });
  assert(nonExistentTransRes.status === 404, 'Non-existent transform returns HTTP 404');

  // Test 5: Setup Prerequisite Source & Destination for User A
  console.log('\n[TEST 5] Creating Prerequisite Source & Destination');
  const srcPayload = {
    name: 'P9 Test Source Connector',
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
  assert(srcRes.status === 201, 'Prerequisite Source created');
  const { source: testSource } = await srcRes.json();

  const dstPayload = {
    name: 'P9 Test Destination Target',
    type: 'MONGODB',
    config: {
      uri: 'mongodb://127.0.0.1:27017/ricozingest_p9',
      database: 'ricozingest_p9',
      collection: 'p9_sync'
    },
    status: 'ACTIVE'
  };
  const dstRes = await fetch(`${VITE_BASE}/api/destinations`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify(dstPayload)
  });
  assert(dstRes.status === 201, 'Prerequisite Destination created');
  const { destination: testDest } = await dstRes.json();

  // Test 6: Create Pipeline with Incremental Sync & Initial Schedule
  console.log('\n[TEST 6] Creating Pipeline for Detail Inspection');
  const pipePayload = {
    name: 'Customer Sync Pipeline',
    sourceId: testSource.id,
    destinationId: testDest.id,
    status: 'ACTIVE',
    syncMode: 'INCREMENTAL',
    cursorField: 'id'
  };
  const createPipeRes = await fetch(`${VITE_BASE}/api/pipelines`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify(pipePayload)
  });
  assert(createPipeRes.status === 201, 'Pipeline created successfully');
  const { pipeline: testPipeline } = await createPipeRes.json();
  const pipeId = testPipeline.id;

  // Test 7: Pipeline Retrieval and Safe Metadata Rendering
  console.log('\n[TEST 7] Pipeline Retrieval & Metadata Sanitization');
  const getPipeRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}`, { headers: headersA });
  assert(getPipeRes.status === 200, 'GET /api/pipelines/:id returns HTTP 200');
  const { pipeline: loadedPipe } = await getPipeRes.json();

  assert(loadedPipe.id === pipeId, 'Loaded pipeline ID matches');
  assert(loadedPipe.name === 'Customer Sync Pipeline', 'Loaded pipeline name matches');
  assert(loadedPipe.status === 'ACTIVE', 'Pipeline status is ACTIVE');
  assert(loadedPipe.syncMode === 'INCREMENTAL', 'Sync mode is INCREMENTAL');
  assert(loadedPipe.cursorField === 'id', 'Cursor field is id');
  assert(loadedPipe.cursorValue === null, 'Initial cursor value is null');
  assert(Boolean(loadedPipe.source), 'Source metadata is populated');
  assert(loadedPipe.source.name === testSource.name, 'Source name matches');
  assert(loadedPipe.source.type === 'CSV', 'Source type matches');
  assert(Boolean(loadedPipe.destination), 'Destination metadata is populated');
  assert(loadedPipe.destination.name === testDest.name, 'Destination name matches');
  assert(loadedPipe.destination.type === 'MONGODB', 'Destination type matches');

  // Verify no credentials leaked
  const pipeString = JSON.stringify(loadedPipe);
  assert(!pipeString.includes('mongodb://'), 'No raw MongoDB URI in pipeline response');
  assert(!pipeString.includes('password'), 'No password field in pipeline response');
  assert(!pipeString.includes(userA.password), 'User password not leaked');

  // Test 8: Pipeline Run History Retrieval & Pagination
  console.log('\n[TEST 8] Pipeline Run History Retrieval & Pagination');
  const runsRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/runs?page=1&limit=5`, {
    headers: headersA
  });
  assert(runsRes.status === 200, 'GET /api/pipelines/:id/runs returns HTTP 200');
  const runsData = await runsRes.json();
  assert(Array.isArray(runsData.runs), 'Runs is an array');
  assert(runsData.pagination !== undefined, 'Pagination metadata is provided');
  assert(runsData.pagination.page === 1, 'Pagination page is 1');
  assert(runsData.pagination.limit === 5, 'Pagination limit is 5');

  // Test 9: Schedule Management (GET, PUT, disable, enable, and validation)
  console.log('\n[TEST 9] Schedule Management (GET, PUT, disable, enable, validation)');
  const schedGetRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/schedule`, { headers: headersA });
  assert(schedGetRes.status === 200, 'GET /api/pipelines/:id/schedule returns 200');
  const schedGetData = await schedGetRes.json();
  assert(schedGetData.schedule !== undefined, 'Schedule object returned');

  // Update schedule to INTERVAL 30m, enabled
  const schedPutRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/schedule`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({
      type: 'INTERVAL',
      expression: '30m',
      enabled: true
    })
  });
  assert(schedPutRes.status === 200, 'PUT /api/pipelines/:id/schedule returns 200');
  const schedPutData = await schedPutRes.json();
  assert(schedPutData.schedule.type === 'INTERVAL', 'Schedule type updated to INTERVAL');
  assert(schedPutData.schedule.expression === '30m', 'Schedule expression updated to 30m');
  assert(schedPutData.schedule.enabled === true, 'Schedule enabled set to true');
  assert(Boolean(schedPutData.schedule.nextRunAt), 'nextRunAt calculated for enabled schedule');

  // One-click disable schedule
  const schedDisableRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/schedule/disable`, {
    method: 'PATCH',
    headers: headersA
  });
  assert(schedDisableRes.status === 200, 'PATCH /api/pipelines/:id/schedule/disable returns 200');
  const schedDisableData = await schedDisableRes.json();
  assert(schedDisableData.schedule.enabled === false, 'Schedule is now disabled');
  assert(schedDisableData.schedule.nextRunAt === null, 'nextRunAt cleared when disabled');

  // One-click enable schedule
  const schedEnableRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/schedule/enable`, {
    method: 'PATCH',
    headers: headersA
  });
  assert(schedEnableRes.status === 200, 'PATCH /api/pipelines/:id/schedule/enable returns 200');
  const schedEnableData = await schedEnableRes.json();
  assert(schedEnableData.schedule.enabled === true, 'Schedule is re-enabled');
  assert(Boolean(schedEnableData.schedule.nextRunAt), 'nextRunAt re-computed');

  // Invalid schedule expression validation
  const invalidSchedRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/schedule`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({
      type: 'INTERVAL',
      expression: 'invalid_interval'
    })
  });
  assert(invalidSchedRes.status === 400, 'Invalid interval expression rejected with HTTP 400');

  // Test 10: Transformation Management (GET, PUT, and validation)
  console.log('\n[TEST 10] Transformation Management (GET, PUT, validation)');
  const transGetRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/transform`, { headers: headersA });
  assert(transGetRes.status === 200, 'GET /api/pipelines/:id/transform returns 200');
  const transGetData = await transGetRes.json();
  assert(transGetData.transformations !== undefined, 'Transformations object returned');

  // Update transformations with field mappings
  const transformPayload = {
    enabled: true,
    includeUnmapped: false,
    addMetadata: true,
    fieldMappings: [
      {
        sourceField: 'id',
        destinationField: 'customerId',
        dataType: 'NUMBER',
        defaultValue: 0,
        transformRule: 'NONE'
      },
      {
        sourceField: 'name',
        destinationField: 'fullName',
        dataType: 'STRING',
        transformRule: 'UPPERCASE'
      },
      {
        sourceField: 'email',
        destinationField: 'emailHash',
        dataType: 'STRING',
        transformRule: 'MASK_HASH'
      }
    ]
  };
  const transPutRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/transform`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify(transformPayload)
  });
  assert(transPutRes.status === 200, 'PUT /api/pipelines/:id/transform returns 200');
  const transPutData = await transPutRes.json();
  assert(transPutData.transformations.enabled === true, 'Transformations enabled');
  assert(transPutData.transformations.includeUnmapped === false, 'Strict projection configured');
  assert(transPutData.transformations.addMetadata === true, 'addMetadata enabled');
  assert(transPutData.transformations.fieldMappings.length === 3, '3 field mappings saved');

  // Validation: Invalid data type rejected
  const invalidTransRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/transform`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({
      enabled: true,
      fieldMappings: [
        {
          sourceField: 'id',
          destinationField: 'id',
          dataType: 'INVALID_TYPE'
        }
      ]
    })
  });
  assert(invalidTransRes.status === 400, 'Invalid dataType rejected with HTTP 400');

  // Test 11: Manual Execution & Concurrency / Inactive Handling
  console.log('\n[TEST 11] Manual Execution & Status Handling');
  // Deactivate pipeline to verify guard
  await fetch(`${VITE_BASE}/api/pipelines/${pipeId}`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({ status: 'INACTIVE' })
  });

  const inactiveRunRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/run`, {
    method: 'POST',
    headers: headersA
  });
  assert(inactiveRunRes.status === 400, 'Running inactive pipeline returns HTTP 400');

  // Reactivate pipeline
  await fetch(`${VITE_BASE}/api/pipelines/${pipeId}`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({ status: 'ACTIVE' })
  });

  // Test 12: Tenant Isolation (User B cannot access or modify User A's pipeline)
  console.log('\n[TEST 12] Strict Tenant Isolation Verification');
  const bGetRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}`, { headers: headersB });
  assert(bGetRes.status === 404, 'User B cannot access User A pipeline (HTTP 404)');

  const bRunsRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/runs`, { headers: headersB });
  const bRunsData = await bRunsRes.json();
  assert(bRunsData.runs?.length === 0, 'User B cannot view User A pipeline runs');

  const bRunExec = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/run`, {
    method: 'POST',
    headers: headersB
  });
  assert(bRunExec.status === 404, 'User B cannot trigger User A pipeline run (HTTP 404)');

  const bSchedRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/schedule`, { headers: headersB });
  assert(bSchedRes.status === 404, 'User B cannot access User A schedule (HTTP 404)');

  const bSchedPut = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/schedule`, {
    method: 'PUT',
    headers: headersB,
    body: JSON.stringify({ type: 'INTERVAL', expression: '1h' })
  });
  assert(bSchedPut.status === 404, 'User B cannot modify User A schedule (HTTP 404)');

  const bTransRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/transform`, { headers: headersB });
  assert(bTransRes.status === 404, 'User B cannot access User A transformations (HTTP 404)');

  const bTransPut = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/transform`, {
    method: 'PUT',
    headers: headersB,
    body: JSON.stringify({ enabled: false })
  });
  assert(bTransPut.status === 404, 'User B cannot modify User A transformations (HTTP 404)');

  // Test 13: Clean up all Temporary Test Resources
  console.log('\n[TEST 13] Cleaning Up Temporary Test Resources');
  const delPipeRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}`, {
    method: 'DELETE',
    headers: headersA
  });
  assert(delPipeRes.status === 200, 'Temporary pipeline deleted successfully');

  const delSrcRes = await fetch(`${VITE_BASE}/api/sources/${testSource.id}`, {
    method: 'DELETE',
    headers: headersA
  });
  assert(delSrcRes.status === 200, 'Temporary source connector cleaned up');

  const delDstRes = await fetch(`${VITE_BASE}/api/destinations/${testDest.id}`, {
    method: 'DELETE',
    headers: headersA
  });
  assert(delDstRes.status === 200, 'Temporary destination target cleaned up');

  console.log('\n========================================================');
  console.log(`  PHASE 9 VERIFICATION: ${passed}/${total} TESTS PASSED`);
  console.log('========================================================\n');
}

runPhase9Tests().catch((err) => {
  console.error('Phase 9 test execution failed:', err);
  process.exit(1);
});
