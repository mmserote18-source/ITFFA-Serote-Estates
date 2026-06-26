// Serote Estates – API client
// All HTTP calls to the backend go through this module.

// Safe JSON parser that returns a fallback value instead of throwing.
function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// Points at the local dev server when running on localhost, and at the Railway
// deployment URL in production — avoids a build step or environment config file.
const API_BASE = (() => {
  const { hostname, port } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://localhost:3000/api`;
  }
  return 'https://itffa4-propertywebsite-production.up.railway.app/api';
})();

// Reads the stored user from session or local storage and injects the Bearer token
// into every request so auth middleware can identify the caller.
function getAuthHeaders() {
  const user = safeJsonParse(sessionStorage.getItem('user') || localStorage.getItem('user') || 'null', null);
  const headers = { 'Content-Type': 'application/json' };
  if (user?.token) headers.Authorization = `Bearer ${user.token}`;
  return headers;
}

// Base fetch wrapper: merges auth headers, parses JSON, and throws on non-2xx responses.
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Named API methods used throughout main.js.
const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),

  // Public endpoints
  health: () => apiFetch('/health'),
  getPublicStats: () => apiFetch('/stats'),
  getProperties: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    const query = qs.toString();
    return apiFetch(`/properties${query ? `?${query}` : ''}`);
  },
  getProperty: (id) => apiFetch(`/properties/${id}`),

  // Auth
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),

  // Buyer features
  getFavourites: () => api.get('/favourites'),
  toggleFavourite: (propertyId) => api.post(`/favourites/${propertyId}`),
  sendEnquiry: (data) => api.post('/enquiries', data),
  bookViewing: (data) => api.post('/bookings', data),
  getMyBookings: () => api.get('/bookings/my'),
  cancelBooking: (id) => api.patch(`/bookings/${id}/cancel`, {}),

  // Admin / agent panel
  adminStats: () => api.get('/admin/stats'),
  adminEnquiries: () => api.get('/admin/enquiries'),
  adminBookings: () => api.get('/admin/bookings'),
  adminProperties: () => api.get('/admin/properties'),
  adminCreateProperty: (data) => api.post('/admin/properties', data),
  adminUpdateProperty: (id, data) => api.patch(`/admin/properties/${id}`, data),
  adminArchiveProperty: (id) => api.patch(`/admin/properties/${id}/archive`, {}),
  adminUsers: () => api.get('/admin/users'),
  replyToEnquiry: (id, reply) => api.patch(`/admin/enquiries/${id}`, { reply }),
  updateBookingStatus: (id, status) => api.patch(`/admin/bookings/${id}`, { status }),

  // Notifications
  getNotifications: () => api.get('/notifications'),
  markNotificationRead: (id) => api.patch(`/notifications/${id}/read`, {}),
  markAllNotificationsRead: () => api.patch('/notifications/read-all', {}),
};
