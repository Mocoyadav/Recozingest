import api from './api.js';

export const pipelineService = {
  /**
   * Retrieve all pipelines belonging to the authenticated user
   * @returns {Promise<{ pipelines: Array }>}
   */
  async getPipelines() {
    return api.get('/pipelines');
  },

  /**
   * Retrieve a single pipeline with populated source and destination info
   * @param {string} id - Pipeline ID
   * @returns {Promise<{ pipeline: Object }>}
   */
  async getPipelineById(id) {
    return api.get(`/pipelines/${id}`);
  },

  /**
   * Create a new pipeline
   * @param {Object} data - { name, sourceId, destinationId, status, syncMode, cursorField, transformations }
   * @returns {Promise<{ message: string, pipeline: Object }>}
   */
  async createPipeline(data) {
    return api.post('/pipelines', data);
  },

  /**
   * Update an existing pipeline
   * @param {string} id - Pipeline ID
   * @param {Object} data - { name, sourceId, destinationId, status, syncMode, cursorField, resetCursor, transformations }
   * @returns {Promise<{ message: string, pipeline: Object }>}
   */
  async updatePipeline(id, data) {
    return api.put(`/pipelines/${id}`, data);
  },

  /**
   * Delete a pipeline
   * @param {string} id - Pipeline ID
   * @returns {Promise<{ message: string }>}
   */
  async deletePipeline(id) {
    return api.delete(`/pipelines/${id}`);
  },

  /**
   * Trigger manual execution of a pipeline
   * @param {string} id - Pipeline ID
   * @returns {Promise<{ message: string, run: Object }>}
   */
  async executePipeline(id) {
    return api.post(`/pipelines/${id}/run`);
  },

  /**
   * Retrieve execution history scoped to a specific pipeline
   * @param {string} id - Pipeline ID
   * @param {Object} [params] - { page, limit }
   * @returns {Promise<{ runs: Array, pagination: Object }>}
   */
  async getPipelineRuns(id, params = {}) {
    return api.get(`/pipelines/${id}/runs`, { params });
  },

  /**
   * Retrieve schedule configuration for a pipeline
   * @param {string} id - Pipeline ID
   * @returns {Promise<{ pipelineId: string, schedule: Object }>}
   */
  async getSchedule(id) {
    return api.get(`/pipelines/${id}/schedule`);
  },

  /**
   * Update schedule configuration for a pipeline
   * @param {string} id - Pipeline ID
   * @param {Object} data - { type: 'INTERVAL'|'CRON', expression: string, enabled?: boolean }
   * @returns {Promise<{ message: string, schedule: Object }>}
   */
  async updateSchedule(id, data) {
    return api.put(`/pipelines/${id}/schedule`, data);
  },

  /**
   * Enable pipeline schedule
   * @param {string} id - Pipeline ID
   * @returns {Promise<{ message: string, schedule: Object }>}
   */
  async enableSchedule(id) {
    return api.patch(`/pipelines/${id}/schedule/enable`);
  },

  /**
   * Disable pipeline schedule
   * @param {string} id - Pipeline ID
   * @returns {Promise<{ message: string, schedule: Object }>}
   */
  async disableSchedule(id) {
    return api.patch(`/pipelines/${id}/schedule/disable`);
  },

  /**
   * Retrieve transformation and field mapping configuration for a pipeline
   * @param {string} id - Pipeline ID
   * @returns {Promise<{ pipelineId: string, transformations: Object }>}
   */
  async getTransformations(id) {
    return api.get(`/pipelines/${id}/transform`);
  },

  /**
   * Update transformation and field mapping configuration for a pipeline
   * @param {string} id - Pipeline ID
   * @param {Object} data - { enabled, includeUnmapped, addMetadata, fieldMappings }
   * @returns {Promise<{ message: string, transformations: Object }>}
   */
  async updateTransformations(id, data) {
    return api.put(`/pipelines/${id}/transform`, data);
  },

  /**
   * Preview transformations against sample data or auto-fetched source data
   * NOTE: Pure in-memory execution. Zero writes to the destination database.
   * @param {string} id - Pipeline ID
   * @param {Object} [data] - { sampleRecords?: Array, transformations?: Object, fieldMappings?: Array }
   * @returns {Promise<{ message: string, preview: { originalCount: number, transformedCount: number, sampleOriginal: Array, sampleTransformed: Array } }>}
   */
  async previewTransformations(id, data = {}) {
    return api.post(`/pipelines/${id}/transform/preview`, data);
  }
};

export default pipelineService;
