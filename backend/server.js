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

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'disconnected', message: err.message });
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
