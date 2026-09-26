import api from './api.js';

export const authService = {
  /**
   * Register a new user account
   * @param {Object} credentials - { name, email, password }
   * @returns {Promise<{ message: string, user: { id: string, name: string, email: string } }>}
   */
  async register(credentials) {
    return api.post('/auth/register', credentials);
  },

  /**
   * Login with email and password, persisting JWT on success
   * @param {Object} credentials - { email, password }
   * @returns {Promise<{ message: string, token: string, user: { id: string, name: string, email: string } }>}
   */
  async login(credentials) {
    const data = await api.post('/auth/login', credentials);
    if (data && data.token) {
      api.setToken(data.token);
    }
    return data;
  },

  /**
   * Fetch current authenticated user profile
   * @returns {Promise<{ user: { id: string, name: string, email: string } }>}
   */
  async getMe() {
    return api.get('/auth/me');
  },

  /**
   * Clear JWT from storage and logout
   */
  logout() {
    api.clearToken();
  },

  /**
   * Check if a token currently exists in storage
   * @returns {boolean}
   */
  isAuthenticated() {
    return Boolean(api.getToken());
  },

  /**
   * Get current stored token
   * @returns {string|null}
   */
  getToken() {
    return api.getToken();
  }
};

export default authService;
