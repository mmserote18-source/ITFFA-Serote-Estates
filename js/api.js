/**
 * EstateHub API client
 */
function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

const API_BASE = (() => {
  const { hostname, port } = window.location;
  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://localhost:3000/api`;
  }
  // Production on Railway
  return 'https://itffa4-propertywebsite-production.up.railway.app/api';
})();

function getAuthHeaders() {
  const user = safeJsonParse(sessionStorage.getItem('user') || localStorage.getItem('user') || 'null', null);
  const headers = { 'Content-Type': 'application/json' };
  if (user?.token) headers.Authorization = `Bearer ${user.token}`;
  return headers;
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  health: () => apiFetch('/health'),
  getProperties: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    const query = qs.toString();
    return apiFetch(`/properties${query ? `?${query}` : ''}`);
  },
  getProperty: (id) => apiFetch(`/properties/${id}`),
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  getFavourites: () => api.get('/favourites'),
  toggleFavourite: (propertyId) => api.post(`/favourites/${propertyId}`),
  sendEnquiry: (data) => api.post('/enquiries', data),
  bookViewing: (data) => api.post('/bookings', data),
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
  getNotifications: () => api.get('/notifications'),
  markNotificationRead: (id) => api.patch(`/notifications/${id}/read`, {}),
  markAllNotificationsRead: () => api.patch('/notifications/read-all', {}),
  getMyBookings: () => api.get('/bookings/my'),
  cancelBooking: (id) => api.patch(`/bookings/${id}/cancel`, {}),
};
