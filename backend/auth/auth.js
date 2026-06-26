// JWT signing, verification, and middleware helpers shared across all routes.
const jwt = require('jsonwebtoken');

// Falls back to a hard-coded dev secret so the app boots without a .env file.
const JWT_SECRET = process.env.JWT_SECRET || 'estatehub-dev-secret';

// Signs a 7-day token; role is embedded so every request avoids a DB lookup.
function signToken(user) {
  return jwt.sign(
    { id: user.user_id, email: user.email, role: user.role, name: user.full_name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Hard gate: returns 401 when no valid Bearer token is present.
function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Soft gate: sets req.user when a valid token exists, continues silently for guests.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
    } catch {
      /* guest request — ignore invalid token and proceed unauthenticated */
    }
  }
  next();
}

// Both admins and agents are allowed through the admin routes; agents see only their own data.
function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user.role !== 'admin' && req.user.role !== 'agent') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

// DB stores "buyer" but the frontend shows "user" to avoid exposing internal terminology.
function toClientRole(dbRole) {
  if (dbRole === 'buyer') return 'user';
  return dbRole;
}

// Shapes a DB user row into the object returned to clients on login/register.
function formatUser(row, token) {
  return {
    id: row.user_id,
    name: row.full_name,
    email: row.email,
    phone: row.phone,
    role: toClientRole(row.role),
    token,
  };
}

module.exports = { signToken, authRequired, optionalAuth, adminRequired, toClientRole, formatUser, JWT_SECRET };
