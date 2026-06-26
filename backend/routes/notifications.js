// Notification routes: fetch, mark one as read, and mark all as read.
const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// All notification endpoints are private to the authenticated user.
router.use(authRequired);

// GET /api/notifications
// Returns the 30 most recent notifications and the unread count for the bell badge.
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT notification_id, type, title, body, is_read, related_id,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS created_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`,
      [req.user.id]
    );
    const [[{ unread }]] = await pool.query(
      `SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0`,
      [req.user.id]
    );
    res.json({ notifications: rows, unread });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

// PATCH /api/notifications/read-all
// Bulk-marks every unread notification for this user as read.
router.patch('/read-all', async (req, res) => {
  try {
    await pool.query(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [req.user.id]);
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// PATCH /api/notifications/:id/read
// Marks a single notification as read; scoped to user_id to prevent cross-user access.
router.patch('/:id/read', async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

module.exports = router;
