/**
 * Centralized API Client for RicozIngest
 * Provides normalized HTTP requests, JWT token management, query param serialization,
 * and 401 unauthorized session-expiry handling.
 */

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.VITE_API_URL) ||
  '/api';
const TOKEN_KEY = 'ricozingest_token';

class ApiClient {
  constructor(baseUrl = null) {
    this.defaultBaseUrl = baseUrl;
    this.customBaseUrl = null;
  }

  getBaseUrl() {
    if (this.customBaseUrl) {
      return this.customBaseUrl;
    }
    const envUrl =
      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ||
      (typeof process !== 'undefined' && process.env && process.env.VITE_API_URL);
    return (envUrl || this.defaultBaseUrl || '/api').replace(/\/+$/, '');
  }

  setBaseUrl(url) {
    this.customBaseUrl = url ? url.replace(/\/+$/, '') : null;
  }

  getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  setToken(token) {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      // Fallback if localStorage is inaccessible
    }
  }

  clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Fallback
    }
  }

  async request(endpoint, options = {}) {
    const { method = 'GET', body, headers = {}, params, ...rest } = options;

    const base = this.getBaseUrl();
    let url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    if (params && typeof params === 'object') {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value);
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    const defaultHeaders = {
      'Content-Type': 'application/json'
    };

    const token = this.getToken();
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      method,
      headers: {
        ...defaultHeaders,
        ...headers
      },
      ...rest
    };

    if (body !== undefined && body !== null) {
      config.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(url, config);
    } catch (networkError) {
      const err = new Error(networkError.message || 'Network request failed. Is the server running?');
      err.status = 0;
      err.isNetworkError = true;
      throw err;
    }

    let data = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      try {
        data = await response.text();
      } catch {
        data = null;
      }
    }

    // Handle 401 Unauthorized / Token Expiry
    if (response.status === 401) {
      this.clearToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ricozingest:auth:unauthorized'));
      }
    }

    if (!response.ok) {
      const message =
        (data && typeof data === 'object' && (data.message || data.error)) ||
        (typeof data === 'string' && data) ||
        `Request failed with status ${response.status}`;

      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
export { TOKEN_KEY };
export default api;
