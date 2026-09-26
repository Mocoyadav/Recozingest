import api from './api.js';

export const pipelineRunService = {
  /**
   * Retrieve global execution runs across all pipelines with pagination and filtering
   * @param {Object} [params] - { page?: number, limit?: number, pipelineId?: string }
   * @returns {Promise<{ runs: Array, pagination: { page: number, limit: number, total: number, totalPages: number } }>}
   */
  async getRuns(params = {}) {
    return api.get('/pipeline-runs', { params });
  },

  /**
   * Retrieve a single pipeline run by ID with full error diagnostics and execution metadata
   * @param {string} id - PipelineRun ID
   * @returns {Promise<{ run: Object }>}
   */
  async getRunById(id) {
    return api.get(`/pipeline-runs/${id}`);
  }
};

export default pipelineRunService;
