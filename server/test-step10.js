const http = require('http');
const mongoose = require('mongoose');
const app = require('./server');
const PipelineRun = require('./src/models/PipelineRun');
const Pipeline = require('./src/models/Pipeline');
const Source = require('./src/models/Source');
const Destination = require('./src/models/Destination');
const MongoDbConnector = require('./src/connectors/destinations/MongoDbConnector');
const { compareCursor, isGreaterThanCursor, findMaxCursor } = require('./src/utils/cursor.util');

const TEST_PORT = 3098;
const MOCK_SOURCE_PORT = 3097;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

let serverInstance;
let mockSourceServer;
let mockDataset = [];

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

const runStep10Tests = async () => {
  console.log('====================================================');
  console.log('  RICOZINGEST - STEP 10 INCREMENTAL SYNC TEST SUITE');
  console.log('====================================================');

  // Connect to DB if needed
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ricozingest');
    console.log('Connected to MongoDB');
  }

  // Start Main HTTP Server
  await new Promise((resolve) => {
    serverInstance = app.listen(TEST_PORT, () => {
      console.log(`Test application server running on port ${TEST_PORT}`);
      resolve();
    });
  });

  // Start Controlled Mock Source Server for Incremental Data Streaming
  await new Promise((resolve) => {
    mockSourceServer = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(mockDataset));
    });
    mockSourceServer.listen(MOCK_SOURCE_PORT, () => {
      console.log(`Controlled mock source server running on port ${MOCK_SOURCE_PORT}`);
      resolve();
    });
  });

  try {
    const timestamp = Date.now();

    // ==========================================
    // 1. UNIT TESTS: CURSOR UTILITY
    // ==========================================
    log(1, 'Testing Cursor Utility Functions');
    assert(compareCursor(100, 95) > 0, 'compareCursor: 100 > 95');
    assert(compareCursor(50, 50) === 0, 'compareCursor: 50 === 50');
    assert(compareCursor(10, 20) < 0, 'compareCursor: 10 < 20');

    const t1 = '2026-09-24T12:00:00.000Z';
    const t2 = '2026-09-24T10:00:00.000Z';
    assert(compareCursor(t1, t2) > 0, 'compareCursor: later ISO timestamp > earlier timestamp');

    assert(isGreaterThanCursor(105, 100) === true, 'isGreaterThanCursor: 105 > 100');
    assert(isGreaterThanCursor(100, 100) === false, 'isGreaterThanCursor: 100 is not > 100');
    assert(isGreaterThanCursor(95, 100) === false, 'isGreaterThanCursor: 95 is not > 100');
    assert(isGreaterThanCursor(1, null) === true, 'isGreaterThanCursor: value is always > null cursor');

    const sampleBatch = [{ id: 10 }, { id: 45 }, { id: 22 }];
    assert(findMaxCursor(sampleBatch, 'id') === 45, 'findMaxCursor finds 45 as max id');
    assert(findMaxCursor([], 'id') === null, 'findMaxCursor returns null for empty batch');

    // ==========================================
    // 2. SETUP AUTHENTICATED USERS
    // ==========================================
    log(2, 'Registering & Authenticating User A and User B');
    const userAEmail = `step10_usera_${timestamp}@test.com`;
    const userBEmail = `step10_userb_${timestamp}@test.com`;
    const password = 'Password123!';

    // Register & Login User A
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User A', email: userAEmail, password })
    });
    const loginARes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userAEmail, password })
    });
    const loginAData = await loginARes.json();
    const userAToken = loginAData.token;
    const userAId = loginAData.user.id;
    assert(userAToken != null, 'User A authenticated');

    // Register & Login User B
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User B', email: userBEmail, password })
    });
    const loginBRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userBEmail, password })
    });
    const loginBData = await loginBRes.json();
    const userBToken = loginBData.token;
    assert(userBToken != null, 'User B authenticated');

    // ==========================================
    // 3. PIPELINE CREATION VALIDATION
    // ==========================================
    log(3, 'Validating Pipeline Creation with syncMode & cursorField');
    // Create Source & Destination
    const srcRes = await fetch(`${BASE_URL}/api/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        name: 'JSONPlaceholder Source',
        type: 'REST_API',
        config: { url: 'https://jsonplaceholder.typicode.com/posts' }
      })
    });
    const srcData = await srcRes.json();
    const sourceId = srcData.source.id;

    const dstRes = await fetch(`${BASE_URL}/api/destinations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        name: 'Incremental MongoDB Dest',
        type: 'MONGODB',
        config: {
          uri: 'mongodb://127.0.0.1:27017',
          database: 'ricozingest_destination',
          collection: `step10_posts_${timestamp}`
        }
      })
    });
    const dstData = await dstRes.json();
    const destId = dstData.destination.id;

    // Fail case: INCREMENTAL without cursorField
    const badPipeRes = await fetch(`${BASE_URL}/api/pipelines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        name: 'Invalid Incremental Pipeline',
        sourceId,
        destinationId: destId,
        syncMode: 'INCREMENTAL'
      })
    });
    assert(badPipeRes.status === 400, 'Rejects INCREMENTAL pipeline without cursorField (HTTP 400)');

    // Success case: INCREMENTAL with cursorField
    const incPipeRes = await fetch(`${BASE_URL}/api/pipelines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        name: 'Incremental Posts Pipeline',
        sourceId,
        destinationId: destId,
        syncMode: 'INCREMENTAL',
        cursorField: 'id'
      })
    });
    const incPipeData = await incPipeRes.json();
    assert(incPipeRes.status === 201, 'Creates INCREMENTAL pipeline successfully');
    assert(incPipeData.pipeline.syncMode === 'INCREMENTAL', 'Pipeline syncMode is INCREMENTAL');
    assert(incPipeData.pipeline.cursorField === 'id', 'Pipeline cursorField is id');
    assert(incPipeData.pipeline.cursorValue === null, 'Initial cursorValue is null');
    const pipelineId = incPipeData.pipeline.id;

    // ==========================================
    // 4. TEST FIRST FULL SYNC (BASELINE)
    // ==========================================
    log(4, 'Executing First Run: Baseline Full Sync (Expect 100 extracted, cursor -> 100)');
    const run1Res = await fetch(`${BASE_URL}/api/pipelines/${pipelineId}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const run1Data = await run1Res.json();
    assert(run1Res.status === 200, 'Run 1 returned HTTP 200');
    assert(run1Data.run.status === 'SUCCESS', 'Run 1 status is SUCCESS');
    assert(run1Data.run.recordsExtracted === 100, 'Run 1 extracted 100 records');
    assert(run1Data.run.recordsLoaded === 100, 'Run 1 loaded 100 records');
    assert(run1Data.run.syncMode === 'INCREMENTAL', 'Run 1 recorded syncMode INCREMENTAL');
    assert(run1Data.run.cursorValueBefore === null, 'Run 1 cursorValueBefore was null');
    assert(run1Data.run.cursorValueAfter === 100, 'Run 1 cursorValueAfter advanced to 100');

    // Verify Pipeline document in MongoDB
    const pipeDocAfterRun1 = await Pipeline.findById(pipelineId);
    assert(pipeDocAfterRun1.cursorValue === 100, 'Pipeline cursorValue updated to 100 in MongoDB');
    assert(pipeDocAfterRun1.lastSyncAt != null, 'Pipeline lastSyncAt populated in MongoDB');

    // ==========================================
    // 5. TEST NO-NEW-RECORDS INCREMENTAL SYNC
    // ==========================================
    log(5, 'Executing Second Run: No-New-Records Case (Expect 0 extracted, cursor stays 100)');
    const run2Res = await fetch(`${BASE_URL}/api/pipelines/${pipelineId}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const run2Data = await run2Res.json();
    assert(run2Res.status === 200, 'Run 2 returned HTTP 200');
    assert(run2Data.run.status === 'SUCCESS', 'Run 2 status is SUCCESS');
    assert(run2Data.run.recordsExtracted === 0, 'Run 2 extracted 0 new records');
    assert(run2Data.run.recordsLoaded === 0, 'Run 2 loaded 0 records');
    assert(run2Data.run.cursorValueBefore === 100, 'Run 2 cursorValueBefore was 100');
    assert(run2Data.run.cursorValueAfter === 100, 'Run 2 cursorValueAfter remained 100');

    // Verify Pipeline in MongoDB was not corrupted
    const pipeDocAfterRun2 = await Pipeline.findById(pipelineId);
    assert(pipeDocAfterRun2.cursorValue === 100, 'Pipeline cursorValue remained 100 in MongoDB');

    // ==========================================
    // 6. CONTROLLED TEST: NEW RECORDS ARRIVING
    // ==========================================
    log(6, 'Testing Incremental Sync with Controlled Dynamic Mock Source');
    // Set initial 10 records on mock server
    mockDataset = [];
    for (let i = 1; i <= 10; i++) {
      mockDataset.push({ id: i, title: `Post ${i}`, body: `Content of post ${i}` });
    }

    // Create source pointing to mock server
    const mockSrcRes = await fetch(`${BASE_URL}/api/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        name: 'Controlled Mock Source',
        type: 'REST_API',
        config: { url: `http://127.0.0.1:${MOCK_SOURCE_PORT}/posts` }
      })
    });
    const mockSrcData = await mockSrcRes.json();
    const mockSrcId = mockSrcData.source.id;

    // Create mock destination
    const mockDstRes = await fetch(`${BASE_URL}/api/destinations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        name: 'Mock Test Destination',
        type: 'MONGODB',
        config: {
          uri: 'mongodb://127.0.0.1:27017',
          database: 'ricozingest_destination',
          collection: `step10_mock_posts_${timestamp}`
        }
      })
    });
    const mockDstData = await mockDstRes.json();
    const mockDstId = mockDstData.destination.id;

    // Create pipeline for mock source
    const mockPipeRes = await fetch(`${BASE_URL}/api/pipelines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        name: 'Controlled Mock Pipeline',
        sourceId: mockSrcId,
        destinationId: mockDstId,
        syncMode: 'INCREMENTAL',
        cursorField: 'id'
      })
    });
    const mockPipeData = await mockPipeRes.json();
    const mockPipelineId = mockPipeData.pipeline.id;

    // Run 1: Initial sync (10 records: id 1..10)
    const mockRun1Res = await fetch(`${BASE_URL}/api/pipelines/${mockPipelineId}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const mockRun1Data = await mockRun1Res.json();
    assert(mockRun1Data.run.recordsExtracted === 10, 'Mock Run 1 extracted 10 records');
    assert(mockRun1Data.run.recordsLoaded === 10, 'Mock Run 1 loaded 10 records');
    assert(mockRun1Data.run.cursorValueAfter === 10, 'Mock Run 1 checkpoint advanced to 10');

    // Simulate 5 NEW records arriving in source (id 11..15)
    for (let i = 11; i <= 15; i++) {
      mockDataset.push({ id: i, title: `New Post ${i}`, body: `Content of new post ${i}` });
    }
    assert(mockDataset.length === 15, 'Mock dataset now has 15 total items');

    // Run 2: Incremental sync (should extract ONLY the 5 new records with id > 10)
    const mockRun2Res = await fetch(`${BASE_URL}/api/pipelines/${mockPipelineId}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const mockRun2Data = await mockRun2Res.json();
    assert(mockRun2Data.run.recordsExtracted === 5, 'Mock Run 2 extracted ONLY 5 new records');
    assert(mockRun2Data.run.recordsLoaded === 5, 'Mock Run 2 loaded ONLY 5 new records');
    assert(mockRun2Data.run.cursorValueBefore === 10, 'Mock Run 2 cursorValueBefore was 10');
    assert(mockRun2Data.run.cursorValueAfter === 15, 'Mock Run 2 checkpoint advanced to 15');

    const mockPipeDocAfterRun2 = await Pipeline.findById(mockPipelineId);
    assert(mockPipeDocAfterRun2.cursorValue === 15, 'Pipeline checkpoint committed as 15 in MongoDB');

    // ==========================================
    // 7. TEST EXTRACTION FAILURE (CHECKPOINT UNCHANGED)
    // ==========================================
    log(7, 'Testing Extraction Failure: Checkpoint Must NOT Advance');
    // Temporarily break source URL
    await Source.findByIdAndUpdate(mockSrcId, { 'config.url': 'http://127.0.0.1:9999/broken' });

    const failExtractRes = await fetch(`${BASE_URL}/api/pipelines/${mockPipelineId}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(failExtractRes.status === 500, 'Extraction failure returns HTTP 500');

    // Checkpoint in MongoDB MUST remain 15
    const pipeDocAfterExtractFail = await Pipeline.findById(mockPipelineId);
    assert(pipeDocAfterExtractFail.cursorValue === 15, 'Pipeline checkpoint remained 15 after extraction failure');

    // Restore source URL
    await Source.findByIdAndUpdate(mockSrcId, { 'config.url': `http://127.0.0.1:${MOCK_SOURCE_PORT}/posts` });

    // ==========================================
    // 8. TEST DESTINATION FAILURE (CHECKPOINT UNCHANGED)
    // ==========================================
    log(8, 'Testing Destination Load Failure: Checkpoint Must NOT Advance');
    // Add 2 more records so extraction would succeed (id 16, 17)
    mockDataset.push({ id: 16, title: 'Post 16' }, { id: 17, title: 'Post 17' });

    // Spy / mock destination loadBatch to throw error
    let finalizeWasCalled = false;
    const originalLoadBatch = MongoDbConnector.prototype.loadBatch;
    const originalFinalize = MongoDbConnector.prototype.finalize;

    MongoDbConnector.prototype.loadBatch = async function() {
      throw new Error('Simulated destination disk write error');
    };
    MongoDbConnector.prototype.finalize = async function() {
      finalizeWasCalled = true;
      return originalFinalize.apply(this, arguments);
    };

    try {
      const failLoadRes = await fetch(`${BASE_URL}/api/pipelines/${mockPipelineId}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      assert(failLoadRes.status === 500, 'Destination failure returned HTTP 500');
    } finally {
      MongoDbConnector.prototype.loadBatch = originalLoadBatch;
      MongoDbConnector.prototype.finalize = originalFinalize;
    }

    assert(finalizeWasCalled === true, 'destinationConnector.finalize() was executed in finally block');

    // Checkpoint MUST still be 15 (id 16 & 17 were NOT committed!)
    const pipeDocAfterLoadFail = await Pipeline.findById(mockPipelineId);
    assert(
      pipeDocAfterLoadFail.cursorValue === 15,
      'Pipeline checkpoint remained 15 (did not advance to 17 after load failure)'
    );

    // Now re-run with working destination: records 16 & 17 should now be properly ingested!
    const retryRes = await fetch(`${BASE_URL}/api/pipelines/${mockPipelineId}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const retryData = await retryRes.json();
    assert(retryData.run.status === 'SUCCESS', 'Retry after destination fix succeeded');
    assert(retryData.run.recordsExtracted === 2, 'Retry extracted the uncommitted 2 records (16 & 17)');
    assert(retryData.run.recordsLoaded === 2, 'Retry loaded the 2 records');
    assert(retryData.run.cursorValueAfter === 17, 'Checkpoint finally advanced to 17');

    // ==========================================
    // 9. CROSS-USER TENANT ISOLATION
    // ==========================================
    log(9, 'Testing Cross-User Tenant Isolation for Incremental Pipelines');
    // User B attempts to view User A's pipeline
    const crossGetRes = await fetch(`${BASE_URL}/api/pipelines/${mockPipelineId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert(crossGetRes.status === 404, 'User B viewing User A pipeline returns 404');

    // User B attempts to run User A's pipeline
    const crossRunRes = await fetch(`${BASE_URL}/api/pipelines/${mockPipelineId}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert(crossRunRes.status === 404, 'User B running User A pipeline returns 404');

    // ==========================================
    // 10. RUN HISTORY PERSISTENCE WITH INCREMENTAL FIELDS
    // ==========================================
    log(10, 'Testing Run History API with Incremental Sync Metadata');
    const runsRes = await fetch(`${BASE_URL}/api/pipeline-runs?pipelineId=${mockPipelineId}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const runsData = await runsRes.json();
    assert(runsRes.status === 200, 'GET /api/pipeline-runs returned 200');
    assert(runsData.runs.length >= 3, 'Multiple runs recorded for mock pipeline');
    const latestRun = runsData.runs[0];
    assert(latestRun.syncMode === 'INCREMENTAL', 'Run record contains syncMode: INCREMENTAL');
    assert(latestRun.cursorField === 'id', 'Run record contains cursorField: id');
    assert(latestRun.cursorValueBefore != null, 'Run record contains cursorValueBefore');
    assert(latestRun.cursorValueAfter != null, 'Run record contains cursorValueAfter');

    console.log('\n====================================================');
    console.log('  🎉 ALL STEP 10 TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('====================================================');
  } finally {
    if (mockSourceServer) {
      await new Promise((resolve) => mockSourceServer.close(resolve));
    }
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
  }
};

runStep10Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ STEP 10 TEST RUN FAILED:', err);
    process.exit(1);
  });
