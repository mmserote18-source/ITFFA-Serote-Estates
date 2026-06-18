const express = require('express');
const pool = require('../config/db');
const { adminRequired } = require('../middleware/auth');
const { formatProperty, PROPERTY_SELECT } = require('../utils/properties');

const router = express.Router();

router.use(adminRequired);

router.get('/stats', async (req, res) => {
  try {
    const isAgent = req.user.role === 'agent';
    const id = req.user.id;
    const sub = 'SELECT property_id FROM properties WHERE agent_id = ?';

    const [[listings]] = await pool.query(
      `SELECT COUNT(*) AS count FROM properties WHERE status IN ('for-sale','for-rent')${isAgent ? ' AND agent_id = ?' : ''}`,
      isAgent ? [id] : []
    );
    const [[enquiries]] = await pool.query(
      `SELECT COUNT(*) AS count FROM enquiries${isAgent ? ` WHERE property_id IN (${sub})` : ''}`,
      isAgent ? [id] : []
    );
    const [[bookings]] = await pool.query(
      `SELECT COUNT(*) AS count FROM viewing_bookings${isAgent ? ` WHERE property_id IN (${sub})` : ''}`,
      isAgent ? [id] : []
    );
    const [[pendingBookings]] = await pool.query(
      `SELECT COUNT(*) AS count FROM viewing_bookings WHERE status = 'pending'${isAgent ? ` AND property_id IN (${sub})` : ''}`,
      isAgent ? [id] : []
    );
    const [[users]] = isAgent
      ? [[{ count: null }]]
      : await pool.query(`SELECT COUNT(*) AS count FROM users WHERE is_active = 1`);

    res.json({
      listings: listings.count,
      enquiries: enquiries.count,
      bookings: bookings.count,
      pendingBookings: pendingBookings.count,
      users: users.count,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

router.get('/enquiries', async (req, res) => {
  try {
    const isAgent = req.user.role === 'agent';
    const params = isAgent ? [req.user.id] : [];
    const [rows] = await pool.query(
      `SELECT e.enquiry_id, e.sender_name, e.sender_email, e.sender_phone, e.message, e.status,
              DATE_FORMAT(e.submitted_at, '%Y-%m-%d') AS submitted_date,
              p.title AS property_title
       FROM enquiries e
       JOIN properties p ON p.property_id = e.property_id
       ${isAgent ? 'WHERE p.agent_id = ?' : ''}
       ORDER BY e.submitted_at DESC
       LIMIT 50`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('Admin enquiries error:', err);
    res.status(500).json({ error: 'Failed to load enquiries' });
  }
});

router.get('/bookings', async (req, res) => {
  try {
    const isAgent = req.user.role === 'agent';
    const params = isAgent ? [req.user.id] : [];
    const [rows] = await pool.query(
      `SELECT b.booking_id, b.contact_name, b.contact_email, b.booking_date, b.time_slot, b.status,
              p.title AS property_title
       FROM viewing_bookings b
       JOIN properties p ON p.property_id = b.property_id
       ${isAgent ? 'WHERE p.agent_id = ?' : ''}
       ORDER BY b.booking_date DESC
       LIMIT 50`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('Admin bookings error:', err);
    res.status(500).json({ error: 'Failed to load bookings' });
  }
});

router.get('/users', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const [rows] = await pool.query(
      `SELECT user_id, full_name, email, phone, role, is_active,
              DATE_FORMAT(created_at, '%Y-%m-%d') AS joined
       FROM users ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

router.get('/properties', async (req, res) => {
  try {
    const isAgent = req.user.role === 'agent';
    const sql = `
      SELECT
        p.property_id, p.agent_id, p.title, p.description, p.property_type,
        p.status, p.price, p.suburb, p.city, p.bedrooms, p.bathrooms,
        p.parking_bays, p.floor_size_m2, p.is_featured,
        u.full_name AS agent_name, u.email AS agent_email, u.phone AS agent_phone,
        (SELECT pi.image_url FROM property_images pi
         WHERE pi.property_id = p.property_id AND pi.is_primary = 1
         LIMIT 1) AS primary_image
      FROM properties p
      JOIN users u ON u.user_id = p.agent_id
      ${isAgent ? 'WHERE p.agent_id = ?' : 'WHERE 1=1'}
      ORDER BY p.property_id DESC
    `;
    const params = isAgent ? [req.user.id] : [];
    const [rows] = await pool.query(sql, params);
    res.json(rows.map(formatProperty));
  } catch (err) {
    console.error('Admin properties error:', err);
    res.status(500).json({ error: 'Failed to load properties' });
  }
});

router.post('/properties', async (req, res) => {
  try {
    const {
      title, type, status, price, city, suburb, beds, baths, parking, sqm, description, imageUrl,
    } = req.body;

    if (!title?.trim() || !type || !status || !price || !city?.trim()) {
      return res.status(400).json({ error: 'Title, type, status, price and city are required' });
    }

    const agentId = req.user.role === 'agent' ? req.user.id : req.body.agentId || req.user.id;

    const [result] = await pool.query(
      `INSERT INTO properties
       (agent_id, title, description, property_type, status, price, suburb, city,
        bedrooms, bathrooms, parking_bays, floor_size_m2)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        agentId,
        title.trim(),
        description?.trim() || null,
        type,
        status,
        Number(price),
        suburb?.trim() || null,
        city.trim(),
        Number(beds) || 0,
        Number(baths) || 0,
        Number(parking) || 0,
        sqm ? Number(sqm) : null,
      ]
    );

    if (imageUrl?.trim()) {
      await pool.query(
        `INSERT INTO property_images (property_id, image_url, is_primary, sort_order) VALUES (?, ?, 1, 1)`,
        [result.insertId, imageUrl.trim()]
      );
    }

    // Notify buyers who have favourites in the same city
    const [buyers] = await pool.query(
      `SELECT DISTINCT f.user_id FROM favourites f
       JOIN properties p ON p.property_id = f.property_id
       JOIN users u ON u.user_id = f.user_id
       WHERE p.city = ? AND u.role = 'buyer'`,
      [city.trim()]
    );
    for (const { user_id } of buyers) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, related_id) VALUES (?, 'new_listing', ?, ?, ?)`,
        [user_id, `New listing in ${city.trim()}`, `"${title.trim()}" is now available in ${city.trim()}.`, result.insertId]
      );
    }

    res.status(201).json({ message: 'Listing created', propertyId: result.insertId });
  } catch (err) {
    console.error('Admin create property error:', err);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

router.patch('/properties/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid property ID' });

    const [current] = await pool.query(`SELECT title, price, status, agent_id FROM properties WHERE property_id = ?`, [id]);
    if (!current.length) return res.status(404).json({ error: 'Property not found' });
    const cur = current[0];

    if (req.user.role === 'agent' && cur.agent_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own listings' });
    }

    const { title, type, status, price, city, suburb, beds, baths, parking, sqm, description, imageUrl } = req.body;
    await pool.query(
      `UPDATE properties SET
        title = COALESCE(?, title),
        property_type = COALESCE(?, property_type),
        status = COALESCE(?, status),
        price = COALESCE(?, price),
        city = COALESCE(?, city),
        suburb = COALESCE(?, suburb),
        bedrooms = COALESCE(?, bedrooms),
        bathrooms = COALESCE(?, bathrooms),
        parking_bays = COALESCE(?, parking_bays),
        floor_size_m2 = COALESCE(?, floor_size_m2),
        description = COALESCE(?, description)
       WHERE property_id = ?`,
      [title||null, type||null, status||null, price?Number(price):null, city||null, suburb||null,
       beds!=null?Number(beds):null, baths!=null?Number(baths):null,
       parking!=null?Number(parking):null, sqm?Number(sqm):null, description||null, id]
    );

    if (imageUrl?.trim()) {
      const [existing] = await pool.query(`SELECT image_id FROM property_images WHERE property_id = ? AND is_primary = 1`, [id]);
      if (existing.length) {
        await pool.query(`UPDATE property_images SET image_url = ? WHERE property_id = ? AND is_primary = 1`, [imageUrl.trim(), id]);
      } else {
        await pool.query(`INSERT INTO property_images (property_id, image_url, is_primary, sort_order) VALUES (?, ?, 1, 1)`, [id, imageUrl.trim()]);
      }
    }

    // Notify buyers who favourited this property if price or status changed
    const propTitle = title || cur.title;
    const [favUsers] = await pool.query(`SELECT user_id FROM favourites WHERE property_id = ?`, [id]);
    if (price && Number(price) !== Number(cur.price)) {
      const direction = Number(price) > Number(cur.price) ? 'increased' : 'decreased';
      for (const { user_id } of favUsers) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body, related_id) VALUES (?, 'price_change', ?, ?, ?)`,
          [user_id, `Price ${direction} on a saved property`, `"${propTitle}" price has ${direction} to R${Number(price).toLocaleString()}.`, id]
        );
      }
    }
    if (status && status !== cur.status) {
      for (const { user_id } of favUsers) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body, related_id) VALUES (?, 'status_change', ?, ?, ?)`,
          [user_id, `Saved listing status changed`, `"${propTitle}" is now listed as ${status.replace(/-/g, ' ')}.`, id]
        );
      }
    }

    res.json({ message: 'Listing updated' });
  } catch (err) {
    console.error('Update property error:', err);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

router.patch('/properties/:id/archive', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid property ID' });

    if (req.user.role === 'agent') {
      const [prop] = await pool.query(
        `SELECT agent_id FROM properties WHERE property_id = ?`, [id]
      );
      if (!prop.length) return res.status(404).json({ error: 'Property not found' });
      if (prop[0].agent_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only archive your own listings' });
      }
    }

    await pool.query(`UPDATE properties SET status = 'archived' WHERE property_id = ?`, [id]);
    res.json({ message: 'Listing archived' });
  } catch (err) {
    console.error('Archive property error:', err);
    res.status(500).json({ error: 'Failed to archive listing' });
  }
});

router.patch('/enquiries/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { reply } = req.body;
    if (!reply?.trim()) return res.status(400).json({ error: 'Reply message is required' });

    const [rows] = await pool.query(
      `SELECT e.buyer_id, e.sender_name, p.title AS property_title, p.agent_id
       FROM enquiries e JOIN properties p ON p.property_id = e.property_id
       WHERE e.enquiry_id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Enquiry not found' });
    const enq = rows[0];
    if (req.user.role === 'agent' && enq.agent_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your enquiry' });
    }

    await pool.query(
      `UPDATE enquiries SET agent_reply = ?, status = 'responded' WHERE enquiry_id = ?`,
      [reply.trim(), id]
    );

    if (enq.buyer_id) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, related_id) VALUES (?, 'enquiry_reply', ?, ?, ?)`,
        [enq.buyer_id, `Reply to your enquiry`, `Your enquiry about "${enq.property_title}" has been answered.`, id]
      );
    }

    res.json({ message: 'Reply sent' });
  } catch (err) {
    console.error('Enquiry reply error:', err);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

router.patch('/bookings/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!['confirmed', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be confirmed or rejected' });
    }

    const [rows] = await pool.query(
      `SELECT b.buyer_id, b.contact_name, p.title AS property_title, p.agent_id
       FROM viewing_bookings b JOIN properties p ON p.property_id = b.property_id
       WHERE b.booking_id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = rows[0];
    if (req.user.role === 'agent' && booking.agent_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your booking' });
    }

    await pool.query(`UPDATE viewing_bookings SET status = ? WHERE booking_id = ?`, [status, id]);

    if (booking.buyer_id) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, related_id) VALUES (?, 'booking_update', ?, ?, ?)`,
        [booking.buyer_id, `Viewing ${status}`, `Your viewing for "${booking.property_title}" has been ${status}.`, id]
      );
    }

    res.json({ message: `Booking ${status}` });
  } catch (err) {
    console.error('Booking update error:', err);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

module.exports = router;
