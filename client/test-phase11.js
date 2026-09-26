/**
 * Verification test script for Phase 11: Run History & Execution Diagnostics
 * Validates:
 * 1. Global /history SPA route accessibility
 * 2. Unauthenticated access protection on /api/pipeline-runs (HTTP 401)
 * 3. Authenticated access for multiple users (User A and User B)
 * 4. Global run listing across multiple pipelines (GET /api/pipeline-runs)
 * 5. Pagination structure (page, limit, total, totalPages)
 * 6. Limit selectors: 10, 25, 50, and backend limit cap guard
 * 7. Pipeline filtering via ?pipelineId query parameter
 * 8. Status filtering (SUCCESS, FAILED, RUNNING) representation
 * 9. Individual run detail retrieval (GET /api/pipeline-runs/:id)
 * 10. Diagnostics data integrity (records extracted/transformed/loaded, duration, timestamps, sync mode)
 * 11. Security & credential redaction (zero URIs, passwords, or secrets leaked)
 * 12. Strict tenant isolation (User B cannot see or query User A runs)
 * 13. Regression compatibility with pipeline-scoped runs (/api/pipelines/:id/runs)
 * 14. Full cleanup of temporary mock server and test database records
 */

import http from 'http';

const VITE_PORT = 5173;
const VITE_BASE = `http://localhost:${VITE_PORT}`;
const MOCK_SOURCE_PORT = 3198;

const userA = {
  name: 'Phase 11 User A',
  email: `p11_user_a_${Date.now()}@ricozingest.dev`,
  password: 'PasswordPhase11A!'
};

const userB = {
  name: 'Phase 11 User B',
  email: `p11_user_b_${Date.now()}@ricozingest.dev`,
  password: 'PasswordPhase11B!'
};

const mockSourceRecords = [
  { id: 201, item: 'Server Rack', qty: 4, cost: 2500, secretToken: 'SUPER_SECRET_KEY_123' },
  { id: 202, item: 'Switch Hub', qty: 10, cost: 450, secretToken: 'SUPER_SECRET_KEY_123' },
  { id: 203, item: 'Fiber Patch', qty: 50, cost: 25, secretToken: 'SUPER_SECRET_KEY_123' }
];

let passed = 0;
let total = 0;
let mockServer = null;

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

async function runPhase11Tests() {
  console.log('========================================================');
  console.log('  RICOZINGEST - PHASE 11 RUN HISTORY & DIAGNOSTICS TEST');
  console.log('========================================================\n');

  // Start local mock server for REST API source connector
  await new Promise((resolve) => {
    mockServer = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(mockSourceRecords));
    });
    mockServer.listen(MOCK_SOURCE_PORT, () => {
      console.log(`[SETUP] Mock REST API Source active on port ${MOCK_SOURCE_PORT}`);
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------
    // Test 1: Global /history SPA Route
    // -------------------------------------------------------------
    console.log('\n[TEST 1] Verifying Global Run History SPA Route (/history)');
    const spaRes = await fetch(`${VITE_BASE}/history`);
    assert(spaRes.status === 200, 'GET /history returns HTTP 200');
    const spaHtml = await spaRes.text();
    assert(spaHtml.includes('id="root"'), 'SPA HTML root element present in /history page');

    // -------------------------------------------------------------
    // Test 2: Unauthenticated Protection on Run History API
    // -------------------------------------------------------------
    console.log('\n[TEST 2] Verifying Unauthenticated Protection on Run History APIs');
    const unauthRunsRes = await fetch(`${VITE_BASE}/api/pipeline-runs`);
    assert(unauthRunsRes.status === 401, 'GET /api/pipeline-runs without token returns HTTP 401');

    const unauthSingleRes = await fetch(`${VITE_BASE}/api/pipeline-runs/660000000000000000000001`);
    assert(unauthSingleRes.status === 401, 'GET /api/pipeline-runs/:id without token returns HTTP 401');

    // -------------------------------------------------------------
    // Test 3: Authenticate User A and User B
    // -------------------------------------------------------------
    console.log('\n[TEST 3] Authenticating Test Users');
    const regARes = await fetch(`${VITE_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userA)
    });
    assert(regARes.status === 201, 'User A registered');

    const loginARes = await fetch(`${VITE_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userA.email, password: userA.password })
    });
    assert(loginARes.status === 200, 'User A logged in');
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
    assert(regBRes.status === 201, 'User B registered');

    const loginBRes = await fetch(`${VITE_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userB.email, password: userB.password })
    });
    assert(loginBRes.status === 200, 'User B logged in');
    const { token: tokenB } = await loginBRes.json();
    const headersB = {
      Authorization: `Bearer ${tokenB}`,
      'Content-Type': 'application/json'
    };

    // -------------------------------------------------------------
    // Test 4: Setup Prerequisite Sources, Destinations, and Pipelines
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Setting up Pipeline Connectors for User A');
    const srcPayload = {
      name: 'P11 Mock Source',
      type: 'REST_API',
      config: {
        url: `http://127.0.0.1:${MOCK_SOURCE_PORT}/inventory`,
        method: 'GET'
      },
      status: 'ACTIVE'
    };
    const srcRes = await fetch(`${VITE_BASE}/api/sources`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify(srcPayload)
    });
    assert(srcRes.status === 201, 'Source created for User A');
    const { source: testSource } = await srcRes.json();

    const dstPayload = {
      name: 'P11 MongoDB Destination',
      type: 'MONGODB',
      config: {
        uri: 'mongodb://127.0.0.1:27017/ricozingest_p11',
        database: 'ricozingest_p11',
        collection: 'inventory_runs'
      },
      status: 'ACTIVE'
    };
    const dstRes = await fetch(`${VITE_BASE}/api/destinations`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify(dstPayload)
    });
    assert(dstRes.status === 201, 'Destination created for User A');
    const { destination: testDest } = await dstRes.json();

    // Create Pipeline 1 (Primary Successful Pipeline)
    const pipe1Payload = {
      name: 'P11 Inventory Sync Pipeline',
      sourceId: testSource.id,
      destinationId: testDest.id,
      status: 'ACTIVE',
      syncMode: 'INCREMENTAL',
      cursorField: 'id',
      transformations: {
        enabled: true,
        includeUnmapped: true,
        addMetadata: true,
        fieldMappings: [
          {
            sourceField: 'item',
            destinationField: 'itemName',
            dataType: 'STRING',
            transformRule: 'UPPERCASE'
          }
        ]
      }
    };
    const pipe1Res = await fetch(`${VITE_BASE}/api/pipelines`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify(pipe1Payload)
    });
    assert(pipe1Res.status === 201, 'Pipeline 1 created for User A');
    const { pipeline: pipeline1 } = await pipe1Res.json();

    // Create Pipeline 2 (Second Pipeline for cross-pipeline filtering test)
    const pipe2Payload = {
      name: 'P11 Secondary Full Sync Pipeline',
      sourceId: testSource.id,
      destinationId: testDest.id,
      status: 'ACTIVE',
      syncMode: 'FULL',
      transformations: {
        enabled: false
      }
    };
    const pipe2Res = await fetch(`${VITE_BASE}/api/pipelines`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify(pipe2Payload)
    });
    assert(pipe2Res.status === 201, 'Pipeline 2 created for User A');
    const { pipeline: pipeline2 } = await pipe2Res.json();

    // Create Failing Pipeline (for FAILED run diagnostics)
    const brokenSrcPayload = {
      name: 'P11 Unreachable Broken Source',
      type: 'REST_API',
      config: {
        url: 'http://127.0.0.1:49876/nonexistent',
        method: 'GET'
      },
      status: 'ACTIVE'
    };
    const brokenSrcRes = await fetch(`${VITE_BASE}/api/sources`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify(brokenSrcPayload)
    });
    const { source: brokenSource } = await brokenSrcRes.json();

    const failingPipePayload = {
      name: 'P11 Failing Test Pipeline',
      sourceId: brokenSource.id,
      destinationId: testDest.id,
      status: 'ACTIVE'
    };
    const failingPipeRes = await fetch(`${VITE_BASE}/api/pipelines`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify(failingPipePayload)
    });
    const { pipeline: failingPipeline } = await failingPipeRes.json();

    // -------------------------------------------------------------
    // Test 5: Execute Runs to Populate History
    // -------------------------------------------------------------
    console.log('\n[TEST 5] Generating Run Executions (Successful & Failed)');
    // Run 1: Pipeline 1 - SUCCESS
    const run1Res = await fetch(`${VITE_BASE}/api/pipelines/${pipeline1.id}/run`, {
      method: 'POST',
      headers: headersA
    });
    assert(run1Res.status === 200, 'Pipeline 1 execution 1 succeeds (SUCCESS)');
    const { run: run1Data } = await run1Res.json();
    assert(run1Data.status === 'SUCCESS', 'Run 1 status is SUCCESS');

    // Run 2: Pipeline 2 - SUCCESS
    const run2Res = await fetch(`${VITE_BASE}/api/pipelines/${pipeline2.id}/run`, {
      method: 'POST',
      headers: headersA
    });
    assert(run2Res.status === 200, 'Pipeline 2 execution succeeds (SUCCESS)');
    const { run: run2Data } = await run2Res.json();
    assert(run2Data.status === 'SUCCESS', 'Run 2 status is SUCCESS');

    // Run 3: Failing Pipeline - FAILED
    const run3Res = await fetch(`${VITE_BASE}/api/pipelines/${failingPipeline.id}/run`, {
      method: 'POST',
      headers: headersA
    });
    assert(run3Res.status !== 200, 'Failing pipeline execution correctly rejected');

    // -------------------------------------------------------------
    // Test 6: Global Run Listing (GET /api/pipeline-runs)
    // -------------------------------------------------------------
    console.log('\n[TEST 6] Verifying Global Run History Listing');
    const globalRunsRes = await fetch(`${VITE_BASE}/api/pipeline-runs`, { headers: headersA });
    assert(globalRunsRes.status === 200, 'GET /api/pipeline-runs returns HTTP 200');
    const globalRunsData = await globalRunsRes.json();

    assert(Array.isArray(globalRunsData.runs), 'Returns runs array');
    assert(globalRunsData.runs.length >= 3, 'Contains at least 3 execution runs for User A');
    assert(Boolean(globalRunsData.pagination), 'Pagination metadata present in response');
    assert(globalRunsData.pagination.total >= 3, 'Pagination total count reflects all runs');
    assert(globalRunsData.pagination.page === 1, 'Default page is 1');
    assert(globalRunsData.pagination.limit === 10, 'Default limit is 10');

    // -------------------------------------------------------------
    // Test 7: Limit Selectors (10, 25, 50, and limit capping)
    // -------------------------------------------------------------
    console.log('\n[TEST 7] Verifying Limit Selectors (10, 25, 50, and cap)');
    // Limit 10
    const limit10Res = await fetch(`${VITE_BASE}/api/pipeline-runs?limit=10`, { headers: headersA });
    const limit10Data = await limit10Res.json();
    assert(limit10Data.pagination.limit === 10, 'Limit parameter 10 accepted');

    // Limit 25
    const limit25Res = await fetch(`${VITE_BASE}/api/pipeline-runs?limit=25`, { headers: headersA });
    const limit25Data = await limit25Res.json();
    assert(limit25Data.pagination.limit === 25, 'Limit parameter 25 accepted');

    // Limit 50
    const limit50Res = await fetch(`${VITE_BASE}/api/pipeline-runs?limit=50`, { headers: headersA });
    const limit50Data = await limit50Res.json();
    assert(limit50Data.pagination.limit === 50, 'Limit parameter 50 accepted');

    // Max limit guard (cap at 50)
    const limitExcessRes = await fetch(`${VITE_BASE}/api/pipeline-runs?limit=100`, { headers: headersA });
    const limitExcessData = await limitExcessRes.json();
    assert(limitExcessData.pagination.limit === 50, 'Excessive limit capped at max 50 by backend');

    // -------------------------------------------------------------
    // Test 8: Pagination Controls (page parameter & totalPages)
    // -------------------------------------------------------------
    console.log('\n[TEST 8] Verifying Pagination Controls');
    const page1Res = await fetch(`${VITE_BASE}/api/pipeline-runs?page=1&limit=2`, { headers: headersA });
    const page1Data = await page1Res.json();
    assert(page1Data.pagination.page === 1, 'Page 1 returns correct page metadata');
    assert(page1Data.runs.length <= 2, 'Page 1 respects limit of 2');
    assert(page1Data.pagination.totalPages >= 2, 'Total pages calculated correctly based on total/limit');

    const page2Res = await fetch(`${VITE_BASE}/api/pipeline-runs?page=2&limit=2`, { headers: headersA });
    const page2Data = await page2Res.json();
    assert(page2Data.pagination.page === 2, 'Page 2 returns correct page metadata');
    assert(page2Data.runs.length >= 1, 'Page 2 contains subsequent runs');
    // Ensure page 1 and page 2 items are distinct
    const page1Ids = page1Data.runs.map((r) => r.id);
    const page2Ids = page2Data.runs.map((r) => r.id);
    const overlap = page1Ids.some((id) => page2Ids.includes(id));
    assert(!overlap, 'Page 1 and Page 2 contain non-overlapping runs');

    // -------------------------------------------------------------
    // Test 9: Pipeline Filtering (?pipelineId=...)
    // -------------------------------------------------------------
    console.log('\n[TEST 9] Verifying Pipeline Filtering (?pipelineId=...)');
    // Filter by Pipeline 1
    const p1FilterRes = await fetch(`${VITE_BASE}/api/pipeline-runs?pipelineId=${pipeline1.id}`, {
      headers: headersA
    });
    assert(p1FilterRes.status === 200, 'GET /api/pipeline-runs with pipelineId returns 200');
    const p1FilterData = await p1FilterRes.json();
    assert(p1FilterData.runs.length >= 1, 'Pipeline 1 filter returns runs');
    assert(
      p1FilterData.runs.every((r) => r.pipelineId === pipeline1.id),
      'All returned runs belong to Pipeline 1'
    );

    // Filter by Pipeline 2
    const p2FilterRes = await fetch(`${VITE_BASE}/api/pipeline-runs?pipelineId=${pipeline2.id}`, {
      headers: headersA
    });
    const p2FilterData = await p2FilterRes.json();
    assert(
      p2FilterData.runs.every((r) => r.pipelineId === pipeline2.id),
      'All returned runs belong to Pipeline 2'
    );

    // Invalid pipeline ID handling
    const invalidFilterRes = await fetch(`${VITE_BASE}/api/pipeline-runs?pipelineId=invalid_id`, {
      headers: headersA
    });
    assert(invalidFilterRes.status === 400, 'Invalid pipeline ID in query returns HTTP 400');

    // -------------------------------------------------------------
    // Test 10: Status Filtering (SUCCESS, FAILED, RUNNING)
    // -------------------------------------------------------------
    console.log('\n[TEST 10] Verifying Status Representations (SUCCESS & FAILED)');
    const allRuns = globalRunsData.runs;
    const successRuns = allRuns.filter((r) => r.status === 'SUCCESS');
    const failedRuns = allRuns.filter((r) => r.status === 'FAILED');

    assert(successRuns.length >= 2, 'History contains SUCCESS runs');
    assert(failedRuns.length >= 1, 'History contains FAILED runs');

    // Verify properties of successful run
    const aSuccessRun = successRuns[0];
    assert(typeof aSuccessRun.recordsExtracted === 'number', 'Success run recordsExtracted is numeric');
    assert(typeof aSuccessRun.recordsTransformed === 'number', 'Success run recordsTransformed is numeric');
    assert(typeof aSuccessRun.recordsLoaded === 'number', 'Success run recordsLoaded is numeric');
    assert(Boolean(aSuccessRun.startedAt), 'Success run has startedAt');
    assert(Boolean(aSuccessRun.completedAt), 'Success run has completedAt');
    assert(Boolean(aSuccessRun.triggeredBy), 'Success run has triggeredBy');
    assert(Boolean(aSuccessRun.syncMode), 'Success run has syncMode');

    // Verify properties of failed run
    const aFailedRun = failedRuns[0];
    assert(Boolean(aFailedRun.errorMessage), 'Failed run contains recorded errorMessage');
    assert(aFailedRun.status === 'FAILED', 'Failed run status is FAILED');

    // -------------------------------------------------------------
    // Test 11: Single Run Detail Retrieval (GET /api/pipeline-runs/:id)
    // -------------------------------------------------------------
    console.log('\n[TEST 11] Verifying Single Run Detail Retrieval (GET /api/pipeline-runs/:id)');
    const singleRunRes = await fetch(`${VITE_BASE}/api/pipeline-runs/${run1Data.id}`, { headers: headersA });
    assert(singleRunRes.status === 200, 'GET /api/pipeline-runs/:id returns HTTP 200');
    const singleRunData = await singleRunRes.json();

    assert(Boolean(singleRunData.run), 'Response contains run object');
    assert(singleRunData.run.id === run1Data.id, 'Run ID matches requested ID');
    assert(singleRunData.run.pipelineId === pipeline1.id, 'Run pipelineId matches Pipeline 1');
    assert(singleRunData.run.recordsLoaded === 3, 'Run recordsLoaded matches loaded count (3)');
    assert(singleRunData.run.cursorValueAfter === 203, 'Run cursorValueAfter matches max cursor (203)');

    // Non-existent run ID returns 404
    const notFoundRunRes = await fetch(`${VITE_BASE}/api/pipeline-runs/660000000000000000000999`, {
      headers: headersA
    });
    assert(notFoundRunRes.status === 404, 'Non-existent run ID returns HTTP 404');

    // Invalid format run ID returns 404
    const invalidRunRes = await fetch(`${VITE_BASE}/api/pipeline-runs/not-an-id`, { headers: headersA });
    assert(invalidRunRes.status === 404, 'Invalid format run ID returns HTTP 404');

    // -------------------------------------------------------------
    // Test 12: Security & Credential Redaction in Run Outputs
    // -------------------------------------------------------------
    console.log('\n[TEST 12] Verifying Zero Credential Leakage in Run Data');
    const allRunsSerialized = JSON.stringify(globalRunsData);
    assert(!allRunsSerialized.includes('mongodb://'), 'Run listing does not leak MongoDB connection URI');
    assert(!allRunsSerialized.includes('SUPER_SECRET_KEY_123'), 'Run listing does not leak record payload secrets');
    assert(!allRunsSerialized.includes(userA.password), 'Run listing does not leak user password');
    assert(!allRunsSerialized.includes(tokenA), 'Run listing does not leak authorization token');

    const singleRunSerialized = JSON.stringify(singleRunData);
    assert(!singleRunSerialized.includes('mongodb://'), 'Single run does not leak MongoDB URI');
    assert(!singleRunSerialized.includes('password'), 'Single run does not leak password properties');

    // -------------------------------------------------------------
    // Test 13: Strict Tenant Isolation
    // -------------------------------------------------------------
    console.log('\n[TEST 13] Verifying Strict Tenant Isolation');
    // User B querying global runs should see 0 runs
    const bGlobalRunsRes = await fetch(`${VITE_BASE}/api/pipeline-runs`, { headers: headersB });
    assert(bGlobalRunsRes.status === 200, 'User B global runs query returns HTTP 200');
    const bGlobalRunsData = await bGlobalRunsRes.json();
    assert(bGlobalRunsData.runs.length === 0, 'User B receives 0 runs in global history');
    assert(bGlobalRunsData.pagination.total === 0, 'User B pagination total is 0');

    // User B querying User A's specific run ID should receive HTTP 404
    const bCrossRunRes = await fetch(`${VITE_BASE}/api/pipeline-runs/${run1Data.id}`, { headers: headersB });
    assert(bCrossRunRes.status === 404, 'User B cannot fetch User A run by ID (HTTP 404)');

    // User B querying User A's pipeline-scoped runs should receive 0 runs
    const bPipelineRunsRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeline1.id}/runs`, {
      headers: headersB
    });
    const bPipelineRunsData = await bPipelineRunsRes.json();
    assert(bPipelineRunsData.runs?.length === 0, 'User B receives empty runs for User A pipeline');

    // -------------------------------------------------------------
    // Test 14: Regression Compatibility with Pipeline-Scoped Runs API
    // -------------------------------------------------------------
    console.log('\n[TEST 14] Verifying Regression Compatibility with /api/pipelines/:id/runs');
    const pipeScopedRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeline1.id}/runs`, {
      headers: headersA
    });
    assert(pipeScopedRes.status === 200, 'GET /api/pipelines/:id/runs returns HTTP 200');
    const pipeScopedData = await pipeScopedRes.json();
    assert(pipeScopedData.runs.length >= 1, 'Pipeline-scoped runs retrieved successfully');
    assert(pipeScopedData.runs[0].id === run1Data.id, 'Pipeline-scoped run matches executed run ID');

    // -------------------------------------------------------------
    // Test 15: Clean Up All Temporary Test Resources
    // -------------------------------------------------------------
    console.log('\n[TEST 15] Cleaning Up Temporary Test Resources');
    await fetch(`${VITE_BASE}/api/pipelines/${pipeline1.id}`, { method: 'DELETE', headers: headersA });
    await fetch(`${VITE_BASE}/api/pipelines/${pipeline2.id}`, { method: 'DELETE', headers: headersA });
    await fetch(`${VITE_BASE}/api/pipelines/${failingPipeline.id}`, { method: 'DELETE', headers: headersA });
    await fetch(`${VITE_BASE}/api/sources/${testSource.id}`, { method: 'DELETE', headers: headersA });
    await fetch(`${VITE_BASE}/api/sources/${brokenSource.id}`, { method: 'DELETE', headers: headersA });
    await fetch(`${VITE_BASE}/api/destinations/${testDest.id}`, { method: 'DELETE', headers: headersA });

    console.log('\n========================================================');
    console.log(`  PHASE 11 VERIFICATION: ${passed}/${total} TESTS PASSED`);
    console.log('========================================================\n');
  } finally {
    if (mockServer) {
      mockServer.close();
    }
  }
}

runPhase11Tests().catch((err) => {
  console.error('Phase 11 test execution failed:', err);
  if (mockServer) mockServer.close();
  process.exit(1);
});
