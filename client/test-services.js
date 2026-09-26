/**
 * Lightweight verification script for client API services against live backend.
 */
import mongoose from '../server/node_modules/mongoose/index.js';
import app from '../server/server.js';
import {
  api,
  authService,
  sourceService,
  destinationService,
  pipelineService,
  pipelineRunService
} from './src/services/index.js';

const PORT = 3094;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ricozingest_jwt_secret_dev_key';
process.env.VITE_API_URL = `http://127.0.0.1:${PORT}/api`;
api.setBaseUrl(`http://127.0.0.1:${PORT}/api`);

// Simple memory storage polyfill for Node.js test environment
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) || null,
  setItem: (key, val) => store.set(key, String(val)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
};

const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✅ ${message}`);
};

async function runServiceTests() {
  console.log('====================================================');
  console.log('  TESTING CLIENT API SERVICE LAYER (STEP 13 PHASE 3)');
  console.log('====================================================\n');

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ricozingest');
    console.log('Connected to MongoDB');
  }

  const server = await new Promise((resolve) => {
    const s = app.listen(PORT, () => {
      console.log(`Test backend listening on port ${PORT}`);
      resolve(s);
    });
  });

  try {
    const timestamp = Date.now();
    const testEmail = `service_test_${timestamp}@test.com`;
    const testPassword = 'Password123!';

    // 1. authService: login with bad credentials should reject and normalize error
    console.log('[1] Testing authService.login error normalization');
    try {
      await authService.login({ email: testEmail, password: 'wrongpassword' });
      assert(false, 'Expected login with non-existent user to throw');
    } catch (err) {
      assert(err.status === 401, 'Normalized error status is 401');
      assert(err.message === 'Invalid credentials', 'Normalized error message is "Invalid credentials"');
    }

    // 2. authService: register
    console.log('\n[2] Testing authService.register');
    const regRes = await authService.register({
      name: 'Service Test User',
      email: testEmail,
      password: testPassword
    });
    assert(regRes.user && regRes.user.email === testEmail, 'User registered successfully via authService');

    // 3. authService: login
    console.log('\n[3] Testing authService.login & token storage');
    const loginRes = await authService.login({
      email: testEmail,
      password: testPassword
    });
    assert(loginRes.token && authService.isAuthenticated(), 'Token stored and isAuthenticated() returns true');
    assert(authService.getToken() === loginRes.token, 'getToken() returns active JWT');

    // 4. authService: getMe
    console.log('\n[4] Testing authService.getMe with automatic bearer token');
    const meRes = await authService.getMe();
    assert(meRes.user && meRes.user.email === testEmail, 'getMe() returned authenticated user profile');

    // 5. sourceService: getSources & createSource
    console.log('\n[5] Testing sourceService.getSources & createSource');
    const initialSources = await sourceService.getSources();
    assert(Array.isArray(initialSources.sources), 'getSources() returns sources array');

    const createdSource = await sourceService.createSource({
      name: `Test Source ${timestamp}`,
      type: 'REST_API',
      config: { url: 'https://jsonplaceholder.typicode.com/posts' }
    });
    assert(createdSource.source && createdSource.source.id, 'createSource() created source with ID');

    const singleSource = await sourceService.getSourceById(createdSource.source.id);
    assert(singleSource.source.id === createdSource.source.id, 'getSourceById() retrieved correct source');

    // 6. destinationService: getDestinations & createDestination
    console.log('\n[6] Testing destinationService.getDestinations & createDestination');
    const initialDests = await destinationService.getDestinations();
    assert(Array.isArray(initialDests.destinations), 'getDestinations() returns destinations array');

    const createdDest = await destinationService.createDestination({
      name: `Test Dest ${timestamp}`,
      type: 'MONGODB',
      config: {
        uri: 'mongodb://127.0.0.1:27017',
        database: 'ricozingest',
        collection: `test_dest_${timestamp}`
      }
    });
    assert(createdDest.destination && createdDest.destination.id, 'createDestination() created destination');
    // Ensure sensitive fields (uri, password) are sanitized
    assert(createdDest.destination.config.uri === undefined, 'Sensitive URI is NOT exposed in response');

    // 7. pipelineService: create, get, update, delete
    console.log('\n[7] Testing pipelineService CRUD & endpoints');
    const createdPipe = await pipelineService.createPipeline({
      name: `Test Pipeline ${timestamp}`,
      sourceId: createdSource.source.id,
      destinationId: createdDest.destination.id
    });
    assert(createdPipe.pipeline && createdPipe.pipeline.id, 'createPipeline() created pipeline');

    const pipeId = createdPipe.pipeline.id;
    const singlePipe = await pipelineService.getPipelineById(pipeId);
    assert(singlePipe.pipeline.id === pipeId, 'getPipelineById() returned pipeline');

    // Schedule endpoints
    const sched = await pipelineService.getSchedule(pipeId);
    assert(sched.schedule !== undefined, 'getSchedule() returned schedule config');

    const updatedSched = await pipelineService.updateSchedule(pipeId, {
      type: 'INTERVAL',
      expression: '30m'
    });
    assert(updatedSched.schedule.expression === '30m', 'updateSchedule() updated expression');

    const enabledSched = await pipelineService.enableSchedule(pipeId);
    assert(enabledSched.schedule.enabled === true, 'enableSchedule() enabled schedule');

    const disabledSched = await pipelineService.disableSchedule(pipeId);
    assert(disabledSched.schedule.enabled === false, 'disableSchedule() disabled schedule');

    // Transformation endpoints
    const trans = await pipelineService.getTransformations(pipeId);
    assert(trans.transformations !== undefined, 'getTransformations() returned transformation config');

    const updatedTrans = await pipelineService.updateTransformations(pipeId, {
      enabled: true,
      includeUnmapped: false,
      fieldMappings: [{ sourceField: 'title', destinationField: 'postTitle', transformRule: 'UPPERCASE' }]
    });
    assert(updatedTrans.transformations.enabled === true, 'updateTransformations() saved configuration');

    const preview = await pipelineService.previewTransformations(pipeId, {
      sampleRecords: [{ title: 'hello test' }]
    });
    assert(preview.preview.sampleTransformed[0].postTitle === 'HELLO TEST', 'previewTransformations() previewed mapping');

    // 8. pipelineRunService: getRuns
    console.log('\n[8] Testing pipelineRunService.getRuns');
    const runsRes = await pipelineRunService.getRuns({ page: 1, limit: 10 });
    assert(Array.isArray(runsRes.runs), 'getRuns() returns runs array');
    assert(runsRes.pagination && runsRes.pagination.page === 1, 'getRuns() returns pagination metadata');

    // 9. Cleanup created test source, destination, pipeline
    console.log('\n[9] Cleaning up test entities');
    await pipelineService.deletePipeline(pipeId);
    await sourceService.deleteSource(createdSource.source.id);
    await destinationService.deleteDestination(createdDest.destination.id);
    assert(true, 'Test entities deleted successfully');

    // 10. authService: logout
    authService.logout();
    assert(!authService.isAuthenticated(), 'logout() cleared token and isAuthenticated() returns false');

    console.log('\n====================================================');
    console.log('  🎉 ALL CLIENT API SERVICE TESTS PASSED! 🎉');
    console.log('====================================================\n');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

runServiceTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Service test failed:', err);
    process.exit(1);
  });
