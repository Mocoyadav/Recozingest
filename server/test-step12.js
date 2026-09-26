const http = require('http');
const mongoose = require('mongoose');
const crypto = require('crypto');
const app = require('./server');
const PipelineRun = require('./src/models/PipelineRun');
const Pipeline = require('./src/models/Pipeline');
const Source = require('./src/models/Source');
const Destination = require('./src/models/Destination');
const TransformationService = require('./src/services/transformation.service');
const schedulerService = require('./src/services/scheduler.service');

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

const runStep12Tests = async () => {
  console.log('====================================================');
  console.log('  RICOZINGEST - STEP 12 TRANSFORMATION ENGINE TESTS');
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

  // Start Controlled Mock Source Server
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
    // 1. UNIT TESTS: TRANSFORMATION SERVICE
    // ==========================================
    log(1, 'Unit Testing TransformationService Validation & Engine');

    // Validation checks
    assert(TransformationService.validateTransformationConfig(null).valid === false, 'null config is invalid');
    assert(TransformationService.validateTransformationConfig({ enabled: 'yes' }).valid === false, 'string enabled is invalid');
    assert(TransformationService.validateTransformationConfig({ fieldMappings: 'invalid' }).valid === false, 'non-array fieldMappings is invalid');
    assert(
      TransformationService.validateTransformationConfig({
        fieldMappings: [{ sourceField: 'id' }]
      }).valid === false,
      'mapping missing destinationField is invalid'
    );
    assert(
      TransformationService.validateTransformationConfig({
        fieldMappings: [{ sourceField: 'id', destinationField: 'externalId', dataType: 'UNKNOWN_TYPE' }]
      }).valid === false,
      'invalid dataType is rejected'
    );
    assert(
      TransformationService.validateTransformationConfig({
        fieldMappings: [{ sourceField: 'id', destinationField: 'externalId', transformRule: 'UNKNOWN_RULE' }]
      }).valid === false,
      'invalid transformRule is rejected'
    );
    assert(
      TransformationService.validateTransformationConfig({
        enabled: true,
        includeUnmapped: false,
        addMetadata: true,
        fieldMappings: [
          { sourceField: 'id', destinationField: 'externalId', dataType: 'NUMBER' },
          { sourceField: 'name', destinationField: 'customerName', transformRule: 'UPPERCASE' }
        ]
      }).valid === true,
      'valid configuration passes validation'
    );

    // Pass-through test when disabled
    const rawSample = { id: 10, name: 'Alice', secret: 'xyz123' };
    const disabledResult = TransformationService.transformRecord(rawSample, { enabled: false });
    assert(disabledResult.id === 10 && disabledResult.name === 'Alice' && disabledResult.secret === 'xyz123', 'Disabled transformations pass-through original record untouched');

    // Field Renaming & Projection
    const projectedResult = TransformationService.transformRecord(
      rawSample,
      {
        enabled: true,
        includeUnmapped: false,
        fieldMappings: [
          { sourceField: 'id', destinationField: 'externalId' },
          { sourceField: 'name', destinationField: 'fullName' }
        ]
      }
    );
    assert(projectedResult.externalId === 10, 'Field id mapped to externalId');
    assert(projectedResult.fullName === 'Alice', 'Field name mapped to fullName');
    assert(projectedResult.secret === undefined, 'Unmapped field secret omitted when includeUnmapped is false');
    assert(projectedResult.id === undefined, 'Original sourceField id removed');

    // Retaining unmapped fields
    const retainedResult = TransformationService.transformRecord(
      rawSample,
      {
        enabled: true,
        includeUnmapped: true,
        fieldMappings: [
          { sourceField: 'id', destinationField: 'externalId' }
        ]
      }
    );
    assert(retainedResult.externalId === 10, 'externalId exists');
    assert(retainedResult.name === 'Alice', 'name preserved when includeUnmapped is true');
    assert(retainedResult.secret === 'xyz123', 'secret preserved when includeUnmapped is true');
    assert(retainedResult.id === undefined, 'renamed sourceField id removed from result to prevent duplication');

    // Data Type Casting
    const castingSample = {
      strNum: '42',
      numStr: 99,
      boolTrue: 'true',
      boolFalse: '0',
      isoDate: '2026-05-15T12:00:00.000Z',
      jsonStr: '{"role":"admin","active":true}'
    };

    const castConfig = {
      enabled: true,
      includeUnmapped: false,
      fieldMappings: [
        { sourceField: 'strNum', destinationField: 'num', dataType: 'NUMBER' },
        { sourceField: 'numStr', destinationField: 'str', dataType: 'STRING' },
        { sourceField: 'boolTrue', destinationField: 'b1', dataType: 'BOOLEAN' },
        { sourceField: 'boolFalse', destinationField: 'b2', dataType: 'BOOLEAN' },
        { sourceField: 'isoDate', destinationField: 'd', dataType: 'DATE' },
        { sourceField: 'jsonStr', destinationField: 'parsed', dataType: 'JSON' }
      ]
    };

    const castResult = TransformationService.transformRecord(castingSample, castConfig);
    assert(castResult.num === 42 && typeof castResult.num === 'number', 'Cast to NUMBER');
    assert(castResult.str === '99' && typeof castResult.str === 'string', 'Cast to STRING');
    assert(castResult.b1 === true && typeof castResult.b1 === 'boolean', 'Cast "true" to BOOLEAN true');
    assert(castResult.b2 === false && typeof castResult.b2 === 'boolean', 'Cast "0" to BOOLEAN false');
    assert(castResult.d instanceof Date && castResult.d.toISOString() === '2026-05-15T12:00:00.000Z', 'Cast to DATE');
    assert(castResult.parsed?.role === 'admin' && castResult.parsed?.active === true, 'Cast to JSON');

    // Default Values
    const missingSample = { existing: 'val' };
    const defaultConfig = {
      enabled: true,
      includeUnmapped: false,
      fieldMappings: [
        { sourceField: 'missingField', destinationField: 'targetField', defaultValue: 'DEFAULT_FALLBACK' },
        { sourceField: 'nullField', destinationField: 'nullTarget', defaultValue: 100, dataType: 'NUMBER' }
      ]
    };
    const defaultResult = TransformationService.transformRecord(missingSample, defaultConfig);
    assert(defaultResult.targetField === 'DEFAULT_FALLBACK', 'Default applied for undefined field');
    assert(defaultResult.nullTarget === 100, 'Default applied for null/missing field with type cast');

    // String & Security Rules: UPPERCASE, LOWERCASE, TRIM, MASK_REDACT, MASK_HASH
    const stringSample = {
      rawUpper: 'hello world',
      rawLower: 'GOODBYE WORLD',
      rawTrim: '   trimmed text   ',
      apiKey: 'sk-live-secret-key-12345',
      userEmail: 'alice@example.com'
    };

    const expectedHash = crypto.createHash('sha256').update('alice@example.com').digest('hex');

    const ruleConfig = {
      enabled: true,
      includeUnmapped: false,
      fieldMappings: [
        { sourceField: 'rawUpper', destinationField: 'upper', transformRule: 'UPPERCASE' },
        { sourceField: 'rawLower', destinationField: 'lower', transformRule: 'LOWERCASE' },
        { sourceField: 'rawTrim', destinationField: 'trimmed', transformRule: 'TRIM' },
        { sourceField: 'apiKey', destinationField: 'redactedKey', transformRule: 'MASK_REDACT' },
        { sourceField: 'userEmail', destinationField: 'hashedEmail', transformRule: 'MASK_HASH' }
      ]
    };

    const ruleResult = TransformationService.transformRecord(stringSample, ruleConfig);
    assert(ruleResult.upper === 'HELLO WORLD', 'UPPERCASE rule applied');
    assert(ruleResult.lower === 'goodbye world', 'LOWERCASE rule applied');
    assert(ruleResult.trimmed === 'trimmed text', 'TRIM rule applied');
    assert(ruleResult.redactedKey === '[REDACTED]', 'MASK_REDACT rule applied');
    assert(ruleResult.hashedEmail === expectedHash, 'MASK_HASH SHA-256 rule applied');

    // Metadata injection
    const metaResult = TransformationService.transformRecord(
      { id: 1 },
      { enabled: true, addMetadata: true, fieldMappings: [{ sourceField: 'id', destinationField: 'id' }] },
      { pipelineId: 'pipeline123' }
    );
    assert(metaResult._ingestedAt instanceof Date, 'Metadata _ingestedAt injected');
    assert(metaResult._pipelineId === 'pipeline123', 'Metadata _pipelineId injected');

    // ==========================================
    // 2. SETUP AUTHENTICATED USERS & PIPELINES
    // ==========================================
    log(2, 'Registering and Authenticating User A and User B');
    const userAEmail = `step12_usera_${timestamp}@test.com`;
    const userBEmail = `step12_userb_${timestamp}@test.com`;
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
    const { token: tokenA, user: userA } = await loginARes.json();

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
    const { token: tokenB, user: userB } = await loginBRes.json();
    assert(tokenA && tokenB, 'Users registered and logged in successfully');

    // Configure initial mock dataset
    mockDataset = [
      { id: 1, name: 'bob smith', email: 'bob@company.com', ssn: '123-45-6789', notes: 'internal note 1' },
      { id: 2, name: 'charlie brown', email: 'charlie@company.com', ssn: '987-65-4321', notes: 'internal note 2' },
      { id: 3, name: 'diana prince', email: 'diana@company.com', ssn: '555-55-5555', notes: 'internal note 3' }
    ];

    // Create Source for User A
    const sourceRes = await fetch(`${BASE_URL}/api/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        name: `Step12 Source ${timestamp}`,
        type: 'REST_API',
        config: {
          url: `http://127.0.0.1:${MOCK_SOURCE_PORT}/posts`,
          method: 'GET'
        }
      })
    });
    const sourceData = await sourceRes.json();
    const sourceAId = sourceData.source.id;

    // Create Destination for User A
    const destCollection = `step12_dest_${timestamp}`;
    const destRes = await fetch(`${BASE_URL}/api/destinations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        name: `Step12 Dest ${timestamp}`,
        type: 'MONGODB',
        config: {
          uri: 'mongodb://127.0.0.1:27017',
          database: 'ricozingest',
          collection: destCollection
        }
      })
    });
    const destData = await destRes.json();
    const destAId = destData.destination.id;

    // Create Pipeline for User A
    const pipeRes = await fetch(`${BASE_URL}/api/pipelines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        name: `Step12 Pipeline ${timestamp}`,
        sourceId: sourceAId,
        destinationId: destAId
      })
    });
    const pipeData = await pipeRes.json();
    const pipelineAId = pipeData.pipeline.id;
    assert(pipelineAId, 'Created User A pipeline successfully');

    // ==========================================
    // 3. API TESTS: GET, PUT, & PREVIEW TRANSFORMS
    // ==========================================
    log(3, 'Testing Transformation API Endpoints (GET, PUT, PREVIEW)');

    // GET /api/pipelines/:id/transform
    const getTransRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineAId}/transform`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const getTransData = await getTransRes.json();
    assert(getTransRes.status === 200, 'GET /transform returns 200');
    assert(getTransData.transformations.enabled === false, 'Default transformations.enabled is false');
    assert(getTransData.transformations.includeUnmapped === true, 'Default includeUnmapped is true');

    // PUT /api/pipelines/:id/transform (Validation error)
    const badPutRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineAId}/transform`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        fieldMappings: [{ sourceField: 'id' }] // missing destinationField
      })
    });
    assert(badPutRes.status === 400, 'PUT /transform rejects invalid mapping configuration with 400');

    // PUT /api/pipelines/:id/transform (Valid configuration)
    const validTransformConfig = {
      enabled: true,
      includeUnmapped: false,
      addMetadata: true,
      fieldMappings: [
        { sourceField: 'id', destinationField: 'externalId', dataType: 'NUMBER' },
        { sourceField: 'name', destinationField: 'fullName', transformRule: 'UPPERCASE' },
        { sourceField: 'email', destinationField: 'hashedEmail', transformRule: 'MASK_HASH' },
        { sourceField: 'ssn', destinationField: 'ssn', transformRule: 'MASK_REDACT' },
        { sourceField: 'tier', destinationField: 'membershipTier', defaultValue: 'STANDARD' }
      ]
    };

    const goodPutRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineAId}/transform`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify(validTransformConfig)
    });
    const goodPutData = await goodPutRes.json();
    assert(goodPutRes.status === 200, 'PUT /transform succeeds with 200');
    assert(goodPutData.transformations.enabled === true, 'Updated transformations.enabled is true');
    assert(goodPutData.transformations.fieldMappings.length === 5, '5 field mappings stored');

    // POST /api/pipelines/:id/transform/preview with sample records
    const samplePayload = [
      { id: 99, name: 'eve online', email: 'eve@eve.com', ssn: '000-00-0000', notes: 'sample note' }
    ];
    const previewRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineAId}/transform/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ sampleRecords: samplePayload })
    });
    const previewData = await previewRes.json();
    assert(previewRes.status === 200, 'POST /transform/preview returns 200');
    assert(previewData.preview.transformedCount === 1, 'Preview transformedCount is 1');
    const previewTrans = previewData.preview.sampleTransformed[0];
    assert(previewTrans.externalId === 99, 'Preview externalId mapped');
    assert(previewTrans.fullName === 'EVE ONLINE', 'Preview fullName uppercase');
    assert(previewTrans.ssn === '[REDACTED]', 'Preview ssn redacted');
    assert(previewTrans.hashedEmail === crypto.createHash('sha256').update('eve@eve.com').digest('hex'), 'Preview hashedEmail hashed');
    assert(previewTrans.membershipTier === 'STANDARD', 'Preview membershipTier default applied');
    assert(previewTrans.notes === undefined, 'Preview unmapped notes omitted');

    // Verify Destination database has 0 documents after preview!
    const destDb = mongoose.connection.useDb('ricozingest');
    const destColl = destDb.collection(destCollection);
    const countAfterPreview = await destColl.countDocuments();
    assert(countAfterPreview === 0, 'Preview endpoint did NOT write to the destination database');

    // POST /api/pipelines/:id/transform/preview without sampleRecords (auto-fetch from source)
    const autoPreviewRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineAId}/transform/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({})
    });
    const autoPreviewData = await autoPreviewRes.json();
    assert(autoPreviewRes.status === 200, 'POST /transform/preview auto-fetch returns 200');
    assert(autoPreviewData.preview.originalCount === 3, 'Preview auto-fetched 3 records from source');
    assert(autoPreviewData.preview.sampleTransformed[0].fullName === 'BOB SMITH', 'Preview auto-transformed source record');

    // ==========================================
    // 4. PIPELINE EXECUTION WITH TRANSFORMATION
    // ==========================================
    log(4, 'Executing Pipeline with Transformation Engine Enabled');

    const runRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineAId}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const runData = await runRes.json();
    assert(runRes.status === 200, 'POST /api/pipelines/:id/run returns 200');
    assert(runData.run.status === 'SUCCESS', 'Pipeline run status is SUCCESS');
    assert(runData.run.recordsExtracted === 3, 'recordsExtracted is 3');
    assert(runData.run.recordsTransformed === 3, 'recordsTransformed is 3');
    assert(runData.run.recordsLoaded === 3, 'recordsLoaded is 3');

    // Inspect MongoDB destination documents
    const loadedDocs = await destColl.find().toArray();
    assert(loadedDocs.length === 3, 'Loaded exactly 3 transformed documents to destination');
    const doc1 = loadedDocs.find((d) => d.externalId === 1);
    assert(doc1 !== undefined, 'Found document with externalId: 1');
    assert(doc1.fullName === 'BOB SMITH', 'fullName transformed to UPPERCASE in destination');
    assert(doc1.ssn === '[REDACTED]', 'ssn masked with [REDACTED] in destination');
    assert(
      doc1.hashedEmail === crypto.createHash('sha256').update('bob@company.com').digest('hex'),
      'email masked with SHA-256 in destination'
    );
    assert(doc1.membershipTier === 'STANDARD', 'defaultValue STANDARD applied in destination');
    assert(doc1.notes === undefined, 'unmapped field notes omitted in destination');
    assert(doc1.id === undefined, 'original field id not present in destination');
    assert(doc1._ingestedAt !== undefined, 'metadata _ingestedAt saved in destination');
    assert(doc1._pipelineId === pipelineAId, 'metadata _pipelineId matches pipeline ID in destination');

    // Verify PipelineRun history
    const historyRes = await fetch(`${BASE_URL}/api/pipeline-runs/${runData.run.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const historyData = await historyRes.json();
    assert(historyRes.status === 200, 'GET /api/pipeline-runs/:id returns 200');
    assert(historyData.run.recordsTransformed === 3, 'PipelineRun model persists recordsTransformed: 3');

    // Also verify GET /api/pipelines/:id/runs
    const pipeRunsRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineAId}/runs`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const pipeRunsData = await pipeRunsRes.json();
    assert(pipeRunsRes.status === 200, 'GET /api/pipelines/:id/runs returns 200');
    assert(pipeRunsData.runs[0].recordsTransformed === 3, 'GET /api/pipelines/:id/runs includes recordsTransformed: 3');

    // ==========================================
    // 5. INCREMENTAL SYNC WITH TRANSFORMATION
    // ==========================================
    log(5, 'Testing Incremental Sync Synergy with Data Transformation');

    // Create Incremental Pipeline with Transformation
    const incDestColl = `step12_inc_dest_${timestamp}`;
    const incDestRes = await fetch(`${BASE_URL}/api/destinations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        name: `Step12 Inc Dest ${timestamp}`,
        type: 'MONGODB',
        config: {
          uri: 'mongodb://127.0.0.1:27017',
          database: 'ricozingest',
          collection: incDestColl
        }
      })
    });
    const incDestData = await incDestRes.json();

    const incPipeRes = await fetch(`${BASE_URL}/api/pipelines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        name: `Step12 Inc Pipeline ${timestamp}`,
        sourceId: sourceAId,
        destinationId: incDestData.destination.id,
        syncMode: 'INCREMENTAL',
        cursorField: 'id', // Note: source field is 'id', but transformed destination field will be 'externalId'
        transformations: {
          enabled: true,
          includeUnmapped: true,
          fieldMappings: [
            { sourceField: 'id', destinationField: 'externalId' },
            { sourceField: 'name', destinationField: 'fullName', transformRule: 'UPPERCASE' }
          ]
        }
      })
    });
    const incPipeData = await incPipeRes.json();
    const incPipelineId = incPipeData.pipeline.id;

    // Run 1: Should extract 3 records, transform 3, load 3, update cursor to 3
    const incRun1 = await fetch(`${BASE_URL}/api/pipelines/${incPipelineId}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const incRun1Data = await incRun1.json();
    assert(incRun1Data.run.recordsExtracted === 3, 'Incremental Run 1 extracted 3 records');
    assert(incRun1Data.run.recordsTransformed === 3, 'Incremental Run 1 transformed 3 records');
    assert(incRun1Data.run.cursorValueAfter === 3, 'Cursor advanced to 3 using source field id despite renaming');

    // Run 2: Same data -> should extract 0 records, cursor unchanged
    const incRun2 = await fetch(`${BASE_URL}/api/pipelines/${incPipelineId}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const incRun2Data = await incRun2.json();
    assert(incRun2Data.run.recordsExtracted === 0, 'Incremental Run 2 extracted 0 new records');
    assert(incRun2Data.run.recordsTransformed === 0, 'Incremental Run 2 transformed 0 records');
    assert(incRun2Data.run.cursorValueAfter === 3, 'Cursor remains at 3');

    // ==========================================
    // 6. PIPELINE SCHEDULING WITH TRANSFORMATION
    // ==========================================
    log(6, 'Testing Scheduled Pipeline Execution with Data Transformation');

    // Configure Schedule on Pipeline A
    const schedEnableRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineAId}/schedule`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        enabled: true,
        type: 'INTERVAL',
        expression: '10m'
      })
    });
    assert(schedEnableRes.status === 200, 'PUT /api/pipelines/:id/schedule succeeded');

    // Set nextRunAt in the past so it is due
    await Pipeline.findByIdAndUpdate(pipelineAId, {
      'schedule.nextRunAt': new Date(Date.now() - 10000)
    });

    // Trigger scheduled pipeline execution via scheduler tick
    const tickCount = await schedulerService.tick();
    assert(tickCount >= 1, 'Scheduler tick processed due scheduled pipeline');

    // Verify scheduled run was recorded
    const schedRunsRes = await fetch(`${BASE_URL}/api/pipeline-runs?pipelineId=${pipelineAId}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const schedRunsData = await schedRunsRes.json();
    const scheduledRun = schedRunsData.runs.find((r) => r.triggeredBy === 'SCHEDULED');
    assert(scheduledRun !== undefined, 'Found run with triggeredBy: SCHEDULED');
    assert(scheduledRun.status === 'SUCCESS', 'Scheduled execution succeeded');
    assert(scheduledRun.recordsTransformed === 3, 'Scheduled execution transformed 3 records');

    // ==========================================
    // 7. TENANT ISOLATION & SECURITY
    // ==========================================
    log(7, 'Verifying Tenant Isolation on Transformation Endpoints');

    // User B attempts GET User A's transform
    const bGetRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineAId}/transform`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(bGetRes.status === 404, 'User B cannot GET User A transformation (404)');

    // User B attempts PUT User A's transform
    const bPutRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineAId}/transform`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`
      },
      body: JSON.stringify({ enabled: false })
    });
    assert(bPutRes.status === 404, 'User B cannot PUT User A transformation (404)');

    // User B attempts POST preview on User A's pipeline
    const bPreviewRes = await fetch(`${BASE_URL}/api/pipelines/${pipelineAId}/transform/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`
      },
      body: JSON.stringify({ sampleRecords: [{ id: 1 }] })
    });
    assert(bPreviewRes.status === 404, 'User B cannot PREVIEW User A transformation (404)');

    // ==========================================
    // 8. CLEANUP
    // ==========================================
    log(8, 'Cleaning up temporary test database collections');
    await destColl.drop().catch(() => {});
    const incDestCollObj = destDb.collection(incDestColl);
    await incDestCollObj.drop().catch(() => {});

    console.log('\n====================================================');
    console.log('  🎉 ALL STEP 12 TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('====================================================\n');
  } finally {
    if (mockSourceServer) {
      await new Promise((resolve) => mockSourceServer.close(resolve));
    }
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
};

if (require.main === module) {
  runStep12Tests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test run failed:', err);
      process.exit(1);
    });
}

module.exports = runStep12Tests;
