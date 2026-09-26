const mongoose = require('mongoose');
const BaseDestinationConnector = require('../base/BaseDestinationConnector');

class MongoDbConnector extends BaseDestinationConnector {
  constructor(config) {
    super(config);
    this.uri = config?.uri;
    this.database = config?.database;
    this.collection = config?.collection;
    this.connection = null;
  }

  async _getConnection() {
    if (this.connection && this.connection.readyState === 1) {
      return this.connection;
    }

    if (!this.uri) {
      throw new Error('MongoDB destination requires a valid connection URI');
    }
    if (!this.collection) {
      throw new Error('MongoDB destination requires a collection name');
    }

    const options = {
      serverSelectionTimeoutMS: 5000
    };
    if (this.database) {
      options.dbName = this.database;
    }

    this.connection = await mongoose.createConnection(this.uri, options).asPromise();
    return this.connection;
  }

  async testConnection() {
    try {
      const conn = await this._getConnection();
      await conn.db.admin().ping();

      return {
        success: true,
        message: 'MongoDB destination connection successful'
      };
    } catch (error) {
      throw new Error(`MongoDB destination connection test failed: ${error.message}`);
    }
  }

  async loadBatch(records) {
    if (!records || !Array.isArray(records) || records.length === 0) {
      return { insertedCount: 0 };
    }

    try {
      const conn = await this._getConnection();
      const coll = conn.collection(this.collection);

      // Clone documents and remove pre-existing _id if it's already an external primitive/collision
      // or preserve structure
      const documentsToInsert = records.map((record) => {
        if (record && typeof record === 'object') {
          return { ...record };
        }
        return { data: record };
      });

      const result = await coll.insertMany(documentsToInsert, { ordered: false });

      return {
        insertedCount: result.insertedCount || Object.keys(result.insertedIds || {}).length
      };
    } catch (error) {
      throw new Error(`Failed to load batch into MongoDB destination: ${error.message}`);
    }
  }

  async finalize() {
    if (this.connection) {
      try {
        await this.connection.close();
      } catch (error) {
        // Suppress close error during finalize
      } finally {
        this.connection = null;
      }
    }
  }
}

module.exports = MongoDbConnector;
