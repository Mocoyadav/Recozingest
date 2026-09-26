class BaseSourceConnector {
  constructor(config) {
    if (new.target === BaseSourceConnector) {
      throw new TypeError('Cannot construct BaseSourceConnector instances directly');
    }
    this.config = config || {};
  }

  async testConnection() {
    throw new Error('testConnection() must be implemented by subclass');
  }

  async extract(options = {}) {
    throw new Error('extract() must be implemented by subclass');
  }
}

module.exports = BaseSourceConnector;
