/**
 * EstateHub – Main JavaScript
 * Author: Milestone 2 – ITFFA4
 * Frontend connected to Node.js / MySQL API
 */

// =============================================================
// 1. DATA & STATE
// =============================================================
let PROPERTIES = [];

const FILTER_FIELD_MAP = {
  'f-city': 'city',
  'f-type': 'type',
  'f-status': 'status',
  'f-beds': 'beds',
  'f-min-price': 'minPrice',
  'f-max-price': 'maxPrice',
};

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

const state = {
  favourites: safeJsonParse(localStorage.getItem('favourites') || '[]', []),
  currentFilters: { city: '', type: '', status: '', minPrice: '', maxPrice: '', beds: '', search: '' },
  currentUser: null,
  apiOnline: false,
};

function saveState() {
  localStorage.setItem('favourites', JSON.stringify(state.favourites));
}

function getStoredUser() {
  return safeJsonParse(sessionStorage.getItem('user') || localStorage.getItem('user') || 'null', null);
}

function storeUser(user, remember = false) {
  sessionStorage.removeItem('user');
  localStorage.removeItem('user');
  if (remember) localStorage.setItem('user', JSON.stringify(user));
  else sessionStorage.setItem('user', JSON.stringify(user));
  state.currentUser = user;
}

function clearStoredUser() {
  sessionStorage.removeItem('user');
  localStorage.removeItem('user');
  state.currentUser = null;
}

function logoutUser() {
  clearStoredUser();
  location.reload();
}

async function loadAllProperties() {
  PROPERTIES = await api.getProperties();
}

async function syncFavouritesFromApi() {
  if (!state.currentUser?.token) return;
  const favs = await api.getFavourites();
  state.favourites = favs.map(p => p.id);
  saveState();
}

// =============================================================
// 2. UTILITY FUNCTIONS
// =============================================================
function formatPrice(price, status) {
  if (status === 'for-rent') return `R ${price.toLocaleString()}<span class="period">/month</span>`;
  return `R ${(price / 1e6).toFixed(2)}m`;
}

function formatPricePlain(price, status) {
  return status === 'for-rent' ? `R ${price.toLocaleString()}/mo` : `R ${(price / 1e6).toFixed(2)}m`;
}

function isFav(id) { return state.favourites.includes(Number(id)); }

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.35s ease forwards';
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}

function enquiryStatusBadge(status) {
  const map = {
    new: ['badge-info', 'New'],
    'in-progress': ['badge-warning', 'In Progress'],
    responded: ['badge-success', 'Responded'],
    closed: ['badge', 'Closed'],
  };
  const [cls, label] = map[status] || ['badge', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function listingStatusBadge(status) {
  const map = {
    'for-sale': ['badge-success', 'For Sale'],
    'for-rent': ['badge-info', 'For Rent'],
    sold: ['badge-warning', 'Sold'],
    archived: ['badge', 'Archived'],
  };
  const [cls, label] = map[status] || ['badge', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function userRoleBadge(role) {
  const map = {
    admin: ['badge-danger', 'Admin'],
    agent: ['badge-info', 'Agent'],
    buyer: ['badge', 'Buyer'],
  };
  const [cls, label] = map[role] || ['badge', role];
  return `<span class="badge ${cls}">${label}</span>`;
}

// =============================================================
// 3. PROPERTY CARD BUILDER
// =============================================================
function buildPropertyCard(prop) {
  const fav = isFav(prop.id);
  return `
    <article class="property-card" data-id="${prop.id}" onclick="window.location.href='property-detail.html?id=${prop.id}'" style="cursor:pointer">
      <div class="card-image-wrap">
        <img src="${prop.image}" alt="${prop.title}" loading="lazy" />
        <span class="card-badge ${prop.status === 'for-rent' ? 'for-rent' : ''}">${prop.status === 'for-rent' ? 'For Rent' : 'For Sale'}</span>
        <button class="fav-btn ${fav ? 'active' : ''}" aria-label="Save to favourites" data-id="${prop.id}" onclick="event.stopPropagation()">
          ${fav ? '❤️' : '🤍'}
        </button>
      </div>
      <div class="card-body">
        <div class="card-price">${formatPrice(prop.price, prop.status)}</div>
        <h3 class="card-title">${prop.title}</h3>
        <p class="card-location">📍 ${prop.location}</p>
        <ul class="card-features">
          <li class="feature-tag">🛏 ${prop.beds} Bed${prop.beds > 1 ? 's' : ''}</li>
          <li class="feature-tag">🚿 ${prop.baths} Bath${prop.baths > 1 ? 's' : ''}</li>
          <li class="feature-tag">🚗 ${prop.parking} Park</li>
          <li class="feature-tag">📐 ${prop.sqm}m²</li>
        </ul>
        <div class="card-footer">
          <div class="agent-info">
            <img class="agent-avatar" src="${prop.agentAvatar}" alt="${prop.agent}" />
            <span class="agent-name">${prop.agent}</span>
          </div>
        </div>
      </div>
    </article>`;
}

// =============================================================
// 4. FAVOURITES TOGGLE
// =============================================================
async function toggleFavourite(id) {
  const numId = Number(id);

  if (state.currentUser?.token && state.apiOnline) {
    try {
      const result = await api.toggleFavourite(numId);
      if (result.saved) {
        if (!state.favourites.includes(numId)) state.favourites.push(numId);
      } else {
        state.favourites = state.favourites.filter(f => f !== numId);
      }
      saveState();
      updateFavButtons(id);
      showToast(result.message, result.saved ? 'success' : 'info');
      return;
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  }

  if (isFav(numId)) {
    state.favourites = state.favourites.filter(f => f !== numId);
    showToast('Removed from favourites', 'info');
  } else {
    state.favourites.push(numId);
    showToast('Saved to favourites ❤️', 'success');
  }
  saveState();
  updateFavButtons(id);
}

function updateFavButtons(id) {
  const numId = Number(id);
  document.querySelectorAll(`.fav-btn[data-id="${id}"]`).forEach(btn => {
    const saved = isFav(numId);
    btn.classList.toggle('active', saved);
    if (btn.textContent.trim().includes('Saved') || btn.textContent.trim().includes('Save to Favourites')) {
      btn.textContent = saved ? '❤️ Saved' : '🤍 Save to Favourites';
    } else {
      btn.textContent = saved ? '❤️' : '🤍';
    }
  });
}

// =============================================================
// 5. HOME PAGE
// =============================================================
function initHomePage() {
  const featuredContainer = document.getElementById('featured-properties');
  if (!featuredContainer) return;

  const featured = PROPERTIES.filter(p => p.featured);
  featuredContainer.innerHTML = featured.length
    ? featured.map(buildPropertyCard).join('')
    : `<div class="empty-state" style="grid-column:1/-1"><p>No featured properties yet.</p></div>`;
  attachFavListeners(featuredContainer);

  const heroSearch = document.getElementById('hero-search-form');
  if (heroSearch) {
    heroSearch.addEventListener('submit', e => {
      e.preventDefault();
      const params = new URLSearchParams();
      const city = document.getElementById('hs-city').value;
      const type = document.getElementById('hs-type').value;
      const status = document.getElementById('hs-status').value;
      const maxPrice = document.getElementById('hs-budget').value;
      if (city) params.set('city', city);
      if (type) params.set('type', type);
      if (status) params.set('status', status);
      if (maxPrice) params.set('maxPrice', maxPrice);
      window.location.href = `listings.html?${params.toString()}`;
    });
  }

  const statEls = {
    active: document.getElementById('stat-active'),
    sold:   document.getElementById('stat-sold'),
    agents: document.getElementById('stat-agents'),
  };
  if (statEls.active) {
    api.getPublicStats().then(data => {
      function animateStat(el, target) {
        let current = 0;
        const step = Math.ceil(target / 50) || 1;
        const timer = setInterval(() => {
          current = Math.min(current + step, target);
          el.textContent = current.toLocaleString();
          if (current >= target) clearInterval(timer);
        }, 30);
      }
      animateStat(statEls.active, data.active);
      animateStat(statEls.sold,   data.sold);
      animateStat(statEls.agents, data.agents);
    }).catch(() => {
      statEls.active.textContent = '–';
      statEls.sold.textContent   = '–';
      statEls.agents.textContent = '–';
    });
  }
}

// =============================================================
// 6. LISTINGS PAGE
// =============================================================
function initListingsPage() {
  const grid = document.getElementById('listings-grid');
  if (!grid) return;

  const params = new URLSearchParams(window.location.search);
  const urlFilterMap = { city: 'f-city', type: 'f-type', status: 'f-status', maxPrice: 'f-max-price', minPrice: 'f-min-price' };
  Object.entries(urlFilterMap).forEach(([key, fieldId]) => {
    const value = params.get(key);
    if (!value) return;
    state.currentFilters[key] = value;
    const el = document.getElementById(fieldId);
    if (el) el.value = value;
  });

  renderListings();

  Object.entries(FILTER_FIELD_MAP).forEach(([fieldId, filterKey]) => {
    const el = document.getElementById(fieldId);
    if (!el) return;
    const handler = () => {
      state.currentFilters[filterKey] = el.value;
      renderListings();
    };
    if (el.tagName === 'INPUT') el.addEventListener('input', debounce(handler, 300));
    else el.addEventListener('change', handler);
  });

  const searchInput = document.getElementById('f-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      state.currentFilters.search = searchInput.value.toLowerCase();
      renderListings();
    }, 300));
  }

  const sortEl = document.getElementById('f-sort');
  if (sortEl) sortEl.addEventListener('change', () => renderListings());
}

function renderListings() {
  const grid = document.getElementById('listings-grid');
  const countEl = document.getElementById('results-count');
  const f = state.currentFilters;

  let results = PROPERTIES.filter(p => {
    if (f.city && p.city !== f.city) return false;
    if (f.type && p.type !== f.type) return false;
    if (f.status && p.status !== f.status) return false;
    if (f.beds && p.beds < parseInt(f.beds, 10)) return false;
    if (f.minPrice && p.price < parseInt(f.minPrice, 10)) return false;
    if (f.maxPrice && p.price > parseInt(f.maxPrice, 10)) return false;
    if (f.search && !p.title.toLowerCase().includes(f.search) && !p.location.toLowerCase().includes(f.search)) return false;
    return true;
  });

  const sort = document.getElementById('f-sort')?.value || 'default';
  if (sort === 'price-asc') results.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') results.sort((a, b) => b.price - a.price);
  else if (sort === 'newest') results.sort((a, b) => b.id - a.id);

  grid.innerHTML = results.length
    ? results.map(buildPropertyCard).join('')
    : `<div class="empty-state" style="grid-column:1/-1"><div class="icon">🏘️</div><h2>No properties found</h2><p>Try adjusting your filters.</p></div>`;

  if (countEl) countEl.textContent = `${results.length} propert${results.length === 1 ? 'y' : 'ies'} found`;
  attachFavListeners(grid);
}

// =============================================================
// 7. PROPERTY DETAIL PAGE
// =============================================================
function renderPropertyNotFound(container) {
  document.title = 'Property Not Found – EstateHub';
  if (document.getElementById('detail-title')) document.getElementById('detail-title').textContent = 'Property Not Found';
  container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
    <div class="icon">🏘️</div>
    <h2>Property not found</h2>
    <p>This listing may have been removed or the link is incorrect.</p>
    <a href="listings.html" class="btn btn-primary mt-2">Browse Listings</a>
  </div>`;
}

function renderPropertyDetail(prop, container) {
  if (document.getElementById('detail-title')) document.getElementById('detail-title').textContent = prop.title;
  document.title = `${prop.title} – EstateHub`;

  const galleryImages = (prop.images?.length ? prop.images : [prop.image]).slice(0, 3);
  while (galleryImages.length < 3) galleryImages.push(prop.image);

  const description = prop.description || `This exceptional ${prop.type} located in ${prop.location} offers modern living at its finest.`;

  container.innerHTML = `
    <div class="detail-gallery">
      <div class="main-img"><img src="${galleryImages[0]}" alt="${prop.title}" /></div>
      <div><img src="${galleryImages[1]}" alt="Interior view" /></div>
      <div><img src="${galleryImages[2]}" alt="Additional view" /></div>
    </div>
    <div class="detail-layout">
      <div class="detail-info">
        <h1>${prop.title}</h1>
        <p class="detail-location">📍 ${prop.location}</p>
        <ul class="detail-features">
          <li class="detail-feature"><span class="icon">🛏</span><strong>${prop.beds}</strong><span>Bedrooms</span></li>
          <li class="detail-feature"><span class="icon">🚿</span><strong>${prop.baths}</strong><span>Bathrooms</span></li>
          <li class="detail-feature"><span class="icon">🚗</span><strong>${prop.parking}</strong><span>Parking</span></li>
          <li class="detail-feature"><span class="icon">📐</span><strong>${prop.sqm}m²</strong><span>Floor Size</span></li>
          <li class="detail-feature"><span class="icon">🏷️</span><strong>${prop.type.charAt(0).toUpperCase() + prop.type.slice(1)}</strong><span>Type</span></li>
        </ul>
        <h2 style="margin-bottom:0.75rem">About This Property</h2>
        <p>${description}</p>
        <h3 style="margin:1.5rem 0 0.75rem">Key Features</h3>
        <ul style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem 1rem;font-size:0.88rem;color:var(--text-muted)">
          <li>✅ Modern kitchen with granite tops</li><li>✅ Prepaid electricity</li>
          <li>✅ Double garage / covered parking</li><li>✅ 24-hour security / access control</li>
          <li>✅ Large garden / balcony</li><li>✅ Close to schools & highways</li>
          <li>✅ Fibre internet ready</li><li>✅ Borehole water backup</li>
        </ul>
      </div>
      <aside class="detail-sidebar">
        <div class="sidebar-card">
          <div class="sidebar-price">${formatPricePlain(prop.price, prop.status)}</div>
          <span class="badge ${prop.status === 'for-rent' ? 'badge-info' : 'badge-success'}" style="margin-bottom:1rem">${prop.status === 'for-rent' ? 'For Rent' : 'For Sale'}</span>
          <div class="agent-info" style="gap:0.75rem;margin:1rem 0">
            <img class="agent-avatar" style="width:48px;height:48px;border-radius:50%;object-fit:cover" src="${prop.agentAvatar}" alt="${prop.agent}" />
            <div><strong style="display:block">${prop.agent}</strong><small style="color:var(--text-muted)">${prop.agentTitle}</small></div>
          </div>
          <button class="btn btn-primary btn-block mt-2" onclick="openModal('enquiry-modal')">📩 Send Enquiry</button>
          <button class="btn btn-outline btn-block mt-1" onclick="openModal('viewing-modal')">📅 Book Viewing</button>
          <button class="btn btn-sm btn-block mt-1 fav-btn ${isFav(prop.id) ? 'active' : ''}" style="border:2px solid var(--border);border-radius:var(--radius)" data-id="${prop.id}" onclick="toggleFavourite(${prop.id})">${isFav(prop.id) ? '❤️ Saved' : '🤍 Save to Favourites'}</button>
        </div>
      </aside>
    </div>`;
}

async function initDetailPage() {
  const container = document.getElementById('detail-container');
  if (!container) return;

  const id = parseInt(new URLSearchParams(window.location.search).get('id'), 10);
  if (!id) {
    renderPropertyNotFound(container);
    return;
  }

  let prop = null;
  if (state.apiOnline) {
    try {
      prop = await api.getProperty(id);
    } catch {
      prop = PROPERTIES.find(p => p.id === id) || null;
    }
  } else {
    prop = PROPERTIES.find(p => p.id === id) || null;
  }

  if (!prop) {
    renderPropertyNotFound(container);
    return;
  }

  renderPropertyDetail(prop, container);
}

function getDetailPropertyId() {
  return parseInt(new URLSearchParams(window.location.search).get('id'), 10) || null;
}

// =============================================================
// 8. ENQUIRY FORM
// =============================================================
function initEnquiryForm() {
  const form = document.getElementById('enquiry-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    let valid = true;

    const fields = [
      { id: 'enq-name',    label: 'Full name',   min: 3 },
      { id: 'enq-email',   label: 'Email',       type: 'email' },
      { id: 'enq-phone',   label: 'Phone',       pattern: /^(\+27|0)[6-8][0-9]{8}$/ },
      { id: 'enq-message', label: 'Message',     min: 10 },
    ];

    fields.forEach(f => {
      const el = document.getElementById(f.id);
      const msg = document.getElementById(`${f.id}-msg`);
      const val = el.value.trim();
      clearFieldError(el, msg);
      if (!val) { setFieldError(el, msg, `${f.label} is required`); valid = false; return; }
      if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setFieldError(el, msg, 'Enter a valid email address'); valid = false; return; }
      if (f.pattern && !f.pattern.test(val.replace(/\s/g, ''))) { setFieldError(el, msg, 'Enter a valid SA phone number (e.g. 0812345678)'); valid = false; return; }
      if (f.min && val.length < f.min) { setFieldError(el, msg, `${f.label} must be at least ${f.min} characters`); valid = false; return; }
      setFieldValid(el);
    });

    if (!valid) return;

    const propertyId = getDetailPropertyId();
    if (state.apiOnline && propertyId) {
      try {
        await api.sendEnquiry({
          propertyId,
          name: document.getElementById('enq-name').value.trim(),
          email: document.getElementById('enq-email').value.trim(),
          phone: document.getElementById('enq-phone').value.trim(),
          message: document.getElementById('enq-message').value.trim(),
        });
      } catch (err) {
        showToast(err.message, 'error');
        return;
      }
    }

    closeModal('enquiry-modal');
    showToast('Enquiry sent! The agent will contact you shortly.', 'success');
    form.reset();
    form.querySelectorAll('.form-control').forEach(el => el.classList.remove('valid', 'error'));
  });

  form.querySelectorAll('.form-control').forEach(el => {
    el.addEventListener('blur', () => validateFieldOnBlur(el));
  });
}

function validateFieldOnBlur(el) {
  const msg = document.getElementById(`${el.id}-msg`);
  const val = el.value.trim();
  clearFieldError(el, msg);
  if (!val) { setFieldError(el, msg, 'This field is required'); return; }
  if (el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setFieldError(el, msg, 'Invalid email address'); return; }
  setFieldValid(el);
}

function setFieldError(el, msgEl, message) {
  el.classList.add('error'); el.classList.remove('valid');
  if (msgEl) { msgEl.textContent = message; msgEl.className = 'form-message error'; }
}
function clearFieldError(el, msgEl) {
  el.classList.remove('error', 'valid');
  if (msgEl) { msgEl.textContent = ''; msgEl.className = 'form-message'; }
}
function setFieldValid(el) {
  el.classList.remove('error'); el.classList.add('valid');
}

// =============================================================
// 9. VIEWING BOOKING FORM
// =============================================================
function initViewingForm() {
  const form = document.getElementById('viewing-form');
  if (!form) return;

  const dateInput = document.getElementById('view-date');
  if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const date = dateInput?.value;
    const time = document.getElementById('view-time')?.value;
    if (!date || !time) { showToast('Please select a date and time', 'error'); return; }

    const propertyId = getDetailPropertyId();
    const user = getStoredUser();

    if (state.apiOnline && propertyId) {
      try {
        await api.bookViewing({
          propertyId,
          name: user?.name || 'Guest',
          email: user?.email || 'guest@estatehub.co.za',
          date,
          time,
          notes: document.getElementById('view-notes')?.value.trim() || null,
        });
      } catch (err) {
        showToast(err.message, 'error');
        return;
      }
    }

    closeModal('viewing-modal');
    showToast(`Viewing booked for ${new Date(date).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })} at ${time}`, 'success');
    form.reset();
  });
}

// =============================================================
// 10. AUTH PAGES
// =============================================================
function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const emailMsg = document.getElementById('login-email-msg');
    const pwMsg = document.getElementById('login-pw-msg');

    clearFieldError(document.getElementById('login-email'), emailMsg);
    clearFieldError(document.getElementById('login-password'), pwMsg);

    let valid = true;
    if (!email) { setFieldError(document.getElementById('login-email'), emailMsg, 'Email is required'); valid = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError(document.getElementById('login-email'), emailMsg, 'Invalid email address'); valid = false; }
    if (!password) { setFieldError(document.getElementById('login-password'), pwMsg, 'Password is required'); valid = false; }
    else if (password.length < 6) { setFieldError(document.getElementById('login-password'), pwMsg, 'Password must be at least 6 characters'); valid = false; }
    if (!valid) return;

    const remember = document.getElementById('login-remember')?.checked;

    if (state.apiOnline) {
      try {
        const { user } = await api.login(email, password);
        storeUser(user, remember);
        await syncFavouritesFromApi();
        showToast(`Welcome back, ${user.name}!`, 'success');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1200);
        return;
      } catch (err) {
        showToast(err.message, 'error');
        return;
      }
    }

    showToast('Server unavailable. Start the backend first.', 'error');
  });
}

function initRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  const password = document.getElementById('reg-password');
  const confirm = document.getElementById('reg-confirm');
  const strength = document.getElementById('pw-strength');

  if (password) {
    password.addEventListener('input', () => {
      const s = getPasswordStrength(password.value);
      if (strength) { strength.textContent = s.label; strength.style.color = s.color; }
    });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    let valid = true;

    const fields = [
      { id: 'reg-name', label: 'Full name', min: 3 },
      { id: 'reg-email', label: 'Email', type: 'email' },
      { id: 'reg-phone', label: 'Phone', pattern: /^(\+27|0)[6-8][0-9]{8}$/ },
      { id: 'reg-password', label: 'Password', min: 8 },
      { id: 'reg-confirm', label: 'Confirm password' },
    ];

    fields.forEach(f => {
      const el = document.getElementById(f.id);
      const msg = document.getElementById(`${f.id}-msg`);
      const val = el.value.trim();
      clearFieldError(el, msg);
      if (!val) { setFieldError(el, msg, `${f.label} is required`); valid = false; return; }
      if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setFieldError(el, msg, 'Enter a valid email'); valid = false; return; }
      if (f.pattern && !f.pattern.test(val.replace(/\s/g, ''))) { setFieldError(el, msg, 'Enter a valid SA phone number'); valid = false; return; }
      if (f.min && val.length < f.min) { setFieldError(el, msg, `${f.label} must be at least ${f.min} characters`); valid = false; return; }
      setFieldValid(el);
    });

    if (valid && password && confirm && password.value !== confirm.value) {
      setFieldError(confirm, document.getElementById('reg-confirm-msg'), 'Passwords do not match');
      valid = false;
    }

    if (!document.getElementById('reg-terms').checked) {
      document.getElementById('reg-terms-msg').textContent = 'You must accept the terms and conditions';
      valid = false;
    } else {
      document.getElementById('reg-terms-msg').textContent = '';
    }

    if (!valid) return;

    const role = document.getElementById('reg-role')?.value || 'user';

    if (state.apiOnline) {
      try {
        await api.register({
          name: document.getElementById('reg-name').value.trim(),
          email: document.getElementById('reg-email').value.trim(),
          phone: document.getElementById('reg-phone').value.trim(),
          password: password.value,
          role,
        });
        showToast(`Account created as ${role === 'agent' ? 'Agent' : 'Buyer'}! Please log in.`, 'success');
        setTimeout(() => { window.location.href = 'login.html'; }, 1800);
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }

    showToast('Server unavailable. Start the backend first.', 'error');
  });
}

function getPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: '', color: '' },
    { label: '🔴 Weak', color: 'var(--danger)' },
    { label: '🟠 Fair', color: 'orange' },
    { label: '🟡 Good', color: '#b8860b' },
    { label: '🟢 Strong', color: 'var(--success)' },
  ];
  return levels[score] || levels[0];
}

// =============================================================
// 11. FAVOURITES PAGE
// =============================================================
async function initFavouritesPage() {
  const grid = document.getElementById('favourites-grid');
  if (!grid) return;

  let favProps = [];
  if (state.currentUser?.token && state.apiOnline) {
    try {
      favProps = await api.getFavourites();
      state.favourites = favProps.map(p => p.id);
      saveState();
    } catch {
      favProps = PROPERTIES.filter(p => isFav(p.id));
    }
  } else {
    favProps = PROPERTIES.filter(p => isFav(p.id));
  }

  if (favProps.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="icon">💔</div>
      <h2>No saved properties yet</h2>
      <p>Browse listings and tap the heart icon to save properties you love.</p>
      <a href="listings.html" class="btn btn-primary mt-2">Browse Listings</a>
    </div>`;
  } else {
    grid.innerHTML = favProps.map(buildPropertyCard).join('');
    attachFavListeners(grid);
  }
}

// =============================================================
// 12. ADMIN PANEL
// =============================================================
function initAdminPanel() {
  const adminMain = document.querySelector('.admin-main');
  if (!adminMain) return;

  const user = getStoredUser();
  if (!user || user.role !== 'admin') {
    showToast('Admin access required. Please log in.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    return;
  }

  renderAdminDashboard();

  document.querySelectorAll('.admin-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      renderAdminSection(link.dataset.section);
    });
  });
}

async function renderAdminDashboard() {
  const content = document.getElementById('admin-content');
  if (!content) return;

  if (state.apiOnline) {
    try {
      const [stats, enquiries, properties] = await Promise.all([
        api.adminStats(),
        api.adminEnquiries(),
        api.adminProperties(),
      ]);

      content.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card blue"><div class="label">Total Listings</div><div class="value">${stats.listings}</div></div>
          <div class="stat-card gold"><div class="label">Enquiries</div><div class="value">${stats.enquiries}</div></div>
          <div class="stat-card green"><div class="label">Bookings</div><div class="value">${stats.bookings}</div><div class="change">${stats.pendingBookings} pending</div></div>
          <div class="stat-card red"><div class="label">Active Users</div><div class="value">${stats.users}</div></div>
        </div>
        <h2 style="margin-bottom:1rem">Recent Enquiries</h2>
        <div style="overflow-x:auto">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Property</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>${enquiries.slice(0, 10).map(e => `
            <tr>
              <td>${e.sender_name}</td>
              <td>${e.property_title}</td>
              <td>${e.submitted_date}</td>
              <td>${enquiryStatusBadge(e.status)}</td>
            </tr>`).join('') || '<tr><td colspan="4">No enquiries yet</td></tr>'}
          </tbody>
        </table>
        </div>
        <h2 style="margin:2rem 0 1rem">Property Listings</h2>
        <div style="overflow-x:auto">
        <table class="data-table">
          <thead><tr><th>Title</th><th>Type</th><th>Price</th><th>City</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${properties.map(p => `
            <tr>
              <td>${p.title}</td>
              <td>${p.type}</td>
              <td>${formatPricePlain(p.price, p.status)}</td>
              <td>${p.city}</td>
              <td>${listingStatusBadge(p.status)}</td>
              <td style="display:flex;gap:0.4rem">
                <button class="btn btn-sm btn-danger" onclick="archiveListing(${p.id})">🗑️ Archive</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
        </div>`;
      return;
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  content.innerHTML = `<p style="color:var(--text-muted)">Connect to the database to load admin data.</p>`;
}

async function archiveListing(id) {
  if (!state.apiOnline) return;
  try {
    await api.adminArchiveProperty(id);
    showToast('Listing archived', 'warning');
    await loadAllProperties();
    renderAdminDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function renderAdminSection(section) {
  const content = document.getElementById('admin-content');
  if (!content) return;
  const titles = { dashboard: 'Dashboard', listings: 'Manage Listings', enquiries: 'Enquiries', bookings: 'Viewing Bookings', users: 'User Management', 'add-listing': 'Add New Listing' };
  document.getElementById('admin-page-title').textContent = titles[section] || section;

  if (section === 'dashboard') { await renderAdminDashboard(); return; }
  if (section === 'add-listing') { renderAddListingForm(content); return; }

  if (!state.apiOnline) {
    content.innerHTML = `<p style="color:var(--text-muted)">Server unavailable.</p>`;
    return;
  }

  try {
    if (section === 'enquiries') {
      const rows = await api.adminEnquiries();
      content.innerHTML = `<div style="overflow-x:auto"><table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Property</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>${rows.map(e => `<tr><td>${e.sender_name}</td><td>${e.sender_email}</td><td>${e.property_title}</td><td>${e.submitted_date}</td><td>${enquiryStatusBadge(e.status)}</td></tr>`).join('')}</tbody>
      </table></div>`;
    } else if (section === 'bookings') {
      const rows = await api.adminBookings();
      content.innerHTML = `<div style="overflow-x:auto"><table class="data-table">
        <thead><tr><th>Name</th><th>Property</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
        <tbody>${rows.map(b => `<tr><td>${b.contact_name}</td><td>${b.property_title}</td><td>${b.booking_date}</td><td>${b.time_slot}</td><td><span class="badge badge-info">${b.status}</span></td></tr>`).join('')}</tbody>
      </table></div>`;
    } else if (section === 'listings') {
      const properties = await api.adminProperties();
      content.innerHTML = `<div style="overflow-x:auto"><table class="data-table">
        <thead><tr><th>Title</th><th>City</th><th>Price</th><th>Status</th></tr></thead>
        <tbody>${properties.map(p => `<tr><td>${p.title}</td><td>${p.city}</td><td>${formatPricePlain(p.price, p.status)}</td><td>${listingStatusBadge(p.status)}</td></tr>`).join('')}</tbody>
      </table></div>`;
    } else if (section === 'users') {
      const currentUser = getStoredUser();
      if (currentUser?.role !== 'admin') {
        content.innerHTML = `<p style="color:var(--text-muted)">User management requires an admin account.</p>`;
        return;
      }
      const rows = await api.adminUsers();
      content.innerHTML = `<div style="overflow-x:auto"><table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th><th>Status</th></tr></thead>
        <tbody>${rows.map(u => `<tr>
          <td>${u.full_name}</td>
          <td>${u.email}</td>
          <td>${u.phone || '—'}</td>
          <td>${userRoleBadge(u.role)}</td>
          <td>${u.joined}</td>
          <td><span class="badge ${u.is_active ? 'badge-success' : 'badge'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
        </tr>`).join('') || '<tr><td colspan="6">No users found</td></tr>'}</tbody>
      </table></div>`;
    } else {
      content.innerHTML = `<p style="color:var(--text-muted)">Section not found.</p>`;
    }
  } catch (err) {
    content.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

function renderEditListingForm(container, prop, onSuccess) {
  container.innerHTML = `
    <form id="edit-listing-form" style="max-width:720px">
      <div class="form-row">
        <div class="form-group"><label>Property Title <span class="req">*</span></label><input class="form-control" id="al-title" value="${prop.title}" required /></div>
        <div class="form-group"><label>Property Type <span class="req">*</span></label>
          <select class="form-control" id="al-type" required>
            <option value="house" ${prop.type==='house'?'selected':''}>house</option>
            <option value="apartment" ${prop.type==='apartment'?'selected':''}>apartment</option>
            <option value="townhouse" ${prop.type==='townhouse'?'selected':''}>townhouse</option>
          </select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Listing Status <span class="req">*</span></label>
          <select class="form-control" id="al-status" required>
            <option value="for-sale" ${prop.status==='for-sale'?'selected':''}>For Sale</option>
            <option value="for-rent" ${prop.status==='for-rent'?'selected':''}>For Rent</option>
            <option value="sold"     ${prop.status==='sold'?'selected':''}>Sold</option>
          </select></div>
        <div class="form-group"><label>Price (ZAR) <span class="req">*</span></label><input class="form-control" id="al-price" type="number" value="${prop.price}" required /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>City <span class="req">*</span></label><input class="form-control" id="al-city" value="${prop.city}" required /></div>
        <div class="form-group"><label>Suburb</label><input class="form-control" id="al-suburb" value="${prop.suburb||''}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Bedrooms</label><input class="form-control" id="al-beds" type="number" min="0" value="${prop.beds}" /></div>
        <div class="form-group"><label>Bathrooms</label><input class="form-control" id="al-baths" type="number" min="0" value="${prop.baths}" /></div>
        <div class="form-group"><label>Parking Bays</label><input class="form-control" id="al-parking" type="number" min="0" value="${prop.parking||0}" /></div>
        <div class="form-group"><label>Floor Size (m²)</label><input class="form-control" id="al-sqm" type="number" value="${prop.sqm||''}" /></div>
      </div>
      <div class="form-group"><label>Description</label><textarea class="form-control" id="al-description" rows="4">${prop.description||''}</textarea></div>
      <div class="form-group"><label>Image URL</label><input class="form-control" id="al-image" value="${prop.image||''}" /></div>
      <button type="submit" class="btn btn-primary">💾 Save Changes</button>
      <button type="button" class="btn btn-outline mt-1" style="margin-left:0.5rem" id="al-cancel">Cancel</button>
    </form>`;

  document.getElementById('al-cancel').addEventListener('click', onSuccess);
  document.getElementById('edit-listing-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!state.apiOnline) return;
    try {
      await api.adminUpdateProperty(prop.id, {
        title: document.getElementById('al-title').value,
        type: document.getElementById('al-type').value,
        status: document.getElementById('al-status').value,
        price: document.getElementById('al-price').value,
        city: document.getElementById('al-city').value,
        suburb: document.getElementById('al-suburb').value,
        beds: document.getElementById('al-beds').value,
        baths: document.getElementById('al-baths').value,
        parking: document.getElementById('al-parking').value,
        sqm: document.getElementById('al-sqm').value,
        description: document.getElementById('al-description').value,
        imageUrl: document.getElementById('al-image').value,
      });
      showToast('Listing updated!', 'success');
      await loadAllProperties();
      onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function openEnquiryModal(e) {
  const existing = document.getElementById('enquiry-detail-modal');
  if (existing) existing.remove();

  const user = getStoredUser();
  const isAgent = user?.role === 'agent' || user?.role === 'admin';
  const replySection = isAgent ? `
    <hr style="margin:1rem 0;border:none;border-top:1px solid var(--border)">
    ${e.agent_reply ? `<p style="margin-bottom:0.75rem"><strong>Your reply:</strong><br><span style="color:var(--text-muted)">${e.agent_reply}</span></p>` : ''}
    <div class="form-group">
      <label style="font-weight:700;font-size:0.85rem">${e.agent_reply ? 'Update reply' : 'Reply to enquiry'}</label>
      <textarea class="form-control" id="enq-reply-text" rows="3" placeholder="Type your reply...">${e.agent_reply || ''}</textarea>
    </div>
    <button class="btn btn-primary btn-sm" onclick="sendEnquiryReply(${e.enquiry_id})">Send Reply</button>` : '';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'enquiry-detail-modal';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>📩 Enquiry Details</h2>
        <button class="modal-close" onclick="document.getElementById('enquiry-detail-modal').remove();document.body.style.overflow=''">✕</button>
      </div>
      <p style="margin-bottom:0.5rem"><strong>From:</strong> ${e.sender_name} &lt;${e.sender_email}&gt;</p>
      ${e.sender_phone ? `<p style="margin-bottom:0.5rem"><strong>Phone:</strong> ${e.sender_phone}</p>` : ''}
      <p style="margin-bottom:0.5rem"><strong>Property:</strong> ${e.property_title}</p>
      <p style="margin-bottom:0.5rem"><strong>Date:</strong> ${e.submitted_date}</p>
      <p style="margin-bottom:0.5rem"><strong>Status:</strong> ${enquiryStatusBadge(e.status)}</p>
      <hr style="margin:1rem 0;border:none;border-top:1px solid var(--border)">
      <p style="white-space:pre-wrap;color:var(--text)">${e.message || '(No message)'}</p>
      ${replySection}
    </div>`;
  overlay.addEventListener('click', ev => { if (ev.target === overlay) { overlay.remove(); document.body.style.overflow = ''; } });
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

async function sendEnquiryReply(enquiryId) {
  const reply = document.getElementById('enq-reply-text')?.value.trim();
  if (!reply) { showToast('Please enter a reply', 'error'); return; }
  try {
    await api.replyToEnquiry(enquiryId, reply);
    showToast('Reply sent!', 'success');
    document.getElementById('enquiry-detail-modal')?.remove();
    document.body.style.overflow = '';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderAddListingForm(container, onSuccess) {
  const cancelFn = onSuccess || (() => renderAdminSection('listings'));
  container.innerHTML = `
    <form id="add-listing-form" style="max-width:720px">
      <div class="form-row">
        <div class="form-group"><label>Property Title <span class="req">*</span></label><input class="form-control" id="al-title" required placeholder="e.g. Modern 3-Bed Home in Sandton" /></div>
        <div class="form-group"><label>Property Type <span class="req">*</span></label><select class="form-control" id="al-type" required><option value="">Select type</option><option value="house">house</option><option value="apartment">apartment</option><option value="townhouse">townhouse</option></select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Listing Status <span class="req">*</span></label><select class="form-control" id="al-status" required><option value="for-sale">For Sale</option><option value="for-rent">For Rent</option><option value="sold">Sold</option></select></div>
        <div class="form-group"><label>Price (ZAR) <span class="req">*</span></label><input class="form-control" id="al-price" type="number" required placeholder="e.g. 2500000" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>City <span class="req">*</span></label><input class="form-control" id="al-city" required placeholder="e.g. Pretoria" /></div>
        <div class="form-group"><label>Suburb</label><input class="form-control" id="al-suburb" placeholder="e.g. Hatfield" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Bedrooms</label><input class="form-control" id="al-beds" type="number" min="0" /></div>
        <div class="form-group"><label>Bathrooms</label><input class="form-control" id="al-baths" type="number" min="0" /></div>
        <div class="form-group"><label>Parking Bays</label><input class="form-control" id="al-parking" type="number" min="0" /></div>
        <div class="form-group"><label>Floor Size (m²)</label><input class="form-control" id="al-sqm" type="number" /></div>
      </div>
      <div class="form-group"><label>Description</label><textarea class="form-control" id="al-description" rows="4" placeholder="Describe the property..."></textarea></div>
      <div class="form-group"><label>Image URL</label><input class="form-control" id="al-image" placeholder="https://..." /></div>
      <button type="submit" class="btn btn-primary">💾 Save Listing</button>
      <button type="button" class="btn btn-outline mt-1" style="margin-left:0.5rem" id="al-cancel">Cancel</button>
    </form>`;

  document.getElementById('al-cancel').addEventListener('click', cancelFn);

  document.getElementById('add-listing-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!state.apiOnline) return;
    try {
      await api.adminCreateProperty({
        title: document.getElementById('al-title').value,
        type: document.getElementById('al-type').value,
        status: document.getElementById('al-status').value,
        price: document.getElementById('al-price').value,
        city: document.getElementById('al-city').value,
        suburb: document.getElementById('al-suburb').value,
        beds: document.getElementById('al-beds').value,
        baths: document.getElementById('al-baths').value,
        parking: document.getElementById('al-parking').value,
        sqm: document.getElementById('al-sqm').value,
        description: document.getElementById('al-description').value,
        imageUrl: document.getElementById('al-image').value,
      });
      showToast('Listing saved to database!', 'success');
      await loadAllProperties();
      cancelFn();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// =============================================================
// 12b. LANDLORD PANEL
// =============================================================
function initLandlordPanel() {
  const landlordMain = document.querySelector('.landlord-main');
  if (!landlordMain) return;

  const user = getStoredUser();
  if (!user || user.role !== 'agent') {
    showToast('Landlord access required. Please log in as an agent.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    return;
  }

  renderLandlordDashboard();

  document.querySelectorAll('.landlord-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.landlord-nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      renderLandlordSection(link.dataset.section);
    });
  });
}

async function renderLandlordDashboard() {
  const content = document.getElementById('landlord-content');
  if (!content) return;

  if (!state.apiOnline) {
    content.innerHTML = `<p style="color:var(--text-muted)">Connect to the database to load your dashboard.</p>`;
    return;
  }

  try {
    const [stats, enquiries, properties] = await Promise.all([
      api.adminStats(),
      api.adminEnquiries(),
      api.adminProperties(),
    ]);

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card blue"><div class="label">My Listings</div><div class="value">${stats.listings}</div></div>
        <div class="stat-card gold"><div class="label">Enquiries</div><div class="value">${stats.enquiries}</div></div>
        <div class="stat-card green"><div class="label">Bookings</div><div class="value">${stats.bookings}</div><div class="change">${stats.pendingBookings} pending</div></div>
      </div>
      <h2 style="margin-bottom:1rem">Recent Enquiries</h2>
      <div style="overflow-x:auto">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Property</th><th>Date</th><th>Status</th><th></th></tr></thead>
        <tbody>${enquiries.slice(0, 8).map((e, i) => `
          <tr>
            <td>${e.sender_name}</td>
            <td>${e.property_title}</td>
            <td>${e.submitted_date}</td>
            <td>${enquiryStatusBadge(e.status)}</td>
            <td><button class="btn btn-sm btn-outline" onclick="openEnquiryModal(window._dashEnquiries[${i}])">View</button></td>
          </tr>`).join('') || '<tr><td colspan="5">No enquiries yet</td></tr>'}
        </tbody>
      </table>
      </div>
      <h2 style="margin:2rem 0 1rem">My Listings</h2>
      <div style="overflow-x:auto">
      <table class="data-table">
        <thead><tr><th>Title</th><th>Type</th><th>Price</th><th>City</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${properties.map((p, i) => `
          <tr>
            <td>${p.title}</td>
            <td>${p.type}</td>
            <td>${formatPricePlain(p.price, p.status)}</td>
            <td>${p.city}</td>
            <td>${listingStatusBadge(p.status)}</td>
            <td style="display:flex;gap:0.4rem">
              <button class="btn btn-sm btn-outline" onclick="renderEditListingForm(document.getElementById('landlord-content'),window._dashProps[${i}],()=>renderLandlordDashboard())">✏️ Edit</button>
              <button class="btn btn-sm btn-danger" onclick="archiveLandlordListing(${p.id})">🗑️ Archive</button>
            </td>
          </tr>`).join('') || '<tr><td colspan="6">No listings yet</td></tr>'}
        </tbody>
      </table>
      </div>`;
    window._dashEnquiries = enquiries;
    window._dashProps = properties;
  } catch (err) {
    showToast(err.message, 'error');
    content.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function updateLandlordBooking(id, status, rowIndex) {
  try {
    await api.updateBookingStatus(id, status);
    showToast(`Booking ${status}`, status === 'confirmed' ? 'success' : 'warning');
    renderLandlordSection('bookings');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function archiveLandlordListing(id) {
  if (!state.apiOnline) return;
  try {
    await api.adminArchiveProperty(id);
    showToast('Listing archived', 'warning');
    await loadAllProperties();
    renderLandlordDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function renderLandlordSection(section) {
  const content = document.getElementById('landlord-content');
  if (!content) return;
  const titles = { dashboard: 'Dashboard', listings: 'My Listings', enquiries: 'Enquiries', bookings: 'Viewing Bookings', 'add-listing': 'Add New Listing' };
  document.getElementById('landlord-page-title').textContent = titles[section] || section;

  if (section === 'dashboard') { await renderLandlordDashboard(); return; }
  if (section === 'add-listing') {
    renderAddListingForm(content, () => renderLandlordSection('listings'));
    return;
  }

  if (!state.apiOnline) {
    content.innerHTML = `<p style="color:var(--text-muted)">Server unavailable.</p>`;
    return;
  }

  try {
    if (section === 'enquiries') {
      const rows = await api.adminEnquiries();
      const enquiriesJson = JSON.stringify(rows).replace(/'/g, '&#39;');
      content.innerHTML = `<div style="overflow-x:auto"><table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Property</th><th>Date</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows.map((e, i) => `<tr><td>${e.sender_name}</td><td>${e.sender_email}</td><td>${e.property_title}</td><td>${e.submitted_date}</td><td>${enquiryStatusBadge(e.status)}</td><td><button class="btn btn-sm btn-outline" onclick="openEnquiryModal(window._enquiries[${i}])">View</button></td></tr>`).join('') || '<tr><td colspan="6">No enquiries yet</td></tr>'}</tbody>
      </table></div>`;
      window._enquiries = rows;
    } else if (section === 'bookings') {
      const rows = await api.adminBookings();
      window._landlordBookings = rows;
      content.innerHTML = `<div style="overflow-x:auto"><table class="data-table">
        <thead><tr><th>Name</th><th>Property</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${rows.map((b, i) => `<tr>
          <td>${b.contact_name}</td><td>${b.property_title}</td><td>${b.booking_date}</td><td>${b.time_slot}</td>
          <td><span class="badge ${b.status === 'confirmed' ? 'badge-success' : b.status === 'rejected' ? 'badge-danger' : 'badge-info'}">${b.status}</span></td>
          <td style="display:flex;gap:0.4rem">${b.status === 'pending' ? `
            <button class="btn btn-sm btn-primary" onclick="updateLandlordBooking(${b.booking_id},'confirmed',${i})">✅ Confirm</button>
            <button class="btn btn-sm btn-danger" onclick="updateLandlordBooking(${b.booking_id},'rejected',${i})">❌ Reject</button>` : ''}
          </td>
        </tr>`).join('') || '<tr><td colspan="6">No bookings yet</td></tr>'}</tbody>
      </table></div>`;
    } else if (section === 'listings') {
      const properties = await api.adminProperties();
      window._landlordProps = properties;
      content.innerHTML = `<div style="overflow-x:auto"><table class="data-table">
        <thead><tr><th>Title</th><th>City</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${properties.map((p, i) => `<tr><td>${p.title}</td><td>${p.city}</td><td>${formatPricePlain(p.price, p.status)}</td><td>${listingStatusBadge(p.status)}</td><td style="display:flex;gap:0.4rem"><button class="btn btn-sm btn-outline" onclick="renderEditListingForm(document.getElementById('landlord-content'),window._landlordProps[${i}],()=>renderLandlordSection('listings'))">✏️ Edit</button><button class="btn btn-sm btn-danger" onclick="archiveLandlordListing(${p.id})">🗑️ Archive</button></td></tr>`).join('') || '<tr><td colspan="5">No listings yet</td></tr>'}</tbody>
      </table></div>`;
    } else {
      content.innerHTML = `<p style="color:var(--text-muted)">Section not found.</p>`;
    }
  } catch (err) {
    content.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

// =============================================================
// 13. MODAL HELPERS
// =============================================================
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
});

// =============================================================
// 14. NAV & HELPERS
// =============================================================
function initNav() {
  const hamburger = document.querySelector('.hamburger');
  if (!hamburger) return;

  // Build drawer
  const overlay = document.createElement('div');
  overlay.className = 'nav-drawer-overlay';

  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-label', 'Navigation menu');

  const path = window.location.pathname.split('/').pop() || 'index.html';

  function drawerLink(href, label) {
    const isActive = href === path;
    return `<a href="${href}" class="nav-drawer-link${isActive ? ' active' : ''}">${label}</a>`;
  }

  drawer.innerHTML = `
    <div class="nav-drawer-header">
      <a href="index.html" class="nav-brand" style="font-size:1.35rem">Estate<span style="color:var(--brass-l);font-weight:400">Hub</span></a>
      <button class="nav-drawer-close" aria-label="Close menu">✕</button>
    </div>
    <nav class="nav-drawer-links">
      ${drawerLink('index.html', 'Home')}
      ${drawerLink('listings.html', 'Listings')}
      ${drawerLink('favourites.html', 'Favourites')}
      <a href="admin.html" class="nav-drawer-link nav-admin-link" style="display:none">Admin</a>
      <a href="landlord.html" class="nav-drawer-link nav-agent-link" style="display:none">My Portal</a>
      <a href="#" class="nav-drawer-link nav-buyer-link" style="display:none" onclick="openMyBookingsModal();return false">My Bookings</a>
    </nav>
    <div class="nav-drawer-footer hide-when-auth">
      <a href="login.html" class="btn btn-outline btn-block" style="color:rgba(255,255,255,0.8);border-color:rgba(255,255,255,0.28)">Log In</a>
      <a href="register.html" class="btn btn-accent btn-block">Register</a>
    </div>
    <div class="nav-drawer-footer show-when-auth" style="display:none">
      <span class="nav-drawer-user">Signed in as <strong class="user-name-display"></strong></span>
      <button class="btn btn-block" style="background:rgba(255,255,255,0.1);color:#fff" onclick="logoutUser()">Logout</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  const openDrawer = () => {
    drawer.classList.add('open');
    overlay.classList.add('open');
    hamburger.classList.add('drawer-open');
    document.body.style.overflow = 'hidden';
  };
  const closeDrawer = () => {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    hamburger.classList.remove('drawer-open');
    document.body.style.overflow = '';
  };

  hamburger.addEventListener('click', () => drawer.classList.contains('open') ? closeDrawer() : openDrawer());
  overlay.addEventListener('click', closeDrawer);
  drawer.querySelector('.nav-drawer-close').addEventListener('click', closeDrawer);
  drawer.querySelectorAll('.nav-drawer-link').forEach(l => l.addEventListener('click', closeDrawer));
}

function attachFavListeners(container) {
  container.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      toggleFavourite(btn.dataset.id);
    });
  });
}

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

function applyAuthUI() {
  const user = getStoredUser();
  if (user) {
    state.currentUser = user;
    document.querySelectorAll('.user-name-display').forEach(el => { el.textContent = user.name; });
    document.querySelectorAll('.show-when-auth').forEach(el => { el.style.display = 'flex'; });
    document.querySelectorAll('.hide-when-auth').forEach(el => { el.style.display = 'none'; });
    if (user.role === 'admin') {
      document.querySelectorAll('.nav-admin-link').forEach(el => { el.style.display = ''; });
    } else if (user.role === 'agent') {
      document.querySelectorAll('.nav-agent-link').forEach(el => { el.style.display = ''; });
    } else if (user.role === 'user') {
      document.querySelectorAll('.nav-buyer-link').forEach(el => { el.style.display = ''; });
    }
    injectNotificationBell();
  }
}

// =============================================================
// 15b. NOTIFICATION BELL
// =============================================================
function injectNotificationBell() {
  const navContainer = document.querySelector('.navbar .container');
  if (!navContainer || navContainer.querySelector('.notif-bell-wrap')) return;
  const target = navContainer.querySelector('.show-when-auth') || navContainer.querySelector('.nav-auth');
  if (!target) return;

  const wrap = document.createElement('div');
  wrap.className = 'notif-bell-wrap';
  wrap.innerHTML = `
    <button class="notif-bell-btn" id="notif-bell" aria-label="Notifications">
      🔔<span class="notif-badge" id="notif-badge" style="display:none">0</span>
    </button>
    <div class="notif-dropdown" id="notif-dropdown">
      <div class="notif-dropdown-header">
        <strong>Notifications</strong>
        <button class="btn btn-sm btn-outline" style="font-size:0.75rem;padding:0.2rem 0.6rem" onclick="markAllNotificationsRead()">Mark all read</button>
      </div>
      <div id="notif-list"><p class="notif-empty">Loading...</p></div>
    </div>`;
  navContainer.insertBefore(wrap, target);

  document.getElementById('notif-bell').addEventListener('click', e => {
    e.stopPropagation();
    const dd = document.getElementById('notif-dropdown');
    const opening = !dd.classList.contains('open');
    dd.classList.toggle('open');
    if (opening) loadNotifications();
  });
  document.addEventListener('click', e => {
    const dd = document.getElementById('notif-dropdown');
    if (dd && !wrap.contains(e.target)) dd.classList.remove('open');
  });
}

async function loadNotifications() {
  if (!state.apiOnline || !state.currentUser?.token) return;
  try {
    const { notifications, unread } = await api.getNotifications();
    const badge = document.getElementById('notif-badge');
    if (badge) {
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.style.display = unread > 0 ? 'flex' : 'none';
    }
    const list = document.getElementById('notif-list');
    if (!list) return;
    if (!notifications.length) {
      list.innerHTML = `<p class="notif-empty">No notifications yet</p>`;
      return;
    }
    list.innerHTML = notifications.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.notification_id}" onclick="markNotificationRead(${n.notification_id}, this)">
        <div class="notif-title">${n.title}</div>
        <div class="notif-body">${n.body}</div>
        <div class="notif-time">${n.created_at}</div>
      </div>`).join('');
  } catch { /* silent */ }
}

async function refreshNotifBadge() {
  if (!state.apiOnline || !state.currentUser?.token) return;
  try {
    const { unread } = await api.getNotifications();
    const badge = document.getElementById('notif-badge');
    if (badge) {
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.style.display = unread > 0 ? 'flex' : 'none';
    }
  } catch { /* silent */ }
}

async function markNotificationRead(id, el) {
  if (!state.apiOnline) return;
  try {
    await api.markNotificationRead(id);
    el?.classList.remove('unread');
    refreshNotifBadge();
  } catch { /* silent */ }
}

async function markAllNotificationsRead() {
  if (!state.apiOnline) return;
  try {
    await api.markAllNotificationsRead();
    document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
    const badge = document.getElementById('notif-badge');
    if (badge) badge.style.display = 'none';
  } catch { /* silent */ }
}

async function openMyBookingsModal() {
  const existing = document.getElementById('my-bookings-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'my-bookings-modal';
  overlay.innerHTML = `
    <div class="modal" style="max-width:640px">
      <div class="modal-header">
        <h2>📅 My Bookings</h2>
        <button class="modal-close" onclick="document.getElementById('my-bookings-modal').remove();document.body.style.overflow=''">✕</button>
      </div>
      <div id="my-bookings-list"><p style="color:var(--text-muted)">Loading...</p></div>
    </div>`;
  overlay.addEventListener('click', ev => { if (ev.target === overlay) { overlay.remove(); document.body.style.overflow = ''; } });
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  try {
    const bookings = await api.getMyBookings();
    const list = document.getElementById('my-bookings-list');
    if (!bookings.length) {
      list.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:1rem">No bookings yet.</p>`;
      return;
    }
    list.innerHTML = `<table class="data-table">
      <thead><tr><th>Property</th><th>Date</th><th>Time</th><th>Status</th><th></th></tr></thead>
      <tbody>${bookings.map(b => `
        <tr>
          <td>${b.property_title}</td>
          <td>${b.booking_date}</td>
          <td>${b.time_slot}</td>
          <td><span class="badge ${b.status === 'confirmed' ? 'badge-success' : b.status === 'rejected' ? 'badge-danger' : b.status === 'cancelled' ? 'badge' : 'badge-info'}">${b.status}</span></td>
          <td>${b.status === 'pending' || b.status === 'confirmed' ? `<button class="btn btn-sm btn-danger" onclick="cancelMyBooking(${b.booking_id}, this)">Cancel</button>` : ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  } catch (err) {
    document.getElementById('my-bookings-list').innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function cancelMyBooking(id, btn) {
  try {
    await api.cancelBooking(id);
    showToast('Booking cancelled', 'info');
    btn.closest('tr').querySelector('.badge').textContent = 'cancelled';
    btn.closest('tr').querySelector('.badge').className = 'badge';
    btn.remove();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =============================================================
// 15. BOOTSTRAP
// =============================================================
async function bootstrap() {
  initNav();
  applyAuthUI();

  try {
    await api.health();
    state.apiOnline = true;
    await loadAllProperties();
    if (state.currentUser?.token) {
      await syncFavouritesFromApi();
      refreshNotifBadge();
    }
  } catch {
    state.apiOnline = false;
    console.warn('Backend unavailable – run: cd backend && npm start');
  }

  initHomePage();
  initListingsPage();
  await initDetailPage();
  initEnquiryForm();
  initViewingForm();
  initLoginForm();
  initRegisterForm();
  await initFavouritesPage();
  initAdminPanel();
  initLandlordPanel();

  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === path);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch(err => console.error('Bootstrap error:', err));
});
