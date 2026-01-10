/**
 * Test helper utilities for API endpoint tests
 */

/**
 * Creates a mock Express request object
 * @param {object} overrides - Properties to override
 * @returns {object} Mock request object
 */
export const createMockRequest = (overrides = {}) => {
  return {
    query: {},
    body: {},
    params: {},
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
    path: '',
    ...overrides,
  };
};

/**
 * Creates a mock Express response object with spies
 * @returns {object} Mock response object
 */
export const createMockResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
  };

  res.status = function(code) {
    this.statusCode = code;
    return this;
  };

  res.send = function(data) {
    this.body = data;
    return this;
  };

  res.json = function(data) {
    this.body = data;
    return this;
  };

  res.end = function(data) {
    if (data !== undefined) {
      this.body = data;
    }
    return this;
  };

  res.set = function(field, value) {
    if (typeof field === 'string') {
      this.headers[field] = value;
    } else {
      Object.assign(this.headers, field);
    }
    return this;
  };

  return res;
};

/**
 * Creates a mock ConfigStore instance
 * @param {object} initialData - Initial data to store
 * @returns {object} Mock configstore with get, set, has, unset, delete methods
 */
export const createMockConfigStore = (initialData = {}) => {
  const data = { ...initialData };

  const mockStore = {
    get: (key, defaultValue) => {
      if (key === undefined) {
        return data;
      }
      // Simple dot-notation support
      const keys = key.split('.');
      let value = data;
      for (const k of keys) {
        if (value != null && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return defaultValue;
        }
      }
      // Return value even if it's null (null is a valid stored value)
      return value !== undefined ? value : defaultValue;
    },
    set: (key, value, options = {}) => {
      if (key === undefined) {
        return;
      }
      // Simple dot-notation support
      const keys = key.split('.');
      let obj = data;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        // Handle null/undefined - need to create new object to navigate further
        if (!(k in obj) || obj[k] == null || (typeof obj[k] !== 'object') || Array.isArray(obj[k])) {
          obj[k] = {};
        }
        obj = obj[k];
      }
      obj[keys[keys.length - 1]] = value;
    },
    has: (key) => {
      if (key === undefined) {
        return false;
      }
      const keys = key.split('.');
      let value = data;
      for (const k of keys) {
        if (value != null && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return false;
        }
      }
      // Key exists even if value is null (null is a valid stored value)
      return value !== undefined;
    },
    unset: (key) => {
      if (key === undefined) {
        return;
      }
      const keys = key.split('.');
      let obj = data;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!(k in obj) || typeof obj[k] !== 'object') {
          return;
        }
        obj = obj[k];
      }
      delete obj[keys[keys.length - 1]];
    },
    delete: (key) => {
      return mockStore.unset(key);
    },
    // Expose data for inspection
    _data: data,
    // Reset to initial state
    _reset: () => {
      Object.keys(data).forEach(key => delete data[key]);
      Object.assign(data, initialData);
    },
  };

  return mockStore;
};
