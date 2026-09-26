import api from './api.js';

export const sourceService = {
  /**
   * Retrieve all sources belonging to the authenticated user
   * @returns {Promise<{ sources: Array }>}
   */
  async getSources() {
    return api.get('/sources');
  },

  /**
   * Retrieve a single source by ID
   * @param {string} id - Source ID
   * @returns {Promise<{ source: Object }>}
   */
  async getSourceById(id) {
    return api.get(`/sources/${id}`);
  },

  /**
   * Create a new source connector configuration
   * @param {Object} data - { name, type, config, status }
   * @returns {Promise<{ message: string, source: Object }>}
   */
  async createSource(data) {
    return api.post('/sources', data);
  },

  /**
   * Update an existing source configuration
   * @param {string} id - Source ID
   * @param {Object} data - { name, type, config, status }
   * @returns {Promise<{ message: string, source: Object }>}
   */
  async updateSource(id, data) {
    return api.put(`/sources/${id}`, data);
  },

  /**
   * Delete a source configuration
   * @param {string} id - Source ID
   * @returns {Promise<{ message: string }>}
   */
  async deleteSource(id) {
    return api.delete(`/sources/${id}`);
  }
};

export default sourceService;
