require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const favouriteRoutes = require('./routes/favourites');
const enquiryRoutes = require('./routes/enquiries');
const bookingRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// REST API
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/favourites', favouriteRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/stats', async (_req, res) => {
  try {
    const [[active]]  = await pool.query(`SELECT COUNT(*) AS n FROM properties WHERE status IN ('for-sale','for-rent')`);
    const [[sold]]    = await pool.query(`SELECT COUNT(*) AS n FROM properties WHERE status = 'sold'`);
    const [[agents]]  = await pool.query(`SELECT COUNT(*) AS n FROM users WHERE role = 'agent' AND is_active = 1`);
    res.json({ active: active.n, sold: sold.n, agents: agents.n });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      message: err.message || String(err),
      code: err.code,
      host: process.env.DB_HOST || process.env.MYSQLHOST || '(not set)',
      db: process.env.DB_NAME || process.env.MYSQLDATABASE || '(not set)',
    });
  }
});

// Serve frontend static files from project root
const webRoot = path.join(__dirname, '..');
app.use(express.static(webRoot));

// SPA-style fallback for HTML pages
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const file = path.join(webRoot, req.path);
  if (req.path.endsWith('.html') || !path.extname(req.path)) {
    return res.sendFile(path.join(webRoot, 'index.html'), err => {
      if (err) next();
    });
  }
  next();
});

const server = app.listen(PORT, () => {
  console.log(`EstateHub server running at http://localhost:${PORT}`);
  console.log(`API health check: http://localhost:${PORT}/api/health`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or change PORT in backend/.env`);
  } else {
    console.error('Server failed to start:', err.message);
  }
  process.exit(1);
});
