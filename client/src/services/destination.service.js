import api from './api.js';

export const destinationService = {
  /**
   * Retrieve all destinations belonging to the authenticated user
   * @returns {Promise<{ destinations: Array }>}
   */
  async getDestinations() {
    return api.get('/destinations');
  },

  /**
   * Retrieve a single destination by ID
   * @param {string} id - Destination ID
   * @returns {Promise<{ destination: Object }>}
   */
  async getDestinationById(id) {
    return api.get(`/destinations/${id}`);
  },

  /**
   * Create a new destination configuration
   * @param {Object} data - { name, type, config, status }
   * @returns {Promise<{ message: string, destination: Object }>}
   */
  async createDestination(data) {
    return api.post('/destinations', data);
  },

  /**
   * Update an existing destination configuration
   * @param {string} id - Destination ID
   * @param {Object} data - { name, type, config, status }
   * @returns {Promise<{ message: string, destination: Object }>}
   */
  async updateDestination(id, data) {
    return api.put(`/destinations/${id}`, data);
  },

  /**
   * Delete a destination configuration
   * @param {string} id - Destination ID
   * @returns {Promise<{ message: string }>}
   */
  async deleteDestination(id) {
    return api.delete(`/destinations/${id}`);
  }
};

export default destinationService;
