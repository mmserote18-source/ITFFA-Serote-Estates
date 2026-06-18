const express = require('express');
const pool = require('../config/db');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/', optionalAuth, async (req, res) => {
  try {
    const { propertyId, name, email, phone, message } = req.body;

    if (!propertyId || !name?.trim() || !email?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Property, name, email and message are required' });
    }

    const [prop] = await pool.query(
      `SELECT property_id, agent_id, title FROM properties WHERE property_id = ?`,
      [propertyId]
    );
    if (!prop.length) return res.status(404).json({ error: 'Property not found' });

    const buyerId = req.user?.id || null;

    const [result] = await pool.query(
      `INSERT INTO enquiries (property_id, buyer_id, sender_name, sender_email, sender_phone, message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [propertyId, buyerId, name.trim(), email.trim(), phone?.trim() || null, message.trim()]
    );

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, related_id)
       VALUES (?, 'enquiry', ?, ?, ?)`,
      [
        prop[0].agent_id,
        `New enquiry for ${prop[0].title}`,
        `${name.trim()} submitted an enquiry.`,
        result.insertId,
      ]
    );

    res.status(201).json({ message: 'Enquiry sent successfully', enquiryId: result.insertId });
  } catch (err) {
    console.error('Enquiry error:', err);
    res.status(500).json({ error: 'Failed to send enquiry' });
  }
});

module.exports = router;
