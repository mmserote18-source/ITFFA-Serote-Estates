const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'estatehub-dev-secret';

function signToken(user) {
  return jwt.sign(
    { id: user.user_id, email: user.email, role: user.role, name: user.full_name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

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

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
    } catch {
      /* guest request */
    }
  }
  next();
}

function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user.role !== 'admin' && req.user.role !== 'agent') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

/** Map DB role (buyer) to frontend role (user) */
function toClientRole(dbRole) {
  if (dbRole === 'buyer') return 'user';
  return dbRole;
}

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
