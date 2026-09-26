class BaseDestinationConnector {
  constructor(config) {
    if (new.target === BaseDestinationConnector) {
      throw new TypeError('Cannot construct BaseDestinationConnector instances directly');
    }
    this.config = config || {};
  }

  async testConnection() {
    throw new Error('testConnection() must be implemented by subclass');
  }

  async loadBatch(records) {
    throw new Error('loadBatch(records) must be implemented by subclass');
  }

  async finalize() {
    throw new Error('finalize() must be implemented by subclass');
  }
}

module.exports = BaseDestinationConnector;
