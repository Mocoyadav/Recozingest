const BaseSourceConnector = require('../base/BaseSourceConnector');
const { isGreaterThanCursor } = require('../../utils/cursor.util');

class RestApiConnector extends BaseSourceConnector {
  constructor(config) {
    super(config);
    this.url = config?.url;
    this.method = (config?.method || 'GET').toUpperCase();
    this.headers = config?.headers || {};
  }

  async testConnection() {
    if (!this.url) {
      throw new Error('REST API connector requires a valid URL');
    }

    try {
      const response = await fetch(this.url, {
        method: this.method,
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Connection test failed with HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        statusCode: response.status,
        message: 'REST API connection successful'
      };
    } catch (error) {
      throw new Error(`REST API connection test failed: ${error.message}`);
    }
  }

  async extract(options = {}) {
    if (!this.url) {
      throw new Error('REST API connector requires a valid URL');
    }

    const { cursorField, cursorValue, syncMode } = options;

    try {
      let requestUrl = this.url;
      // If source config defines cursorParam (e.g. id_gte or since), append to query string
      if (this.config?.cursorParam && cursorValue !== null && cursorValue !== undefined) {
        try {
          const parsedUrl = new URL(requestUrl);
          parsedUrl.searchParams.set(this.config.cursorParam, cursorValue);
          requestUrl = parsedUrl.toString();
        } catch {
          // If relative or non-standard URL, fallback to direct append
          const separator = requestUrl.includes('?') ? '&' : '?';
          requestUrl = `${requestUrl}${separator}${encodeURIComponent(this.config.cursorParam)}=${encodeURIComponent(cursorValue)}`;
        }
      }

      const response = await fetch(requestUrl, {
        method: this.method,
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Extraction failed with HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      let records = [];

      if (Array.isArray(data)) {
        records = data;
      } else if (data && typeof data === 'object') {
        const arrayProperty = Object.keys(data).find((key) => Array.isArray(data[key]));
        if (arrayProperty) {
          records = data[arrayProperty];
        } else {
          records = [data];
        }
      } else {
        throw new Error('Unexpected response format: expected a JSON array or object');
      }

      // Incremental sync filtering: keep only records with cursorField > cursorValue
      if (syncMode === 'INCREMENTAL' && cursorField && cursorValue !== null && cursorValue !== undefined) {
        records = records.filter((record) => {
          if (!record || typeof record !== 'object') return false;
          return isGreaterThanCursor(record[cursorField], cursorValue);
        });
      }

      return records;
    } catch (error) {
      throw new Error(`Data extraction failed: ${error.message}`);
    }
  }
}

module.exports = RestApiConnector;
