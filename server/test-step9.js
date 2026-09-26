const mongoose = require('mongoose');
const app = require('./server');
const PipelineRun = require('./src/models/PipelineRun');
const Pipeline = require('./src/models/Pipeline');
const Source = require('./src/models/Source');
const Destination = require('./src/models/Destination');
const User = require('./src/models/User');

const TEST_PORT = 3099;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

let serverInstance;

const log = (step, title, details) => {
  console.log(`\n[STEP ${step}] ${title}`);
  if (details) console.log(`  -> ${details}`);
};

const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✅ ${message}`);
};

const runAllTests = async () => {
  console.log('====================================================');
  console.log('  RICOZINGEST - STEP 9 VERIFICATION TEST SUITE');
  console.log('====================================================');

  // Connect to DB if not connected
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ricozingest');
    console.log('Connected to MongoDB');
  }

  // Start HTTP Server
  await new Promise((resolve) => {
    serverInstance = app.listen(TEST_PORT, () => {
      console.log(`Test server running on port ${TEST_PORT}`);
      resolve();
    });
  });

  try {
    const timestamp = Date.now();

    // ==========================================
    // 1. UNIT TEST: CREDENTIAL SANITIZATION
    // ==========================================
    log(1, 'Testing Credential Sanitization Function');
    const PipelineExecutionService = require('./src/services/pipelineExecution.service');
    const testCases = [
      {
        input: 'Connection failed: mongodb://admin:secretPass123@cluster0.mongodb.net:27017/ricozingest',
        forbidden: ['secretPass123', 'admin:', 'cluster0.mongodb.net']
      },
      {
        input: 'Extraction failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fakeToken',
        forbidden: ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9']
      },
      {
        input: 'API error: apiKey="super_secret_api_key_456" failed',
        forbidden: ['super_secret_api_key_456']
      },
      {
        input: 'Auth failed: password: "super_secret_password_789"',
        forbidden: ['super_secret_password_789']
      }
    ];

    for (const tc of testCases) {
      const sanitized = PipelineExecutionService.sanitizeErrorMessage(tc.input);
      for (const f of tc.forbidden) {
        assert(!sanitized.includes(f), `Sanitized output redacts forbidden secret: "${f}"`);
      }
    }

    // ==========================================
    // 2. SETUP TEST USERS (USER A & USER B)
    // ==========================================
    log(2, 'Registering & Authenticating User A and User B');
    const userAEmail = `usera_${timestamp}@test.com`;
    const userBEmail = `userb_${timestamp}@test.com`;
    const password = 'TestPassword123!';

    // Register User A
    const regARes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User A', email: userAEmail, password })
    });
    const regAData = await regARes.json();
    assert(regARes.status === 201, 'User A registered successfully');

    // Login User A
    const loginARes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userAEmail, password })
    });
    const loginAData = await loginARes.json();
    assert(loginARes.status === 200, 'User A logged in successfully');
    const userAToken = loginAData.token;
    const userAId = loginAData.user.id;

    // Register User B
    const regBRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User B', email: userBEmail, password })
    });
    const regBData = await regBRes.json();
    assert(regBRes.status === 201, 'User B registered successfully');

    // Login User B
    const loginBRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userBEmail, password })
    });
    const loginBData = await loginBRes.json();
    assert(loginBRes.status === 200, 'User B logged in successfully');
    const userBToken = loginBData.token;
    const userBId = loginBData.user.id;

    // ==========================================
    // 3. CREATE SOURCE & DESTINATION FOR USER A
    // ==========================================
    log(3, 'Creating Source and Destination for User A');
    const sourceRes = await fetch(`${BASE_URL}/api/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        name: 'JSONPlaceholder Source',
        type: 'REST_API',
        config: {
          url: 'https://jsonplaceholder.typicode.com/posts',
          method: 'GET',
          headers: { Accept: 'application/json' }
        }
      })
    });
    const sourceData = await sourceRes.json();
    assert(sourceRes.status === 201, 'User A Source created successfully');
    const sourceAId = sourceData.source.id;

    const destCollection = `test_posts_${timestamp}`;
    const destRes = await fetch(`${BASE_URL}/api/destinations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        name: 'User A MongoDB Destination',
        type: 'MONGODB',
        config: {
          uri: 'mongodb://127.0.0.1:27017',
          database: 'ricozingest_destination',
          collection: destCollection
        }
      })
    });
    const destData = await destRes.json();
    assert(destRes.status === 201, 'User A Destination created successfully');
    const destAId = destData.destination.id;

    // ==========================================
    // 4. CREATE PIPELINE FOR USER A
    // ==========================================
    log(4, 'Creating Pipeline for User A');
    const pipeRes = await fetch(`${BASE_URL}/api/pipelines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        name: 'User A Synced Pipeline',
        sourceId: sourceAId,
        destinationId: destAId,
        status: 'ACTIVE'
      })
    });
    const pipeData = await pipeRes.json();
    assert(pipeRes.status === 201, 'User A Pipeline created successfully');
    const pipelineAId = pipeData.pipeline.id;

    // ==========================================
    // 5. TEST SUCCESSFUL PIPELINE EXECUTION
    // ==========================================
    log(5, 'Executing Pipeline A (Expect SUCCESS: 100 extracted, 100 loaded)');
    const runRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineAId}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const runData = await runRes.json();
    assert(runRes.status === 200, 'POST /api/pipelines/:id/run returned HTTP 200');
    assert(runData.message === 'Pipeline executed successfully', 'Response message is correct');
    assert(runData.run != null, 'Response includes run object');
    assert(runData.run.status === 'SUCCESS', 'Run status in response is SUCCESS');
    assert(runData.run.recordsExtracted === 100, 'recordsExtracted is 100 in response');
    assert(runData.run.recordsLoaded === 100, 'recordsLoaded is 100 in response');
    assert(runData.run.startedAt != null, 'startedAt is present in response');
    assert(runData.run.completedAt != null, 'completedAt is present in response');
    assert(runData.run.uri == null && runData.run.password == null, 'No sensitive credentials in run response');

    const runAId = runData.run.id;

    // Direct MongoDB check on PipelineRun document
    const persistedRunA = await PipelineRun.findById(runAId);
    assert(persistedRunA != null, 'PipelineRun document persisted in MongoDB');
    assert(persistedRunA.status === 'SUCCESS', 'Persisted status is SUCCESS');
    assert(persistedRunA.recordsExtracted === 100, 'Persisted recordsExtracted is 100');
    assert(persistedRunA.recordsLoaded === 100, 'Persisted recordsLoaded is 100');
    assert(persistedRunA.userId.toString() === userAId, 'Persisted userId matches User A');
    assert(persistedRunA.pipelineId.toString() === pipelineAId, 'Persisted pipelineId matches Pipeline A');
    assert(persistedRunA.errorMessage == null, 'Persisted errorMessage is null for successful run');
    assert(persistedRunA.completedAt != null, 'Persisted completedAt is populated');
    assert(new Date(persistedRunA.completedAt) >= new Date(persistedRunA.startedAt), 'completedAt is >= startedAt');

    // ==========================================
    // 6. TEST FAILED PIPELINE EXECUTION & SANITIZATION
    // ==========================================
    log(6, 'Testing Controlled Failing Pipeline Execution');
    // Create a source with an invalid/unreachable URL
    const failSourceRes = await fetch(`${BASE_URL}/api/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        name: 'Failing REST Source',
        type: 'REST_API',
        config: {
          url: 'https://non-existent-domain-123456789.com/posts',
          method: 'GET'
        }
      })
    });
    const failSourceData = await failSourceRes.json();
    const failSourceId = failSourceData.source.id;

    // Create pipeline with failing source
    const failPipeRes = await fetch(`${BASE_URL}/api/pipelines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        name: 'Failing Pipeline',
        sourceId: failSourceId,
        destinationId: destAId,
        status: 'ACTIVE'
      })
    });
    const failPipeData = await failPipeRes.json();
    const failPipeId = failPipeData.pipeline.id;

    // Run failing pipeline
    const failRunRes = await fetch(`${BASE_URL}/api/pipelines/${failPipeId}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(failRunRes.status !== 200, `Failing run returned error status: ${failRunRes.status}`);

    // Query MongoDB for the failing run document
    const failedRunDoc = await PipelineRun.findOne({ pipelineId: failPipeId, userId: userAId });
    assert(failedRunDoc != null, 'Failed PipelineRun document persisted in MongoDB');
    assert(failedRunDoc.status === 'FAILED', 'Run document status is FAILED');
    assert(failedRunDoc.errorMessage != null && failedRunDoc.errorMessage.length > 0, 'errorMessage is recorded');
    assert(failedRunDoc.completedAt != null, 'completedAt is set for failed run');
    assert(failedRunDoc.recordsExtracted === 0, 'recordsExtracted is 0 for failed connection');
    assert(failedRunDoc.recordsLoaded === 0, 'recordsLoaded is 0 for failed connection');

    // Verify error message has no credentials
    assert(!failedRunDoc.errorMessage.includes('mongodb://'), 'errorMessage does not contain plain mongodb://');
    assert(!failedRunDoc.errorMessage.includes('password'), 'errorMessage does not contain password');

    // ==========================================
    // 7. TEST RUN HISTORY LIST API & PAGINATION
    // ==========================================
    log(7, 'Testing GET /api/pipeline-runs with Pagination');
    const historyRes = await fetch(`${BASE_URL}/api/pipeline-runs?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const historyData = await historyRes.json();
    assert(historyRes.status === 200, 'GET /api/pipeline-runs returned HTTP 200');
    assert(Array.isArray(historyData.runs), 'Response contains runs array');
    assert(historyData.pagination != null, 'Response contains pagination metadata');
    assert(historyData.pagination.page === 1, 'pagination.page is 1');
    assert(historyData.pagination.limit === 10, 'pagination.limit is 10');
    assert(historyData.pagination.total >= 2, `pagination.total is ${historyData.pagination.total} (>= 2)`);
    assert(historyData.pagination.totalPages >= 1, `pagination.totalPages is ${historyData.pagination.totalPages}`);

    // Verify ordering: newest first
    if (historyData.runs.length >= 2) {
      const run1Time = new Date(historyData.runs[0].createdAt).getTime();
      const run2Time = new Date(historyData.runs[1].createdAt).getTime();
      assert(run1Time >= run2Time, 'Runs are sorted newest first (createdAt descending)');
    }

    // Test page=1&limit=1 vs page=2&limit=1
    const p1Res = await fetch(`${BASE_URL}/api/pipeline-runs?page=1&limit=1`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const p1Data = await p1Res.json();
    assert(p1Data.runs.length === 1, 'Page 1 limit 1 returns exactly 1 run');

    const p2Res = await fetch(`${BASE_URL}/api/pipeline-runs?page=2&limit=1`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const p2Data = await p2Res.json();
    assert(p2Data.runs.length === 1, 'Page 2 limit 1 returns exactly 1 run');
    assert(p1Data.runs[0].id !== p2Data.runs[0].id, 'Page 1 and Page 2 return different runs');

    // Test limit cap at 50
    const capRes = await fetch(`${BASE_URL}/api/pipeline-runs?limit=100`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const capData = await capRes.json();
    assert(capData.pagination.limit === 50, 'Limit is capped at 50 when request asks for 100');

    // ==========================================
    // 8. TEST PIPELINE FILTERING
    // ==========================================
    log(8, 'Testing Pipeline Filtering: GET /api/pipeline-runs?pipelineId=<id>');
    const filterRes = await fetch(`${BASE_URL}/api/pipeline-runs?pipelineId=${pipelineAId}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const filterData = await filterRes.json();
    assert(filterRes.status === 200, 'Filtering by pipelineId returned HTTP 200');
    assert(filterData.runs.length >= 1, 'Filtered runs returned at least 1 run');
    assert(
      filterData.runs.every((r) => r.pipelineId === pipelineAId),
      'All returned runs belong to pipelineAId'
    );

    // Also test GET /api/pipelines/:id/runs
    const subRouteRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineAId}/runs`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const subRouteData = await subRouteRes.json();
    assert(subRouteRes.status === 200, 'GET /api/pipelines/:id/runs returned HTTP 200');
    assert(subRouteData.runs.length >= 1, 'Subroute returned runs');
    assert(
      subRouteData.runs.every((r) => r.pipelineId === pipelineAId),
      'All runs from subroute belong to pipelineAId'
    );

    // ==========================================
    // 9. TEST SINGLE RUN API: GET /api/pipeline-runs/:id
    // ==========================================
    log(9, 'Testing Single Run API: GET /api/pipeline-runs/:id');
    const singleRunRes = await fetch(`${BASE_URL}/api/pipeline-runs/${runAId}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const singleRunData = await singleRunRes.json();
    assert(singleRunRes.status === 200, 'Single run request returned HTTP 200');
    assert(singleRunData.run != null, 'Response contains run object');
    assert(singleRunData.run.id === runAId, 'Run ID matches requested ID');
    assert(singleRunData.run.status === 'SUCCESS', 'Run status is SUCCESS');
    assert(singleRunData.run.recordsExtracted === 100, 'recordsExtracted is 100');
    assert(singleRunData.run.recordsLoaded === 100, 'recordsLoaded is 100');

    // ==========================================
    // 10. TEST CROSS-USER TENANT ISOLATION
    // ==========================================
    log(10, 'Testing Cross-User Tenant Isolation (User B vs User A)');
    // User B attempts to access User A's run: MUST return 404
    const crossRes = await fetch(`${BASE_URL}/api/pipeline-runs/${runAId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert(crossRes.status === 404, 'User B accessing User A run returns 404 Not Found');

    // User B lists runs: MUST see 0 runs (not User A's runs)
    const userBHistoryRes = await fetch(`${BASE_URL}/api/pipeline-runs`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    const userBHistoryData = await userBHistoryRes.json();
    assert(userBHistoryRes.status === 200, 'User B list returned HTTP 200');
    assert(userBHistoryData.runs.length === 0, "User B sees 0 runs (User A's runs are isolated)");
    assert(userBHistoryData.pagination.total === 0, 'User B pagination total is 0');

    // User B filters by User A's pipelineId: MUST return 0 runs
    const userBCrossFilterRes = await fetch(`${BASE_URL}/api/pipeline-runs?pipelineId=${pipelineAId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    const userBCrossFilterData = await userBCrossFilterRes.json();
    assert(userBCrossFilterData.runs.length === 0, "User B querying User A's pipelineId gets 0 runs");

    // ==========================================
    // 11. TEST UNAUTHENTICATED REQUESTS
    // ==========================================
    log(11, 'Testing Unauthenticated Requests (Expect 401)');
    const unauthList = await fetch(`${BASE_URL}/api/pipeline-runs`);
    assert(unauthList.status === 401, 'Unauthenticated GET /api/pipeline-runs returns 401');

    const unauthSingle = await fetch(`${BASE_URL}/api/pipeline-runs/${runAId}`);
    assert(unauthSingle.status === 401, 'Unauthenticated GET /api/pipeline-runs/:id returns 401');

    // ==========================================
    // 12. REGRESSION TESTING ACROSS ALL MODULES
    // ==========================================
    log(12, 'Regression Testing Previous Endpoints (Full CRUD)');
    // Root
    const rootRes = await fetch(`${BASE_URL}/`);
    assert(rootRes.status === 200, 'GET / returns 200');

    // Auth /me
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(meRes.status === 200, 'GET /api/auth/me returns 200');

    // Sources: Create, List, Update, Delete
    const tempSourceRes = await fetch(`${BASE_URL}/api/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        name: 'Temp Source for CRUD',
        type: 'REST_API',
        config: { url: 'https://jsonplaceholder.typicode.com/posts' }
      })
    });
    const tempSourceData = await tempSourceRes.json();
    assert(tempSourceRes.status === 201, 'POST /api/sources returns 201');
    const tempSourceId = tempSourceData.source.id;

    const sourcesList = await fetch(`${BASE_URL}/api/sources`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(sourcesList.status === 200, 'GET /api/sources returns 200');

    const updateSourceRes = await fetch(`${BASE_URL}/api/sources/${tempSourceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ name: 'Updated Temp Source' })
    });
    assert(updateSourceRes.status === 200, 'PUT /api/sources/:id returns 200');

    const deleteSourceRes = await fetch(`${BASE_URL}/api/sources/${tempSourceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(deleteSourceRes.status === 200, 'DELETE /api/sources/:id returns 200');

    // Destinations: Create, List, Update, Delete
    const tempDestRes = await fetch(`${BASE_URL}/api/destinations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        name: 'Temp Destination for CRUD',
        type: 'MONGODB',
        config: {
          uri: 'mongodb://127.0.0.1:27017',
          database: 'ricozingest_destination',
          collection: `temp_collection_${Date.now()}`
        }
      })
    });
    const tempDestData = await tempDestRes.json();
    assert(tempDestRes.status === 201, 'POST /api/destinations returns 201');
    const tempDestId = tempDestData.destination.id;

    const destsList = await fetch(`${BASE_URL}/api/destinations`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(destsList.status === 200, 'GET /api/destinations returns 200');

    const updateDestRes = await fetch(`${BASE_URL}/api/destinations/${tempDestId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ name: 'Updated Temp Destination' })
    });
    assert(updateDestRes.status === 200, 'PUT /api/destinations/:id returns 200');

    const deleteDestRes = await fetch(`${BASE_URL}/api/destinations/${tempDestId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(deleteDestRes.status === 200, 'DELETE /api/destinations/:id returns 200');

    // Pipelines: Create, List, Get, Update, Delete
    const tempPipeRes = await fetch(`${BASE_URL}/api/pipelines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        name: 'Temp Pipeline for CRUD',
        sourceId: sourceAId,
        destinationId: destAId
      })
    });
    const tempPipeData = await tempPipeRes.json();
    assert(tempPipeRes.status === 201, 'POST /api/pipelines returns 201');
    const tempPipeId = tempPipeData.pipeline.id;

    const pipesList = await fetch(`${BASE_URL}/api/pipelines`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(pipesList.status === 200, 'GET /api/pipelines returns 200');

    const pipeGet = await fetch(`${BASE_URL}/api/pipelines/${tempPipeId}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(pipeGet.status === 200, 'GET /api/pipelines/:id returns 200');

    const updatePipeRes = await fetch(`${BASE_URL}/api/pipelines/${tempPipeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({ name: 'Updated Temp Pipeline', status: 'INACTIVE' })
    });
    assert(updatePipeRes.status === 200, 'PUT /api/pipelines/:id returns 200');

    const deletePipeRes = await fetch(`${BASE_URL}/api/pipelines/${tempPipeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(deletePipeRes.status === 200, 'DELETE /api/pipelines/:id returns 200');

    // ==========================================
    // 13. CONNECTION CLEANUP TEST UNDER FAILURE
    // ==========================================
    log(13, 'Testing Destination finalize() Cleanup When Execution Fails');
    const MongoDbConnector = require('./src/connectors/destinations/MongoDbConnector');
    let finalizeCalled = false;
    const originalFinalize = MongoDbConnector.prototype.finalize;
    MongoDbConnector.prototype.finalize = async function() {
      finalizeCalled = true;
      return originalFinalize.apply(this, arguments);
    };

    try {
      await fetch(`${BASE_URL}/api/pipelines/${failPipeId}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      assert(finalizeCalled === true, 'destinationConnector.finalize() was called during failure in finally block');
    } finally {
      MongoDbConnector.prototype.finalize = originalFinalize;
    }

    console.log('\n====================================================');
    console.log('  🎉 ALL STEP 9 TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('====================================================');
  } finally {
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
  }
};

runAllTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ TEST RUN FAILED:', err);
    process.exit(1);
  });
