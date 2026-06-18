const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { signToken, formatUser, authRequired } = require('../middleware/auth');

const router = express.Router();

function toDbRole(clientRole) {
  if (clientRole === 'user') return 'buyer';
  if (clientRole === 'agent') return 'agent';
  return 'buyer';
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const dbRole = toDbRole(role);

    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), email.trim().toLowerCase(), phone?.trim() || null, passwordHash, dbRole]
    );

    res.status(201).json({
      message: 'Account created successfully',
      user: { id: result.insertId, name: name.trim(), email: email.trim().toLowerCase(), role: role === 'agent' ? 'agent' : 'user' },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [rows] = await pool.query(
      `SELECT user_id, full_name, email, phone, password_hash, role FROM users
       WHERE email = ? AND is_active = 1`,
      [email.trim().toLowerCase()]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    res.json({ user: formatUser(user, token) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT user_id, full_name, email, phone, role FROM users WHERE user_id = ? AND is_active = 1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    res.json({ user: formatUser(rows[0], req.headers.authorization.slice(7)) });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

module.exports = router;
