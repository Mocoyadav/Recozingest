const RestApiConnector = require('./sources/RestApiConnector');
const MongoDbConnector = require('./destinations/MongoDbConnector');

const createSourceConnector = (source) => {
  if (!source || !source.type) {
    throw new Error('Source configuration and type are required');
  }

  switch (source.type) {
    case 'REST_API':
      return new RestApiConnector(source.config);
    default:
      throw new Error(`Unsupported source connector: ${source.type}`);
  }
};

const createDestinationConnector = (destination) => {
  if (!destination || !destination.type) {
    throw new Error('Destination configuration and type are required');
  }

  switch (destination.type) {
    case 'MONGODB':
      return new MongoDbConnector(destination.config);
    default:
      throw new Error(`Unsupported destination connector: ${destination.type}`);
  }
};

module.exports = {
  createSourceConnector,
  createDestinationConnector
};
