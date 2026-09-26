const http = require('http');
const mongoose = require('mongoose');
const app = require('./server');
const PipelineRun = require('./src/models/PipelineRun');
const Pipeline = require('./src/models/Pipeline');
const Source = require('./src/models/Source');
const Destination = require('./src/models/Destination');
const schedulerService = require('./src/services/scheduler.service');
const {
  validateScheduleExpression,
  calculateNextRun,
  parseIntervalMs
} = require('./src/utils/cron.util');

const TEST_PORT = 3096;
const MOCK_SOURCE_PORT = 3095;
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

const runStep11Tests = async () => {
  console.log('====================================================');
  console.log('  RICOZINGEST - STEP 11 PIPELINE SCHEDULING TESTS');
  console.log('====================================================');

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

  // Start Controlled Mock Source Server for Incremental Scheduled Ingestion
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
    // 1. UNIT TESTS: CRON & INTERVAL UTILITIES
    // ==========================================
    log(1, 'Testing Schedule Validation and Calculation Utilities');
    assert(validateScheduleExpression('INTERVAL', '15m').valid === true, '15m is a valid INTERVAL');
    assert(validateScheduleExpression('INTERVAL', '1h').valid === true, '1h is a valid INTERVAL');
    assert(validateScheduleExpression('INTERVAL', '1d').valid === true, '1d is a valid INTERVAL');
    assert(validateScheduleExpression('INTERVAL', 'invalid').valid === false, 'invalid is rejected as INTERVAL');
    assert(validateScheduleExpression('INTERVAL', '1s').valid === false, '1s under 5s is rejected');

    assert(validateScheduleExpression('CRON', '*/5 * * * *').valid === true, '*/5 * * * * is a valid CRON');
    assert(validateScheduleExpression('CRON', '0 * * * *').valid === true, '0 * * * * is a valid CRON');
    assert(validateScheduleExpression('CRON', '* * *').valid === false, '3-part cron is rejected');

    const nextInterval = calculateNextRun('INTERVAL', '10m');
    assert(nextInterval instanceof Date && nextInterval > new Date(), 'calculateNextRun for 10m returns future Date');

    const nextCron = calculateNextRun('CRON', '*/5 * * * *');
    assert(nextCron instanceof Date && nextCron > new Date(), 'calculateNextRun for cron returns future Date');

    // ==========================================
    // 2. SETUP AUTHENTICATED USERS
    // ==========================================
    log(2, 'Registering & Authenticating User A and User B');
    const userAEmail = `step11_usera_${timestamp}@test.com`;
    const userBEmail = `step11_userb_${timestamp}@test.com`;
    const password = 'Password123!';

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
    assert(userAToken != null, 'User A authenticated');

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
    // 3. CREATE SOURCE & DESTINATION & PIPELINE
    // ==========================================
    log(3, 'Creating Source, Destination, and Pipeline with Default Schedule');
    mockDataset = [
      { id: 1, title: 'Post 1' },
      { id: 2, title: 'Post 2' }
    ];

    const srcRes = await fetch(`${BASE_URL}/api/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        name: 'Step 11 Mock Source',
        type: 'REST_API',
        config: { url: `http://127.0.0.1:${MOCK_SOURCE_PORT}/posts` }
      })
    });
    const srcData = await srcRes.json();
    const sourceId = srcData.source.id;

    const dstRes = await fetch(`${BASE_URL}/api/destinations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        name: 'Step 11 Mock Destination',
        type: 'MONGODB',
        config: {
          uri: 'mongodb://127.0.0.1:27017',
          database: 'ricozingest_destination',
          collection: `step11_posts_${timestamp}`
        }
      })
    });
    const dstData = await dstRes.json();
    const destId = dstData.destination.id;

    const pipeRes = await fetch(`${BASE_URL}/api/pipelines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        name: 'Scheduled Incremental Pipeline',
        sourceId,
        destinationId: destId,
        syncMode: 'INCREMENTAL',
        cursorField: 'id'
      })
    });
    const pipeData = await pipeRes.json();
    const pipelineId = pipeData.pipeline.id;
    assert(pipeData.pipeline.schedule != null, 'Pipeline includes schedule object');
    assert(pipeData.pipeline.schedule.enabled === false, 'Schedule is initially disabled');
    assert(pipeData.pipeline.isRunning === false, 'isRunning is initially false');

    // ==========================================
    // 4. TEST SCHEDULE CONFIGURATION APIS
    // ==========================================
    log(4, 'Testing Schedule APIs: GET, PUT, Enable, Disable');
    // GET schedule
    const getSchedRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineId}/schedule`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const getSchedData = await getSchedRes.json();
    assert(getSchedRes.status === 200, 'GET /api/pipelines/:id/schedule returns 200');
    assert(getSchedData.schedule.enabled === false, 'Fetched schedule is disabled');

    // PUT invalid schedule
    const badSchedRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ type: 'INTERVAL', expression: 'invalid-expression' })
    });
    assert(badSchedRes.status === 400, 'PUT schedule with invalid expression returns 400');

    // PUT valid schedule with enable: true
    const putSchedRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ type: 'INTERVAL', expression: '15m', enabled: true })
    });
    const putSchedData = await putSchedRes.json();
    assert(putSchedRes.status === 200, 'PUT schedule returns 200');
    assert(putSchedData.schedule.enabled === true, 'Schedule enabled via PUT');
    assert(putSchedData.schedule.expression === '15m', 'Expression updated to 15m');
    assert(putSchedData.schedule.nextRunAt != null, 'nextRunAt calculated and populated');

    // PATCH disable
    const disRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineId}/schedule/disable`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const disData = await disRes.json();
    assert(disRes.status === 200, 'PATCH disable returns 200');
    assert(disData.schedule.enabled === false, 'Schedule disabled via PATCH');
    assert(disData.schedule.nextRunAt === null, 'nextRunAt cleared when disabled');

    // PATCH enable
    const enRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineId}/schedule/enable`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const enData = await enRes.json();
    assert(enRes.status === 200, 'PATCH enable returns 200');
    assert(enData.schedule.enabled === true, 'Schedule enabled via PATCH');
    assert(enData.schedule.nextRunAt != null, 'nextRunAt calculated when enabled');

    // ==========================================
    // 5. TEST SCHEDULED EXECUTION VIA TICK
    // ==========================================
    log(5, 'Testing Scheduled Pipeline Execution (tick())');
    // Set nextRunAt in MongoDB to past date so it is due now
    await Pipeline.findByIdAndUpdate(pipelineId, {
      'schedule.nextRunAt': new Date(Date.now() - 10000)
    });

    // Run scheduler tick
    const processed = await schedulerService.tick();
    assert(processed >= 1, `schedulerService.tick() processed ${processed} due pipeline(s)`);

    // Verify Pipeline state after scheduled run
    const updatedPipe = await Pipeline.findById(pipelineId);
    assert(updatedPipe.schedule.lastScheduledRunAt != null, 'lastScheduledRunAt was updated');
    assert(new Date(updatedPipe.schedule.nextRunAt) > new Date(), 'nextRunAt was advanced to future Date');
    assert(updatedPipe.cursorValue === 2, 'Incremental cursor advanced to 2 via scheduled run');
    assert(updatedPipe.isRunning === false, 'isRunning is false (lock released)');

    // Verify PipelineRun history created with triggeredBy: 'SCHEDULED'
    const runsRes = await fetch(`${BASE_URL}/api/pipeline-runs?pipelineId=${pipelineId}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const runsData = await runsRes.json();
    assert(runsData.runs.length >= 1, 'PipelineRun record was created');
    const scheduledRun = runsData.runs[0];
    assert(scheduledRun.triggeredBy === 'SCHEDULED', 'PipelineRun recorded triggeredBy: SCHEDULED');
    assert(scheduledRun.status === 'SUCCESS', 'Scheduled PipelineRun status is SUCCESS');
    assert(scheduledRun.recordsExtracted === 2, 'Scheduled run extracted 2 records');
    assert(scheduledRun.recordsLoaded === 2, 'Scheduled run loaded 2 records');

    // ==========================================
    // 6. TEST INACTIVE PIPELINE SKIPPING
    // ==========================================
    log(6, 'Testing Inactive Pipeline Skipping');
    // Make pipeline INACTIVE and due
    await Pipeline.findByIdAndUpdate(pipelineId, {
      status: 'INACTIVE',
      'schedule.nextRunAt': new Date(Date.now() - 10000)
    });

    const inactiveTick = await schedulerService.tick();
    assert(inactiveTick === 0, 'Scheduler tick skipped INACTIVE pipeline');

    // Restore to ACTIVE
    await Pipeline.findByIdAndUpdate(pipelineId, { status: 'ACTIVE' });

    // ==========================================
    // 7. CONCURRENCY PROTECTION (409 CONFLICT)
    // ==========================================
    log(7, 'Testing Concurrency Protection: Lock & 409 Conflict');
    // Manually set isRunning = true in DB to simulate an ongoing run
    await Pipeline.findByIdAndUpdate(pipelineId, { isRunning: true });

    // Simultaneous manual execution attempt must return 409 Conflict
    const conflictRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineId}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert(conflictRes.status === 409, 'Manual execution while pipeline isRunning returns HTTP 409 Conflict');

    // Scheduler tick must also skip running pipeline
    await Pipeline.findByIdAndUpdate(pipelineId, {
      'schedule.nextRunAt': new Date(Date.now() - 10000)
    });
    const runningTick = await schedulerService.tick();
    assert(runningTick === 0, 'Scheduler tick skipped pipeline with isRunning: true');

    // Restore lock to false
    await Pipeline.findByIdAndUpdate(pipelineId, { isRunning: false });

    // ==========================================
    // 8. SCHEDULED INCREMENTAL SYNC WITH NEW RECORDS
    // ==========================================
    log(8, 'Testing Scheduled Incremental Ingestion with New Records');
    // Add 2 new records (id 3, 4)
    mockDataset.push({ id: 3, title: 'Post 3' }, { id: 4, title: 'Post 4' });

    // Set due
    await Pipeline.findByIdAndUpdate(pipelineId, {
      'schedule.nextRunAt': new Date(Date.now() - 10000)
    });

    await schedulerService.tick();

    const pipeAfterInc = await Pipeline.findById(pipelineId);
    assert(pipeAfterInc.cursorValue === 4, 'Scheduled incremental run advanced checkpoint to 4');

    const incRunsRes = await fetch(`${BASE_URL}/api/pipeline-runs?pipelineId=${pipelineId}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const incRunsData = await incRunsRes.json();
    assert(incRunsData.runs[0].recordsExtracted === 2, 'Scheduled run extracted only 2 new records');
    assert(incRunsData.runs[0].recordsLoaded === 2, 'Scheduled run loaded only 2 new records');
    assert(incRunsData.runs[0].cursorValueBefore === 2, 'cursorValueBefore was 2');
    assert(incRunsData.runs[0].cursorValueAfter === 4, 'cursorValueAfter was 4');

    // ==========================================
    // 9. SCHEDULED EXECUTION ERROR RESILIENCE
    // ==========================================
    log(9, 'Testing Scheduler Failure Tolerance (No Crash, Lock Release, Next Run Advanced)');
    // Temporarily point source to broken URL
    await Source.findByIdAndUpdate(sourceId, { 'config.url': 'http://127.0.0.1:9999/broken' });
    await Pipeline.findByIdAndUpdate(pipelineId, {
      'schedule.nextRunAt': new Date(Date.now() - 10000)
    });

    // Tick should NOT throw or crash
    await schedulerService.tick();

    const failedPipe = await Pipeline.findById(pipelineId);
    assert(failedPipe.isRunning === false, 'isRunning was reset to false after failure');
    assert(new Date(failedPipe.schedule.nextRunAt) > new Date(), 'nextRunAt was still advanced after failure');
    assert(failedPipe.cursorValue === 4, 'Checkpoint was preserved at 4 after failure');

    // Verify FAILED run was recorded
    const failRunsRes = await fetch(`${BASE_URL}/api/pipeline-runs?pipelineId=${pipelineId}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const failRunsData = await failRunsRes.json();
    assert(failRunsData.runs[0].status === 'FAILED', 'Recorded status FAILED for scheduled failure');
    assert(failRunsData.runs[0].triggeredBy === 'SCHEDULED', 'Recorded triggeredBy: SCHEDULED');

    // Restore healthy source URL
    await Source.findByIdAndUpdate(sourceId, { 'config.url': `http://127.0.0.1:${MOCK_SOURCE_PORT}/posts` });

    // ==========================================
    // 10. TENANT ISOLATION TESTS
    // ==========================================
    log(10, 'Testing Cross-User Tenant Isolation for Schedule APIs');
    // User B attempts to access User A's schedule
    const uBGet = await fetch(`${BASE_URL}/api/pipelines/${pipelineId}/schedule`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert(uBGet.status === 404, 'User B GET schedule returns 404');

    const uBPut = await fetch(`${BASE_URL}/api/pipelines/${pipelineId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userBToken}` },
      body: JSON.stringify({ type: 'INTERVAL', expression: '1h' })
    });
    assert(uBPut.status === 404, 'User B PUT schedule returns 404');

    const uBEn = await fetch(`${BASE_URL}/api/pipelines/${pipelineId}/schedule/enable`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert(uBEn.status === 404, 'User B enable schedule returns 404');

    const uBDis = await fetch(`${BASE_URL}/api/pipelines/${pipelineId}/schedule/disable`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert(uBDis.status === 404, 'User B disable schedule returns 404');

    // ==========================================
    // 11. MANUAL EXECUTION REGRESSION
    // ==========================================
    log(11, 'Testing Manual Execution (POST /api/pipelines/:id/run) Retains triggeredBy: MANUAL');
    const manualRunRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineId}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const manualRunData = await manualRunRes.json();
    assert(manualRunRes.status === 200, 'Manual execution returns 200');
    assert(manualRunData.run.triggeredBy === 'MANUAL', 'Manual run recorded triggeredBy: MANUAL');

    console.log('\n====================================================');
    console.log('  🎉 ALL STEP 11 TESTS PASSED SUCCESSFULLY! 🎉');
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

runStep11Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ STEP 11 TEST RUN FAILED:', err);
    process.exit(1);
  });
