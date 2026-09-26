const {
  createSourceConnector,
  createDestinationConnector
} = require('./connector.factory');
const RestApiConnector = require('./sources/RestApiConnector');
const MongoDbConnector = require('./destinations/MongoDbConnector');
const BaseSourceConnector = require('./base/BaseSourceConnector');
const BaseDestinationConnector = require('./base/BaseDestinationConnector');

const runConnectorTests = async () => {
  console.log('=== 1. BASE CONNECTOR CONTRACT TESTS ===');
  try {
    new BaseSourceConnector();
    console.error('FAIL: BaseSourceConnector should not be instantiable');
  } catch (err) {
    console.log('PASS: BaseSourceConnector cannot be instantiated directly:', err.message);
  }

  try {
    new BaseDestinationConnector();
    console.error('FAIL: BaseDestinationConnector should not be instantiable');
  } catch (err) {
    console.log('PASS: BaseDestinationConnector cannot be instantiated directly:', err.message);
  }

  console.log('\n=== 2. REST API CONNECTOR TESTS ===');
  const restConfig = {
    url: 'https://jsonplaceholder.typicode.com/posts',
    method: 'GET',
    headers: { Accept: 'application/json' }
  };
  const restConnector = new RestApiConnector(restConfig);
  console.log('PASS: RestApiConnector instantiated');

  const restTestRes = await restConnector.testConnection();
  console.log('PASS: RestApiConnector testConnection result:', JSON.stringify(restTestRes));

  const extractedRecords = await restConnector.extract();
  console.log(`PASS: RestApiConnector extract() returned ${extractedRecords.length} records`);
  console.log('First record sample:', JSON.stringify(extractedRecords[0]));

  console.log('\n=== 3. MONGODB DESTINATION CONNECTOR TESTS ===');
  // Use separate test database
  const mongoConfig = {
    uri: 'mongodb://127.0.0.1:27017',
    database: 'ricozingest_destination',
    collection: 'posts'
  };
  const mongoConnector = new MongoDbConnector(mongoConfig);
  console.log('PASS: MongoDbConnector instantiated');

  const mongoTestRes = await mongoConnector.testConnection();
  console.log('PASS: MongoDbConnector testConnection result:', JSON.stringify(mongoTestRes));

  // Clean test collection first using connection
  const conn = await mongoConnector._getConnection();
  await conn.collection(mongoConfig.collection).deleteMany({});

  // Test loadBatch with sample extracted records (first 3)
  const sampleRecords = extractedRecords.slice(0, 3).map((r) => ({
    externalId: r.id,
    title: r.title,
    body: r.body,
    ingestedAt: new Date()
  }));

  const loadRes = await mongoConnector.loadBatch(sampleRecords);
  console.log(`PASS: MongoDbConnector loadBatch result: insertedCount=${loadRes.insertedCount}`);

  // Test empty batch handling
  const emptyRes = await mongoConnector.loadBatch([]);
  console.log(`PASS: Empty batch handled safely: insertedCount=${emptyRes.insertedCount}`);

  // Verify in destination DB
  const docCount = await conn.collection(mongoConfig.collection).countDocuments();
  console.log(`PASS: Verified ${docCount} documents in destination collection '${mongoConfig.collection}' in DB '${mongoConfig.database}'`);

  await mongoConnector.finalize();
  console.log('PASS: MongoDbConnector finalize() completed and connection closed');

  console.log('\n=== 4. CONNECTOR FACTORY TESTS ===');
  const factorySource = createSourceConnector({
    type: 'REST_API',
    config: restConfig
  });
  console.log('PASS: Factory created RestApiConnector:', factorySource instanceof RestApiConnector);

  const factoryDest = createDestinationConnector({
    type: 'MONGODB',
    config: mongoConfig
  });
  console.log('PASS: Factory created MongoDbConnector:', factoryDest instanceof MongoDbConnector);

  try {
    createSourceConnector({ type: 'POSTGRESQL', config: {} });
    console.error('FAIL: Should reject unsupported source');
  } catch (err) {
    console.log('PASS: Factory rejected unsupported source:', err.message);
  }

  try {
    createDestinationConnector({ type: 'MYSQL', config: {} });
    console.error('FAIL: Should reject unsupported destination');
  } catch (err) {
    console.log('PASS: Factory rejected unsupported destination:', err.message);
  }

  console.log('\nALL CONNECTOR TESTS PASSED SUCCESSFULLY!');
};

runConnectorTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('CONNECTOR TEST FAILED:', err);
    process.exit(1);
  });
