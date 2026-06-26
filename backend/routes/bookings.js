// Viewing booking routes: submit, list own bookings, and cancel.
const express = require('express');
const pool = require('../config/db');
const { optionalAuth, authRequired } = require('../middleware/auth');

const router = express.Router();

// POST /api/bookings
// optionalAuth is used so guests can book viewings without an account;
// buyer_id is stored when available to link the booking to a user account.
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { propertyId, name, email, phone, date, time, notes } = req.body;

    if (!propertyId || !name?.trim() || !email?.trim() || !date || !time) {
      return res.status(400).json({ error: 'Property, name, email, date and time are required' });
    }

    // Verify the property exists before creating the booking.
    const [prop] = await pool.query(
      `SELECT property_id, agent_id, title FROM properties WHERE property_id = ?`,
      [propertyId]
    );
    if (!prop.length) return res.status(404).json({ error: 'Property not found' });

    const buyerId = req.user?.id || null;

    const [result] = await pool.query(
      `INSERT INTO viewing_bookings
       (property_id, buyer_id, contact_name, contact_email, contact_phone, booking_date, time_slot, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [propertyId, buyerId, name.trim(), email.trim(), phone?.trim() || null, date, time, notes?.trim() || null]
    );

    // Alert the responsible agent so they can confirm or reject the booking.
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, related_id)
       VALUES (?, 'booking', ?, ?, ?)`,
      [
        prop[0].agent_id,
        `Viewing booked for ${prop[0].title}`,
        `${name.trim()} requested a viewing on ${date}.`,
        result.insertId,
      ]
    );

    res.status(201).json({ message: 'Viewing booked successfully', bookingId: result.insertId });
  } catch (err) {
    console.error('Booking error:', err);
    res.status(500).json({ error: 'Failed to book viewing' });
  }
});

// GET /api/bookings/my
// Returns all bookings belonging to the authenticated buyer.
router.get('/my', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.booking_id, b.booking_date, b.time_slot, b.status, b.notes,
              DATE_FORMAT(b.created_at, '%Y-%m-%d') AS booked_on,
              p.title AS property_title, p.property_id
       FROM viewing_bookings b
       JOIN properties p ON p.property_id = b.property_id
       WHERE b.buyer_id = ?
       ORDER BY b.booking_date DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('My bookings error:', err);
    res.status(500).json({ error: 'Failed to load bookings' });
  }
});

// PATCH /api/bookings/:id/cancel
// Buyers can cancel their own bookings; notifies the agent when they do.
router.patch('/:id/cancel', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT b.buyer_id, b.status, b.contact_name, p.agent_id, p.title AS property_title
       FROM viewing_bookings b JOIN properties p ON p.property_id = b.property_id
       WHERE b.booking_id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = rows[0];
    // Only the buyer who made the booking may cancel it.
    if (booking.buyer_id !== req.user.id) return res.status(403).json({ error: 'Not your booking' });
    if (booking.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    await pool.query(`UPDATE viewing_bookings SET status = 'cancelled' WHERE booking_id = ?`, [id]);

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, related_id) VALUES (?, 'booking_cancelled', ?, ?, ?)`,
      [booking.agent_id, `Viewing booking cancelled`, `${booking.contact_name} cancelled their viewing for "${booking.property_title}".`, id]
    );

    res.json({ message: 'Booking cancelled' });
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

module.exports = router;
