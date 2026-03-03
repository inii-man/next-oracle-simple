/**
 * Centralized API client (src/lib/api.js)
 * Wraps all fetch calls to the FastAPI backend.
 * - Standardized error handling
 * - Content-Type header pre-set
 * - Base URL from environment variable
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      // Use backend error envelope if available
      const message =
        data?.error?.message ||
        data?.detail ||
        `HTTP error ${response.status}`;
      throw new Error(message);
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Documents API object
// ---------------------------------------------------------------------------

export const documentsApi = {
  /** List with optional pagination & category filter */
  list: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/v1/documents${query ? `?${query}` : ''}`);
  },

  /** Get single document by ID */
  get: async (id) => apiFetch(`/v1/documents/${id}`),

  /** Create a new document */
  create: async (docData) =>
    apiFetch('/v1/documents', {
      method: 'POST',
      body: JSON.stringify(docData),
    }),

  /** Update an existing document */
  update: async (id, docData) =>
    apiFetch(`/v1/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(docData),
    }),

  /** Soft-delete a document */
  delete: async (id) =>
    apiFetch(`/v1/documents/${id}`, { method: 'DELETE' }),
};
