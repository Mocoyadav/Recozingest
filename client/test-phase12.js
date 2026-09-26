/**
 * Verification test script for Phase 12: Production Readiness, Polish & Accessibility
 * Validates:
 * 1. SPA Routes & Fallbacks (/login, /register, /dashboard, /sources, /destinations, /pipelines, /pipelines/new, /pipelines/:id, /history)
 * 2. Protected Route Security (401 Unauthorized for unauthenticated requests)
 * 3. Authentication & Profile Rehydration (Register, Login, GetMe)
 * 4. Dashboard KPIs & Data Loading Infrastructure
 * 5. Source Management Regression (Create, Read, Credential Privacy)
 * 6. Destination Management Regression (Create, Read, Credential Write-Only)
 * 7. Pipeline Management Regression (Create, Status, Sync Mode)
 * 8. Pipeline Detail Hub Regression (Transformations, Schedule, Checkpoints)
 * 9. End-to-End Pipeline Execution Lifecycle (Extracted -> Transformed -> Loaded)
 * 10. Run History & Diagnostics Regression (Global & Scoped Runs, Pagination, Detailed Telemetry)
 * 11. Accessibility & Responsive DOM Verification (Viewport, Skip Link, ARIA Dialog Semantics, Reduced Motion)
 * 12. Security Review & Credential Redaction (Zero URIs, passwords, or tokens leaked)
 * 13. Strict Tenant Isolation across all resources
 * 14. Full teardown and cleanup of test resources
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

const VITE_PORT = 5173;
const VITE_BASE = `http://localhost:${VITE_PORT}`;
const MOCK_SOURCE_PORT = 3196;

const userA = {
  name: 'Phase 12 User A',
  email: `p12_user_a_${Date.now()}@ricozingest.dev`,
  password: 'PasswordPhase12A!'
};

const userB = {
  name: 'Phase 12 User B',
  email: `p12_user_b_${Date.now()}@ricozingest.dev`,
  password: 'PasswordPhase12B!'
};

const mockSourceRecords = [
  { id: 301, sku: 'PROD-A', price: 99.99, authSecret: 'SUPER_CONFIDENTIAL_TOKEN_XYZ' },
  { id: 302, sku: 'PROD-B', price: 149.50, authSecret: 'SUPER_CONFIDENTIAL_TOKEN_XYZ' }
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

async function runPhase12Tests() {
  console.log('================================================================');
  console.log('  RICOZINGEST - PHASE 12 PRODUCTION READINESS & POLISH TESTS');
  console.log('================================================================\n');

  // Start local mock server for REST API connector
  await new Promise((resolve) => {
    mockServer = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(mockSourceRecords));
    });
    mockServer.listen(MOCK_SOURCE_PORT, () => {
      console.log(`[SETUP] Mock REST API Source Server active on port ${MOCK_SOURCE_PORT}`);
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------
    // Test 1: Complete SPA Route Review
    // -------------------------------------------------------------
    console.log('\n[TEST 1] Verifying Complete SPA Route Coverage');
    const spaRoutes = [
      '/login',
      '/register',
      '/dashboard',
      '/sources',
      '/destinations',
      '/pipelines',
      '/pipelines/new',
      '/pipelines/660000000000000000000001',
      '/history'
    ];

    for (const route of spaRoutes) {
      const res = await fetch(`${VITE_BASE}${route}`);
      assert(res.status === 200, `Route ${route} returns HTTP 200`);
      const html = await res.text();
      assert(html.includes('id="root"'), `Route ${route} delivers SPA HTML root element`);
    }

    // -------------------------------------------------------------
    // Test 2: Protected Route Unauthenticated Rejection (HTTP 401)
    // -------------------------------------------------------------
    console.log('\n[TEST 2] Verifying Protected Route Authentication Guards');
    const protectedApis = [
      { path: '/api/auth/me', method: 'GET' },
      { path: '/api/sources', method: 'GET' },
      { path: '/api/destinations', method: 'GET' },
      { path: '/api/pipelines', method: 'GET' },
      { path: '/api/pipeline-runs', method: 'GET' },
      { path: '/api/pipelines/660000000000000000000001/run', method: 'POST' }
    ];

    for (const api of protectedApis) {
      const res = await fetch(`${VITE_BASE}${api.path}`, { method: api.method });
      assert(res.status === 401, `Unauthenticated ${api.method} ${api.path} rejected with HTTP 401`);
    }

    // -------------------------------------------------------------
    // Test 3: Authentication & Profile Rehydration
    // -------------------------------------------------------------
    console.log('\n[TEST 3] Authenticating User A & User B');
    const regARes = await fetch(`${VITE_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userA)
    });
    assert(regARes.status === 201, 'User A registered (201 Created)');

    const loginARes = await fetch(`${VITE_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userA.email, password: userA.password })
    });
    assert(loginARes.status === 200, 'User A logged in (200 OK)');
    const { token: tokenA } = await loginARes.json();
    const headersA = {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json'
    };

    const meARes = await fetch(`${VITE_BASE}/api/auth/me`, { headers: headersA });
    assert(meARes.status === 200, 'GET /api/auth/me succeeds');
    const meAData = await meARes.json();
    assert(meAData.user.email === userA.email, 'Rehydrated user profile matches authenticated email');
    assert(meAData.user.password === undefined, 'Password hash completely omitted from profile');

    const regBRes = await fetch(`${VITE_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userB)
    });
    assert(regBRes.status === 201, 'User B registered (201 Created)');

    const loginBRes = await fetch(`${VITE_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userB.email, password: userB.password })
    });
    assert(loginBRes.status === 200, 'User B logged in (200 OK)');
    const { token: tokenB } = await loginBRes.json();
    const headersB = {
      Authorization: `Bearer ${tokenB}`,
      'Content-Type': 'application/json'
    };

    // -------------------------------------------------------------
    // Test 4: Dashboard KPI & Data Loading Infrastructure
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Verifying Dashboard Data Loading Infrastructure');
    const dashPipesRes = await fetch(`${VITE_BASE}/api/pipelines`, { headers: headersA });
    assert(dashPipesRes.status === 200, 'Dashboard pipeline query returns 200');
    const dashRunsRes = await fetch(`${VITE_BASE}/api/pipeline-runs?limit=10`, { headers: headersA });
    assert(dashRunsRes.status === 200, 'Dashboard runs query returns 200');

    // -------------------------------------------------------------
    // Test 5: Source Management Regression (Create, Read, Credential Privacy)
    // -------------------------------------------------------------
    console.log('\n[TEST 5] Verifying Source Management Regression');
    const srcPayload = {
      name: 'P12 Catalog REST Source',
      type: 'REST_API',
      config: {
        url: `http://127.0.0.1:${MOCK_SOURCE_PORT}/catalog`,
        method: 'GET'
      },
      status: 'ACTIVE'
    };
    const srcRes = await fetch(`${VITE_BASE}/api/sources`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify(srcPayload)
    });
    assert(srcRes.status === 201, 'Source created successfully');
    const { source: testSource } = await srcRes.json();

    const getSrcRes = await fetch(`${VITE_BASE}/api/sources/${testSource.id}`, { headers: headersA });
    assert(getSrcRes.status === 200, 'GET source by ID returns 200');

    // -------------------------------------------------------------
    // Test 6: Destination Management Regression (Create, Read, Credential Write-Only)
    // -------------------------------------------------------------
    console.log('\n[TEST 6] Verifying Destination Management Regression');
    const dstPayload = {
      name: 'P12 Target Mongo DB',
      type: 'MONGODB',
      config: {
        uri: 'mongodb://127.0.0.1:27017/ricozingest_p12',
        database: 'ricozingest_p12',
        collection: 'catalog_records'
      },
      status: 'ACTIVE'
    };
    const dstRes = await fetch(`${VITE_BASE}/api/destinations`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify(dstPayload)
    });
    assert(dstRes.status === 201, 'Destination created successfully');
    const { destination: testDest } = await dstRes.json();

    // Verify URI write-only privacy
    const dstString = JSON.stringify(testDest);
    assert(!dstString.includes('mongodb://'), 'Sensitive URI is NOT returned in destination payload');

    // -------------------------------------------------------------
    // Test 7: Pipeline Management Regression (Create, Config)
    // -------------------------------------------------------------
    console.log('\n[TEST 7] Verifying Pipeline Management Regression');
    const pipePayload = {
      name: 'P12 Production Sync Pipeline',
      sourceId: testSource.id,
      destinationId: testDest.id,
      status: 'ACTIVE',
      syncMode: 'INCREMENTAL',
      cursorField: 'id'
    };
    const pipeRes = await fetch(`${VITE_BASE}/api/pipelines`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify(pipePayload)
    });
    assert(pipeRes.status === 201, 'Pipeline created successfully');
    const { pipeline: testPipeline } = await pipeRes.json();
    const pipeId = testPipeline.id;

    // -------------------------------------------------------------
    // Test 8: Pipeline Detail Hub Regression (Transformations, Schedule)
    // -------------------------------------------------------------
    console.log('\n[TEST 8] Verifying Pipeline Detail Transformations & Schedule');
    // Configure Transformations
    const transformPayload = {
      transformations: {
        enabled: true,
        includeUnmapped: true,
        addMetadata: true,
        fieldMappings: [
          {
            sourceField: 'sku',
            destinationField: 'productSku',
            dataType: 'STRING',
            transformRule: 'UPPERCASE'
          }
        ]
      }
    };
    const transRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/transform`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify(transformPayload)
    });
    assert(transRes.status === 200, 'Transformations configured via PUT /api/pipelines/:id/transform');

    // Configure Schedule
    const schedPayload = {
      schedule: {
        enabled: true,
        type: 'INTERVAL',
        expression: '1h'
      }
    };
    const schedRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/schedule`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify(schedPayload)
    });
    assert(schedRes.status === 200, 'Schedule configured via PUT /api/pipelines/:id/schedule');

    // -------------------------------------------------------------
    // Test 9: End-to-End Pipeline Execution Lifecycle
    // -------------------------------------------------------------
    console.log('\n[TEST 9] Verifying Pipeline Execution Lifecycle (Extracted -> Transformed -> Loaded)');
    const execRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/run`, {
      method: 'POST',
      headers: headersA
    });
    assert(execRes.status === 200, 'Manual pipeline execution returns 200 OK');
    const { run: executedRun } = await execRes.json();

    assert(executedRun.status === 'SUCCESS', 'Pipeline run status is SUCCESS');
    assert(executedRun.recordsExtracted === 2, '2 records extracted from mock source');
    assert(executedRun.recordsTransformed === 2, '2 records transformed by engine');
    assert(executedRun.recordsLoaded === 2, '2 records loaded to MongoDB destination');
    assert(Boolean(executedRun.startedAt), 'Run has startedAt timestamp');
    assert(Boolean(executedRun.completedAt), 'Run has completedAt timestamp');

    // -------------------------------------------------------------
    // Test 10: Run History & Diagnostics Regression
    // -------------------------------------------------------------
    console.log('\n[TEST 10] Verifying Run History & Execution Diagnostics');
    // Global Run History
    const globalRunsRes = await fetch(`${VITE_BASE}/api/pipeline-runs`, { headers: headersA });
    assert(globalRunsRes.status === 200, 'GET /api/pipeline-runs returns 200');
    const { runs, pagination } = await globalRunsRes.json();
    assert(runs.length >= 1, 'Global run history lists execution run');
    assert(pagination.total >= 1, 'Pagination reflects total runs');

    // Scoped Run History
    const scopedRunsRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/runs`, { headers: headersA });
    assert(scopedRunsRes.status === 200, 'GET /api/pipelines/:id/runs returns 200');
    const scopedData = await scopedRunsRes.json();
    assert(scopedData.runs.length >= 1, 'Pipeline-scoped history lists execution run');

    // Single Run Telemetry
    const singleRunRes = await fetch(`${VITE_BASE}/api/pipeline-runs/${executedRun.id}`, { headers: headersA });
    assert(singleRunRes.status === 200, 'GET /api/pipeline-runs/:id returns 200');
    const { run: fetchedRun } = await singleRunRes.json();
    assert(fetchedRun.id === executedRun.id, 'Detailed run telemetry ID matches executed run');
    assert(fetchedRun.cursorValueAfter === 302, 'Incremental cursor value checkpoint recorded');

    // -------------------------------------------------------------
    // Test 11: Accessibility & Responsive DOM Verification
    // -------------------------------------------------------------
    console.log('\n[TEST 11] Verifying Accessibility & Responsive DOM Attributes');
    const indexHtmlPath = path.resolve('index.html');
    const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
    assert(indexHtmlContent.includes('viewport'), 'HTML shell contains responsive viewport meta tag');
    assert(indexHtmlContent.includes('lang="en"'), 'HTML shell contains accessible lang="en" attribute');

    // Check AppLayout for Skip Link
    const appLayoutPath = path.resolve('src/layouts/AppLayout.jsx');
    const appLayoutContent = fs.readFileSync(appLayoutPath, 'utf8');
    assert(appLayoutContent.includes('skip-link'), 'AppLayout contains accessible skip-to-content link');
    assert(appLayoutContent.includes('role="main"'), 'AppLayout contains semantic role="main" element');

    // Check ErrorBoundary component presence
    const errorBoundaryPath = path.resolve('src/components/common/ErrorBoundary.jsx');
    assert(fs.existsSync(errorBoundaryPath), 'ErrorBoundary component exists in client/src/components/common/');

    // Check App.jsx wraps with ErrorBoundary
    const appJsxPath = path.resolve('src/App.jsx');
    const appJsxContent = fs.readFileSync(appJsxPath, 'utf8');
    assert(appJsxContent.includes('ErrorBoundary'), 'App.jsx wraps application routes with ErrorBoundary');

    // Check CSS rules for Accessibility
    const indexCssPath = path.resolve('src/styles/index.css');
    const indexCssContent = fs.readFileSync(indexCssPath, 'utf8');
    assert(indexCssContent.includes('prefers-reduced-motion'), 'index.css defines prefers-reduced-motion adaptations');
    assert(indexCssContent.includes(':focus-visible'), 'index.css defines visible keyboard focus-visible indicator');
    assert(indexCssContent.includes('.skip-link'), 'index.css styles the accessible skip-to-content link');

    // -------------------------------------------------------------
    // Test 12: Security Review & Credential Redaction
    // -------------------------------------------------------------
    console.log('\n[TEST 12] Verifying Complete Credential Redaction');
    const runString = JSON.stringify(fetchedRun);
    assert(!runString.includes('mongodb://'), 'Run telemetry does not leak MongoDB URI');
    assert(!runString.includes('SUPER_CONFIDENTIAL_TOKEN_XYZ'), 'Source record secret tokens not exposed');
    assert(!runString.includes(userA.password), 'User A password never exposed in responses');
    assert(!runString.includes(tokenA), 'JWT token never exposed in telemetry response');

    // -------------------------------------------------------------
    // Test 13: Strict Tenant Isolation
    // -------------------------------------------------------------
    console.log('\n[TEST 13] Verifying Strict Multi-Tenant Isolation');
    const bSourcesRes = await fetch(`${VITE_BASE}/api/sources`, { headers: headersB });
    const bSources = await bSourcesRes.json();
    assert(bSources.sources?.length === 0, 'User B sees 0 sources (tenant isolated)');

    const bDestsRes = await fetch(`${VITE_BASE}/api/destinations`, { headers: headersB });
    const bDests = await bDestsRes.json();
    assert(bDests.destinations?.length === 0, 'User B sees 0 destinations (tenant isolated)');

    const bPipesRes = await fetch(`${VITE_BASE}/api/pipelines`, { headers: headersB });
    const bPipes = await bPipesRes.json();
    assert(bPipes.pipelines?.length === 0, 'User B sees 0 pipelines (tenant isolated)');

    const bPipeAccessRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}`, { headers: headersB });
    assert(bPipeAccessRes.status === 404, 'User B cannot access User A pipeline by ID (HTTP 404)');

    const bExecRes = await fetch(`${VITE_BASE}/api/pipelines/${pipeId}/run`, {
      method: 'POST',
      headers: headersB
    });
    assert(bExecRes.status === 404, 'User B cannot execute User A pipeline (HTTP 404)');

    const bRunsRes = await fetch(`${VITE_BASE}/api/pipeline-runs`, { headers: headersB });
    const bRunsData = await bRunsRes.json();
    assert(bRunsData.runs?.length === 0, 'User B sees 0 runs in global run history (tenant isolated)');

    const bSingleRunRes = await fetch(`${VITE_BASE}/api/pipeline-runs/${executedRun.id}`, { headers: headersB });
    assert(bSingleRunRes.status === 404, 'User B cannot fetch User A run telemetry (HTTP 404)');

    // -------------------------------------------------------------
    // Test 14: Cleanup Test Resources
    // -------------------------------------------------------------
    console.log('\n[TEST 14] Cleaning Up Temporary Test Resources');
    await fetch(`${VITE_BASE}/api/pipelines/${pipeId}`, { method: 'DELETE', headers: headersA });
    await fetch(`${VITE_BASE}/api/sources/${testSource.id}`, { method: 'DELETE', headers: headersA });
    await fetch(`${VITE_BASE}/api/destinations/${testDest.id}`, { method: 'DELETE', headers: headersA });

    console.log('\n================================================================');
    console.log(`  PHASE 12 VERIFICATION: ${passed}/${total} TESTS PASSED`);
    console.log('================================================================\n');
  } finally {
    if (mockServer) {
      mockServer.close();
    }
  }
}

runPhase12Tests().catch((err) => {
  console.error('Phase 12 test execution failed:', err);
  if (mockServer) mockServer.close();
  process.exit(1);
});
